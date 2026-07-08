use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

use uuid::Uuid;

use crate::core::errors::{ChronaError, ChronaResult};
use crate::core::path_safety::canonicalize_existing;
use crate::models::repository_registry::{
    RegisteredRepository, RepositoryRegistry, REPOSITORY_REGISTRY_SCHEMA_VERSION,
};

const REPOSITORY_REGISTRY_FILE: &str = "repository-registry.json";

pub struct RepositoryRegistryStore {
    app_data_dir: PathBuf,
}

impl RepositoryRegistryStore {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self { app_data_dir }
    }

    pub fn load(&self) -> ChronaResult<RepositoryRegistry> {
        let path = self.registry_path();
        if !path.is_file() {
            return Ok(RepositoryRegistry::default());
        }

        let registry: RepositoryRegistry = serde_json::from_str(&fs::read_to_string(path)?)
            .map_err(|error| {
                ChronaError::InvalidRepositoryRegistry(format!(
                    "failed to parse repository registry JSON: {error}"
                ))
            })?;
        validate_registry(&registry)?;
        Ok(registry)
    }

    pub fn save(&self, registry: &RepositoryRegistry) -> ChronaResult<()> {
        validate_registry(registry)?;
        fs::create_dir_all(&self.app_data_dir)?;
        let final_path = self.registry_path();
        let tmp_path = self
            .app_data_dir
            .join(format!("{REPOSITORY_REGISTRY_FILE}.tmp-{}", Uuid::new_v4()));
        let bytes = serde_json::to_vec_pretty(registry).map_err(|error| {
            ChronaError::InvalidRepositoryRegistry(format!(
                "failed to serialize repository registry JSON: {error}"
            ))
        })?;

        let write_result = (|| {
            let mut file = OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&tmp_path)?;
            file.write_all(&bytes)?;
            file.sync_all()?;
            drop(file);
            fs::rename(&tmp_path, &final_path)?;
            Ok(())
        })();

        if let Err(error) = write_result {
            let _ = fs::remove_file(&tmp_path);
            return Err(error);
        }

        Ok(())
    }

    pub fn register(&self, item: RegisteredRepository) -> ChronaResult<RepositoryRegistry> {
        let mut registry = self.load()?;

        if registry
            .repositories
            .iter()
            .any(|existing| existing.repository_id == item.repository_id)
        {
            return Err(ChronaError::RepositoryAlreadyRegistered(
                item.repository_id.clone(),
            ));
        }

        let canonical_path = canonicalize_existing(&item.path)?;
        if registry
            .repositories
            .iter()
            .any(|existing| existing.path == canonical_path)
        {
            return Err(ChronaError::RepositoryAlreadyRegistered(
                canonical_path.display().to_string(),
            ));
        }

        let mut item = item;
        item.path = canonical_path;
        registry.repositories.push(item);
        self.save(&registry)?;
        Ok(registry)
    }

    pub fn set_active(&self, repository_id: Option<&str>) -> ChronaResult<RepositoryRegistry> {
        let mut registry = self.load()?;

        if let Some(repository_id) = repository_id {
            if !registry
                .repositories
                .iter()
                .any(|existing| existing.repository_id == repository_id)
            {
                return Err(ChronaError::RepositoryRegistrationNotFound(
                    repository_id.to_string(),
                ));
            }
            registry.active_repository_id = Some(repository_id.to_string());
        } else {
            registry.active_repository_id = None;
        }

        self.save(&registry)?;
        Ok(registry)
    }

    pub fn remove(&self, repository_id: &str) -> ChronaResult<RepositoryRegistry> {
        let mut registry = self.load()?;
        let original_len = registry.repositories.len();
        registry
            .repositories
            .retain(|existing| existing.repository_id != repository_id);

        if registry.repositories.len() == original_len {
            return Err(ChronaError::RepositoryRegistrationNotFound(
                repository_id.to_string(),
            ));
        }

        if registry.active_repository_id.as_deref() == Some(repository_id) {
            registry.active_repository_id = None;
        }

        self.save(&registry)?;
        Ok(registry)
    }

    pub fn relink(&self, repository_id: &str, path: PathBuf) -> ChronaResult<RepositoryRegistry> {
        let mut registry = self.load()?;
        let Some(target_index) = registry
            .repositories
            .iter()
            .position(|existing| existing.repository_id == repository_id)
        else {
            return Err(ChronaError::RepositoryRegistrationNotFound(
                repository_id.to_string(),
            ));
        };

        let canonical_path = canonicalize_existing(&path)?;
        if let Some(existing) = registry.repositories.iter().find(|existing| {
            existing.repository_id != repository_id && existing.path == canonical_path
        }) {
            return Err(ChronaError::RepositoryAlreadyRegistered(
                existing.path.display().to_string(),
            ));
        }

        registry.repositories[target_index].path = canonical_path;
        self.save(&registry)?;
        Ok(registry)
    }

    pub fn rename(
        &self,
        repository_id: &str,
        display_name: &str,
    ) -> ChronaResult<RepositoryRegistry> {
        let mut registry = self.load()?;
        let registration = registry
            .repositories
            .iter_mut()
            .find(|existing| existing.repository_id == repository_id)
            .ok_or_else(|| {
                ChronaError::RepositoryRegistrationNotFound(repository_id.to_string())
            })?;
        let display_name = display_name.trim();
        if display_name.is_empty() {
            return Err(ChronaError::InvalidRepositoryRegistry(
                "repository display name cannot be empty".to_string(),
            ));
        }

        registration.display_name = display_name.to_string();
        self.save(&registry)?;
        Ok(registry)
    }

    fn registry_path(&self) -> PathBuf {
        self.app_data_dir.join(REPOSITORY_REGISTRY_FILE)
    }
}

fn validate_registry(registry: &RepositoryRegistry) -> ChronaResult<()> {
    if registry.schema_version != REPOSITORY_REGISTRY_SCHEMA_VERSION {
        return Err(ChronaError::InvalidRepositoryRegistry(format!(
            "unsupported repository registry schema version {}",
            registry.schema_version
        )));
    }

    let mut repository_ids = HashSet::new();
    let mut repository_paths = HashSet::new();

    for repository in &registry.repositories {
        if !repository_ids.insert(repository.repository_id.clone()) {
            return Err(ChronaError::InvalidRepositoryRegistry(format!(
                "duplicate repository_id in repository registry: {}",
                repository.repository_id
            )));
        }

        if !repository_paths.insert(repository.path.clone()) {
            return Err(ChronaError::InvalidRepositoryRegistry(format!(
                "duplicate repository path in repository registry: {}",
                repository.path.display()
            )));
        }
    }

    if let Some(active_repository_id) = &registry.active_repository_id {
        if !repository_ids.contains(active_repository_id) {
            return Err(ChronaError::InvalidRepositoryRegistry(format!(
                "active repository `{active_repository_id}` is not registered"
            )));
        }
    }

    Ok(())
}
