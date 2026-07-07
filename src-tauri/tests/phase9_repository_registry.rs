use std::fs;
use std::path::Path;

use chrona::core::errors::ChronaError;
use chrona::core::repository_registry_store::RepositoryRegistryStore;
use chrona::models::repository_registry::RegisteredRepository;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

fn registered_repository(repository_id: &str, path: impl AsRef<Path>) -> RegisteredRepository {
    RegisteredRepository {
        repository_id: repository_id.to_string(),
        display_name: repository_id.to_string(),
        path: path.as_ref().to_path_buf(),
        added_at: "2026-07-07T00:00:00Z".to_string(),
        last_opened_at: "2026-07-07T00:00:00Z".to_string(),
    }
}

#[test]
fn registry_round_trip_preserves_active_repository() {
    let temp = tempfile::tempdir().unwrap();
    let store = RepositoryRegistryStore::new(temp.path().to_path_buf());
    let repository = temp.path().join("repo-a");
    fs::create_dir_all(&repository).unwrap();
    let mut item = registered_repository("repo-a", &repository);
    item.path = repository.canonicalize().unwrap();

    store.register(item.clone()).unwrap();
    store.set_active(Some(&item.repository_id)).unwrap();

    let loaded = store.load().unwrap();
    assert_eq!(loaded.active_repository_id.as_deref(), Some("repo-a"));
    assert_eq!(loaded.repositories, vec![item]);
}

#[test]
fn registry_rejects_duplicate_registration_keys() {
    let temp = tempfile::tempdir().unwrap();
    let repository_a = temp.path().join("repo-a");
    let repository_b = temp.path().join("repo-b");
    fs::create_dir_all(&repository_a).unwrap();
    fs::create_dir_all(&repository_b).unwrap();
    let store = RepositoryRegistryStore::new(temp.path().join("app-data"));

    store
        .register(registered_repository("repo-a", &repository_a))
        .unwrap();

    let duplicate_id = store
        .register(registered_repository("repo-a", &repository_b))
        .unwrap_err();
    assert!(matches!(
        duplicate_id,
        ChronaError::RepositoryAlreadyRegistered(value) if value == "repo-a"
    ));

    let duplicate_path = store
        .register(registered_repository("repo-b", &repository_a))
        .unwrap_err();
    assert!(matches!(
        duplicate_path,
        ChronaError::RepositoryAlreadyRegistered(value)
            if value == repository_a.canonicalize().unwrap().display().to_string()
    ));
}

#[test]
fn removing_active_repository_clears_active_selection() {
    let temp = tempfile::tempdir().unwrap();
    let store = RepositoryRegistryStore::new(temp.path().to_path_buf());
    let repository = temp.path().join("repo-a");
    fs::create_dir_all(&repository).unwrap();
    let item = registered_repository("repo-a", &repository);

    store.register(item.clone()).unwrap();
    store.set_active(Some(&item.repository_id)).unwrap();

    let updated = store.remove(&item.repository_id).unwrap();

    assert_eq!(updated.active_repository_id, None);
    assert!(updated.repositories.is_empty());
    assert_eq!(store.load().unwrap(), updated);
}

#[test]
fn relink_updates_registered_repository_path() {
    let temp = tempfile::tempdir().unwrap();
    let original = temp.path().join("repo-a");
    let relinked = temp.path().join("repo-b");
    fs::create_dir_all(&original).unwrap();
    fs::create_dir_all(&relinked).unwrap();
    let store = RepositoryRegistryStore::new(temp.path().join("app-data"));

    store
        .register(registered_repository("repo-a", &original))
        .unwrap();

    let updated = store.relink("repo-a", relinked.clone()).unwrap();

    assert_eq!(updated.repositories.len(), 1);
    assert_eq!(
        updated.repositories[0].path,
        relinked.canonicalize().unwrap()
    );
    assert_eq!(store.load().unwrap(), updated);
}

#[test]
fn set_active_rejects_unknown_repository_id() {
    let temp = tempfile::tempdir().unwrap();
    let store = RepositoryRegistryStore::new(temp.path().to_path_buf());

    let error = store.set_active(Some("missing-repo")).unwrap_err();

    assert!(matches!(
        error,
        ChronaError::RepositoryRegistrationNotFound(value) if value == "missing-repo"
    ));
}

#[cfg(unix)]
#[test]
fn failed_registry_write_keeps_previous_json_readable() {
    let temp = tempfile::tempdir().unwrap();
    let repository_a = temp.path().join("repo-a");
    let repository_b = temp.path().join("repo-b");
    let app_data_dir = temp.path().join("app-data");
    fs::create_dir_all(&repository_a).unwrap();
    fs::create_dir_all(&repository_b).unwrap();
    let store = RepositoryRegistryStore::new(app_data_dir.clone());
    store
        .register(registered_repository("repo-a", &repository_a))
        .unwrap();

    let registry_path = app_data_dir.join("repository-registry.json");
    let before = fs::read(&registry_path).unwrap();
    let original_mode = fs::metadata(&app_data_dir).unwrap().permissions().mode();
    let read_only_mode = original_mode & 0o555;
    fs::set_permissions(&app_data_dir, fs::Permissions::from_mode(read_only_mode)).unwrap();

    let result = store.register(registered_repository("repo-b", &repository_b));

    fs::set_permissions(&app_data_dir, fs::Permissions::from_mode(original_mode)).unwrap();

    assert!(result.is_err());
    assert_eq!(fs::read(&registry_path).unwrap(), before);
    let loaded = store.load().unwrap();
    assert_eq!(loaded.repositories.len(), 1);
    assert_eq!(loaded.repositories[0].repository_id, "repo-a");
}
