use std::cmp::Ordering;
use std::collections::BTreeMap;

use crate::models::access::{AccessEvent, AccessNode, AccessNodeKind, HomeSummary};

#[derive(Debug, Clone, Default)]
pub struct AccessIndex {
    nodes: BTreeMap<String, AccessNode>,
    root: Option<Box<SplayNode>>,
}

#[derive(Debug, Clone)]
struct SplayNode {
    key: String,
    left: Option<Box<SplayNode>>,
    right: Option<Box<SplayNode>>,
}

impl AccessIndex {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn from_nodes(nodes: Vec<AccessNode>) -> Self {
        let mut index = Self::new();
        for node in nodes {
            let key = node.key.clone();
            if !index.nodes.contains_key(&key) {
                index.root = Some(insert_node(index.root.take(), key.clone()));
            }
            index.nodes.insert(key, node);
        }
        index.rebuild_tree();
        index
    }

    pub fn record_access_event(&mut self, event: AccessEvent) -> AccessNode {
        let key = event.key.clone();
        if !self.nodes.contains_key(&key) {
            self.root = Some(insert_node(self.root.take(), key.clone()));
            self.nodes.insert(
                key.clone(),
                AccessNode {
                    key: key.clone(),
                    kind: event.kind.clone(),
                    label: event.label.clone(),
                    path: event.path.clone(),
                    repository_id: event.repository_id.clone(),
                    snapshot_id: event.snapshot_id.clone(),
                    base_snapshot_id: event.base_snapshot_id.clone(),
                    target_snapshot_id: event.target_snapshot_id.clone(),
                    access_count: 0,
                    last_accessed_at: event.accessed_at.clone(),
                    last_action: event.action.clone(),
                    pinned: false,
                },
            );
        }

        let node = self
            .nodes
            .get_mut(&key)
            .expect("access node is inserted before mutation");
        let access_count = node.access_count + 1;
        let pinned = node.pinned;
        *node = AccessNode {
            key: key.clone(),
            kind: event.kind,
            label: event.label,
            path: event.path,
            repository_id: event.repository_id,
            snapshot_id: event.snapshot_id,
            base_snapshot_id: event.base_snapshot_id,
            target_snapshot_id: event.target_snapshot_id,
            access_count,
            last_accessed_at: event.accessed_at,
            last_action: event.action,
            pinned,
        };

        let cloned = node.clone();
        self.splay(&key);
        cloned
    }

    pub fn get(&self, key: &str) -> Option<&AccessNode> {
        self.nodes.get(key)
    }

    pub fn pin(&mut self, key: &str) -> Option<AccessNode> {
        let node = self.nodes.get_mut(key)?;
        node.pinned = true;
        let cloned = node.clone();
        self.splay(key);
        Some(cloned)
    }

    pub fn unpin(&mut self, key: &str) -> Option<AccessNode> {
        let node = self.nodes.get_mut(key)?;
        node.pinned = false;
        let cloned = node.clone();
        self.splay(key);
        Some(cloned)
    }

    pub fn clear_unpinned(&mut self) -> usize {
        let before = self.nodes.len();
        self.nodes.retain(|_, node| node.pinned);
        self.rebuild_tree();
        before - self.nodes.len()
    }

    pub fn len(&self) -> usize {
        self.nodes.len()
    }

    pub fn is_empty(&self) -> bool {
        self.nodes.is_empty()
    }

    pub fn root_key(&self) -> Option<&str> {
        self.root.as_ref().map(|node| node.key.as_str())
    }

    pub fn items(&self) -> Vec<AccessNode> {
        self.nodes.values().cloned().collect()
    }

    pub fn home_summary(&self, limit: usize) -> HomeSummary {
        let recent = self.recent_items(limit);
        HomeSummary {
            continue_working: recent.first().cloned(),
            pinned: self.pinned_items(limit),
            recent_repositories: filter_recent(&recent, AccessNodeKind::Repository, limit),
            recent_sources: filter_recent(&recent, AccessNodeKind::Source, limit),
            recent_files: filter_recent(&recent, AccessNodeKind::File, limit),
            recent_snapshots: filter_recent(&recent, AccessNodeKind::Snapshot, limit),
            recent_compare_pairs: filter_recent(&recent, AccessNodeKind::ComparePair, limit),
        }
    }

    fn splay(&mut self, key: &str) {
        self.root = splay_node(self.root.take(), key);
    }

    fn recent_items(&self, limit: usize) -> Vec<AccessNode> {
        let mut items = self.items();
        items.sort_by(|left, right| {
            right
                .last_accessed_at
                .cmp(&left.last_accessed_at)
                .then_with(|| right.access_count.cmp(&left.access_count))
                .then_with(|| left.key.cmp(&right.key))
        });
        items.truncate(limit);
        items
    }

    fn pinned_items(&self, limit: usize) -> Vec<AccessNode> {
        let mut items: Vec<_> = self
            .nodes
            .values()
            .filter(|node| node.pinned)
            .cloned()
            .collect();
        items.sort_by(|left, right| {
            right
                .last_accessed_at
                .cmp(&left.last_accessed_at)
                .then_with(|| left.key.cmp(&right.key))
        });
        items.truncate(limit);
        items
    }

    fn rebuild_tree(&mut self) {
        self.root = None;
        let newest_key = self
            .nodes
            .values()
            .max_by(|left, right| {
                left.last_accessed_at
                    .cmp(&right.last_accessed_at)
                    .then_with(|| left.access_count.cmp(&right.access_count))
                    .then_with(|| right.key.cmp(&left.key))
            })
            .map(|node| node.key.clone());

        for key in self.nodes.keys().cloned().collect::<Vec<_>>() {
            self.root = Some(insert_node(self.root.take(), key));
        }

        if let Some(key) = newest_key {
            self.splay(&key);
        }
    }
}

fn filter_recent(items: &[AccessNode], kind: AccessNodeKind, limit: usize) -> Vec<AccessNode> {
    items
        .iter()
        .filter(|node| node.kind == kind)
        .take(limit)
        .cloned()
        .collect()
}

fn insert_node(root: Option<Box<SplayNode>>, key: String) -> Box<SplayNode> {
    match root {
        None => Box::new(SplayNode {
            key,
            left: None,
            right: None,
        }),
        Some(mut node) => {
            match key.as_str().cmp(node.key.as_str()) {
                Ordering::Less => node.left = Some(insert_node(node.left.take(), key)),
                Ordering::Greater => node.right = Some(insert_node(node.right.take(), key)),
                Ordering::Equal => {}
            }
            node
        }
    }
}

fn splay_node(root: Option<Box<SplayNode>>, key: &str) -> Option<Box<SplayNode>> {
    let mut root = root?;

    match key.cmp(root.key.as_str()) {
        Ordering::Less => {
            let Some(mut left) = root.left.take() else {
                return Some(root);
            };

            match key.cmp(left.key.as_str()) {
                Ordering::Less => {
                    left.left = splay_node(left.left.take(), key);
                    root.left = Some(left);
                    root = rotate_right(root);
                }
                Ordering::Greater => {
                    left.right = splay_node(left.right.take(), key);
                    if left.right.is_some() {
                        left = rotate_left(left);
                    }
                    root.left = Some(left);
                }
                Ordering::Equal => {
                    root.left = Some(left);
                }
            }

            if root.left.is_some() {
                Some(rotate_right(root))
            } else {
                Some(root)
            }
        }
        Ordering::Greater => {
            let Some(mut right) = root.right.take() else {
                return Some(root);
            };

            match key.cmp(right.key.as_str()) {
                Ordering::Greater => {
                    right.right = splay_node(right.right.take(), key);
                    root.right = Some(right);
                    root = rotate_left(root);
                }
                Ordering::Less => {
                    right.left = splay_node(right.left.take(), key);
                    if right.left.is_some() {
                        right = rotate_right(right);
                    }
                    root.right = Some(right);
                }
                Ordering::Equal => {
                    root.right = Some(right);
                }
            }

            if root.right.is_some() {
                Some(rotate_left(root))
            } else {
                Some(root)
            }
        }
        Ordering::Equal => Some(root),
    }
}

fn rotate_right(mut root: Box<SplayNode>) -> Box<SplayNode> {
    let Some(mut left) = root.left.take() else {
        return root;
    };
    root.left = left.right.take();
    left.right = Some(root);
    left
}

fn rotate_left(mut root: Box<SplayNode>) -> Box<SplayNode> {
    let Some(mut right) = root.right.take() else {
        return root;
    };
    root.right = right.left.take();
    right.left = Some(root);
    right
}
