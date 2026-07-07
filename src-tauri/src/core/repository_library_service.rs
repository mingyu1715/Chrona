use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use uuid::Uuid;

use crate::core::errors::{ChronaError, ChronaResult};
use crate::core::path_safety::canonicalize_existing;
use crate::core::repository::RepositoryManager;
use crate::core::repository_registry_store::RepositoryRegistryStore;
use crate::models::repository::RepositoryManifest;
use crate::models::repository_registry::{
    OpenedRepository, RegisteredRepository, RepositoryConnectionState, RepositoryLibrary,
    RepositoryLibraryItem,
};

pub struct RepositoryLibraryService {
    registry_store: RepositoryRegistryStore,
    managed_repositories_root: PathBuf,
}

impl RepositoryLibraryService {
    pub fn new(app_local_data_dir: PathBuf) -> Self {
        let managed_repositories_root = app_local_data_dir.join("Repositories");
        Self {
            registry_store: RepositoryRegistryStore::new(app_local_data_dir),
            managed_repositories_root,
        }
    }

    pub fn managed_repositories_root(&self) -> PathBuf {
        self.managed_repositories_root
            .canonicalize()
            .unwrap_or_else(|_| self.managed_repositories_root.clone())
    }

    pub fn list(&self) -> ChronaResult<RepositoryLibrary> {
        let registry = self.registry_store.load()?;
        let repositories = registry
            .repositories
            .iter()
            .map(|repository| self.to_library_item(repository))
            .collect::<ChronaResult<Vec<_>>>()?;

        Ok(RepositoryLibrary {
            active_repository_id: registry.active_repository_id,
            repositories,
        })
    }

    pub fn create_managed(&self, display_name: &str) -> ChronaResult<OpenedRepository> {
        self.create_at(display_name, &self.managed_repositories_root)
    }

    pub fn create_at(&self, display_name: &str, parent: &Path) -> ChronaResult<OpenedRepository> {
        fs::create_dir_all(parent)?;

        loop {
            let staging_path =
                parent.join(format!(".chrona-repository-staging-{}", Uuid::new_v4()));
            let manifest = RepositoryManager::create(&staging_path)?;
            let repository_id = manifest.repository_id.clone();
            let final_path = parent.join(repository_directory_name(display_name, &repository_id));

            if final_path.exists() {
                let _ = fs::remove_dir_all(&staging_path);
                continue;
            }

            fs::rename(&staging_path, &final_path)?;
            let now = Utc::now().to_rfc3339();
            let registration = RegisteredRepository {
                repository_id,
                display_name: display_name.to_string(),
                path: canonicalize_existing(&final_path)?,
                added_at: now.clone(),
                last_opened_at: now,
            };
            return self.register_opened_repository(manifest, registration, true);
        }
    }

    pub fn register_existing(
        &self,
        path: &Path,
        display_name: Option<&str>,
    ) -> ChronaResult<OpenedRepository> {
        let manifest = RepositoryManager::open(path)?;
        let display_name = display_name
            .map(|value| value.to_string())
            .unwrap_or_else(|| default_display_name_for_path(path));
        let now = Utc::now().to_rfc3339();
        let registration = RegisteredRepository {
            repository_id: manifest.repository_id.clone(),
            display_name,
            path: canonicalize_existing(path)?,
            added_at: now.clone(),
            last_opened_at: now,
        };

        let registry = self.registry_store.register(registration)?;
        self.registry_store
            .set_active(Some(&manifest.repository_id))?;
        self.touch_last_opened(&manifest.repository_id)?;
        let repository_id = manifest.repository_id.clone();
        self.open_registered_repository(&registry, &repository_id, manifest)
    }

    pub fn activate(&self, repository_id: &str) -> ChronaResult<OpenedRepository> {
        let registry = self.registry_store.load()?;
        let manifest = self.open_manifest(&registry, repository_id)?;
        let registry = self.registry_store.set_active(Some(repository_id))?;
        self.touch_last_opened(repository_id)?;
        self.open_registered_repository(&registry, repository_id, manifest)
    }

    pub fn remove_registration(&self, repository_id: &str) -> ChronaResult<RepositoryLibrary> {
        self.registry_store.remove(repository_id)?;
        self.list()
    }

    pub fn relink(&self, repository_id: &str, path: &Path) -> ChronaResult<OpenedRepository> {
        let manifest = RepositoryManager::open(path)?;
        let registry = self
            .registry_store
            .relink(repository_id, path.to_path_buf())?;
        self.touch_last_opened(repository_id)?;
        self.open_registered_repository(&registry, repository_id, manifest)
    }

    fn to_library_item(
        &self,
        registration: &RegisteredRepository,
    ) -> ChronaResult<RepositoryLibraryItem> {
        let connection_state = if RepositoryManager::probe(&registration.path).is_ok() {
            RepositoryConnectionState::Connected
        } else {
            RepositoryConnectionState::Disconnected
        };

        Ok(RepositoryLibraryItem {
            repository_id: registration.repository_id.clone(),
            display_name: registration.display_name.clone(),
            path: registration.path.clone(),
            added_at: registration.added_at.clone(),
            last_opened_at: registration.last_opened_at.clone(),
            connection_state,
        })
    }

    fn touch_last_opened(&self, repository_id: &str) -> ChronaResult<()> {
        let mut registry = self.registry_store.load()?;
        let registration = registry
            .repositories
            .iter_mut()
            .find(|registration| registration.repository_id == repository_id)
            .ok_or_else(|| {
                ChronaError::RepositoryRegistrationNotFound(repository_id.to_string())
            })?;
        registration.last_opened_at = Utc::now().to_rfc3339();
        self.registry_store.save(&registry)
    }

    fn open_manifest(
        &self,
        registry: &crate::models::repository_registry::RepositoryRegistry,
        repository_id: &str,
    ) -> ChronaResult<RepositoryManifest> {
        let registration = registry
            .repositories
            .iter()
            .find(|registration| registration.repository_id == repository_id)
            .ok_or_else(|| {
                ChronaError::RepositoryRegistrationNotFound(repository_id.to_string())
            })?;
        RepositoryManager::open(&registration.path)
    }

    fn open_registered_repository(
        &self,
        registry: &crate::models::repository_registry::RepositoryRegistry,
        repository_id: &str,
        manifest: RepositoryManifest,
    ) -> ChronaResult<OpenedRepository> {
        let registration = registry
            .repositories
            .iter()
            .find(|registration| registration.repository_id == repository_id)
            .ok_or_else(|| {
                ChronaError::RepositoryRegistrationNotFound(repository_id.to_string())
            })?;
        Ok(OpenedRepository {
            registration: self.to_library_item(registration)?,
            manifest,
        })
    }

    fn register_opened_repository(
        &self,
        manifest: RepositoryManifest,
        registration: RegisteredRepository,
        activate: bool,
    ) -> ChronaResult<OpenedRepository> {
        let repository_id = registration.repository_id.clone();
        let registry = self.registry_store.register(registration)?;
        if activate {
            self.registry_store.set_active(Some(&repository_id))?;
        }
        self.touch_last_opened(&repository_id)?;
        self.open_registered_repository(&registry, &repository_id, manifest)
    }
}

fn repository_directory_name(display_name: &str, repository_id: &str) -> String {
    let mut normalized = String::new();
    let mut last_was_dash = false;

    for ch in display_name.chars() {
        if ch.is_ascii_alphanumeric() {
            normalized.push(ch.to_ascii_lowercase());
            last_was_dash = false;
        } else if !last_was_dash {
            normalized.push('-');
            last_was_dash = true;
        }
    }

    let normalized = normalized.trim_matches('-');
    let base = if normalized.is_empty() {
        "repository"
    } else {
        normalized
    };
    let suffix = repository_id.chars().take(8).collect::<String>();
    format!("{base}-{suffix}")
}

fn default_display_name_for_path(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .map(|name| name.to_string())
        .unwrap_or_else(|| "repository".to_string())
}
