use std::fs;
use std::path::Path;

use chrona::core::errors::ChronaError;
use chrona::core::repository::RepositoryManager;
use chrona::core::repository_library_service::RepositoryLibraryService;
use chrona::models::repository_registry::RepositoryConnectionState;
use tempfile::TempDir;

fn create_repository(path: &Path) {
    RepositoryManager::create(path).unwrap();
}

#[test]
fn creates_repository_under_managed_root_and_activates_it() {
    let temp = TempDir::new().unwrap();
    let service = RepositoryLibraryService::new(temp.path().join("app-data"));

    let opened = service.create_managed("School Backup").unwrap();

    assert!(opened
        .registration
        .path
        .starts_with(service.managed_repositories_root()));
    assert_eq!(opened.registration.display_name, "School Backup");
    assert_eq!(
        opened.manifest.repository_id,
        opened.registration.repository_id
    );
    assert_eq!(
        service.list().unwrap().active_repository_id,
        Some(opened.registration.repository_id)
    );
}

#[test]
fn creates_repository_at_the_selected_parent_with_a_safe_directory_name() {
    let temp = TempDir::new().unwrap();
    let parent = temp.path().join("chosen-parent");
    let service = RepositoryLibraryService::new(temp.path().join("app-data"));

    let opened = service.create_at("School Backup", &parent).unwrap();
    let file_name = opened
        .registration
        .path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap();
    let suffix = &opened.manifest.repository_id[..8];

    assert!(opened
        .registration
        .path
        .starts_with(parent.canonicalize().unwrap()));
    assert_eq!(file_name, format!("school-backup-{suffix}"));
}

#[test]
fn registering_existing_repository_does_not_move_it() {
    let temp = TempDir::new().unwrap();
    let existing = temp.path().join("external-repository");
    create_repository(&existing);
    let service = RepositoryLibraryService::new(temp.path().join("app-data"));

    let opened = service.register_existing(&existing, None).unwrap();

    assert_eq!(opened.registration.path, existing.canonicalize().unwrap());
    assert!(existing.join("manifest.json").is_file());
}

#[test]
fn registering_existing_repository_activates_it() {
    let temp = TempDir::new().unwrap();
    let existing = temp.path().join("external");
    create_repository(&existing);
    let service = RepositoryLibraryService::new(temp.path().join("app-data"));

    let opened = service
        .register_existing(&existing, Some("External Backup"))
        .unwrap();

    assert_eq!(
        service.list().unwrap().active_repository_id,
        Some(opened.registration.repository_id.clone())
    );
    assert_eq!(opened.registration.display_name, "External Backup");
    assert_eq!(
        opened.registration.connection_state,
        RepositoryConnectionState::Connected
    );
}

#[test]
fn activating_a_registered_repository_switches_the_active_selection() {
    let temp = TempDir::new().unwrap();
    let first = temp.path().join("first");
    let second = temp.path().join("second");
    create_repository(&first);
    create_repository(&second);
    let service = RepositoryLibraryService::new(temp.path().join("app-data"));
    let first_opened = service.register_existing(&first, Some("First")).unwrap();
    let second_opened = service.register_existing(&second, Some("Second")).unwrap();

    service
        .activate(&first_opened.registration.repository_id)
        .unwrap();

    assert_eq!(
        service.list().unwrap().active_repository_id,
        Some(first_opened.registration.repository_id)
    );
    assert_eq!(
        service
            .activate(&second_opened.registration.repository_id)
            .unwrap()
            .manifest
            .repository_id,
        second_opened.manifest.repository_id
    );
    assert_eq!(
        service.list().unwrap().active_repository_id,
        Some(second_opened.registration.repository_id)
    );
}

#[test]
fn missing_external_repository_remains_registered_as_disconnected() {
    let temp = TempDir::new().unwrap();
    let external = temp.path().join("external");
    create_repository(&external);
    let service = RepositoryLibraryService::new(temp.path().join("app-data"));
    let opened = service.register_existing(&external, None).unwrap();
    fs::rename(&external, temp.path().join("detached")).unwrap();

    let library = service.list().unwrap();
    let item = library
        .repositories
        .iter()
        .find(|item| item.repository_id == opened.registration.repository_id)
        .unwrap();
    assert_eq!(
        item.connection_state,
        RepositoryConnectionState::Disconnected
    );
}

#[test]
fn relinking_a_registered_repository_restores_it_without_moving_files() {
    let temp = TempDir::new().unwrap();
    let external = temp.path().join("external");
    let relocated = temp.path().join("relocated");
    create_repository(&external);
    let service = RepositoryLibraryService::new(temp.path().join("app-data"));
    let opened = service
        .register_existing(&external, Some("Relink me"))
        .unwrap();
    fs::rename(&external, &relocated).unwrap();

    let relinked = service
        .relink(&opened.registration.repository_id, &relocated)
        .unwrap();

    assert_eq!(
        relinked.registration.path,
        relocated.canonicalize().unwrap()
    );
    assert_eq!(
        service.list().unwrap().repositories[0].connection_state,
        RepositoryConnectionState::Connected
    );
    assert!(relocated.join("manifest.json").is_file());
}

#[test]
fn duplicate_registration_by_path_is_rejected() {
    let temp = TempDir::new().unwrap();
    let existing = temp.path().join("external");
    create_repository(&existing);
    let service = RepositoryLibraryService::new(temp.path().join("app-data"));

    let opened = service.register_existing(&existing, None).unwrap();
    let error = service.register_existing(&existing, None).unwrap_err();
    let canonical_path = existing.canonicalize().unwrap().display().to_string();

    assert!(matches!(
        error,
        ChronaError::RepositoryAlreadyRegistered(value)
            if value == canonical_path || value == opened.registration.repository_id
    ));
}

#[test]
fn removing_a_registration_leaves_the_repository_files_in_place() {
    let temp = TempDir::new().unwrap();
    let existing = temp.path().join("external");
    create_repository(&existing);
    let service = RepositoryLibraryService::new(temp.path().join("app-data"));
    let opened = service.register_existing(&existing, None).unwrap();

    let library = service
        .remove_registration(&opened.registration.repository_id)
        .unwrap();

    assert!(library.repositories.is_empty());
    assert!(existing.join("manifest.json").is_file());
}
