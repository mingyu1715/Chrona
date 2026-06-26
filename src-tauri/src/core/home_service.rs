use std::path::Path;

use crate::core::access_store::AccessStore;
use crate::core::errors::{ChronaError, ChronaResult};
use crate::models::access::{AccessEvent, AccessHistorySummary, AccessNode, HomeSummary};

const ACCESS_HISTORY_SCHEMA_VERSION: u32 = 1;
const HOME_SUMMARY_LIMIT: usize = 12;

pub struct HomeService;

impl HomeService {
    pub fn new() -> Self {
        Self
    }

    pub fn record_access_event(
        &self,
        repository_path: &Path,
        event: AccessEvent,
    ) -> ChronaResult<AccessNode> {
        let store = AccessStore::new(repository_path.to_path_buf());
        let mut index = store.load()?;
        let node = index.record_access_event(event);
        store.save(&index)?;
        Ok(node)
    }

    pub fn get_home_summary(&self, repository_path: &Path) -> ChronaResult<HomeSummary> {
        let store = AccessStore::new(repository_path.to_path_buf());
        Ok(store.load()?.home_summary(HOME_SUMMARY_LIMIT))
    }

    pub fn pin_access_item(&self, repository_path: &Path, key: &str) -> ChronaResult<AccessNode> {
        let store = AccessStore::new(repository_path.to_path_buf());
        let mut index = store.load()?;
        let node = index
            .pin(key)
            .ok_or_else(|| ChronaError::InvalidRepository(format!("missing access item {key}")))?;
        store.save(&index)?;
        Ok(node)
    }

    pub fn unpin_access_item(&self, repository_path: &Path, key: &str) -> ChronaResult<AccessNode> {
        let store = AccessStore::new(repository_path.to_path_buf());
        let mut index = store.load()?;
        let node = index
            .unpin(key)
            .ok_or_else(|| ChronaError::InvalidRepository(format!("missing access item {key}")))?;
        store.save(&index)?;
        Ok(node)
    }

    pub fn clear_access_history(
        &self,
        repository_path: &Path,
    ) -> ChronaResult<AccessHistorySummary> {
        let store = AccessStore::new(repository_path.to_path_buf());
        let mut index = store.load()?;
        let removed_count = index.clear_unpinned() as u64;
        let remaining_count = index.len() as u64;
        store.save(&index)?;
        Ok(AccessHistorySummary {
            schema_version: ACCESS_HISTORY_SCHEMA_VERSION,
            removed_count,
            remaining_count,
        })
    }
}

impl Default for HomeService {
    fn default() -> Self {
        Self::new()
    }
}
