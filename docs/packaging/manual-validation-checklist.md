# Packaging Manual Validation Checklist

## Common MVP Workflow

- First launch with no app data.
- Launch with existing `repository-registry.json`.
- Create repository in default app data location.
- Create repository in custom location.
- Register existing repository.
- Switch repositories.
- Register source folder.
- Create first backup.
- Create repeated backup from the same source.
- Modify source and create another backup.
- Compare snapshots.
- Delete snapshot.
- Restore to a new target folder.
- Restore to original location.
- Verify repository integrity.
- Restart app and confirm state persistence.
- Run a large backup and confirm the app remains navigable.

## Path Cases

- Korean path names.
- Paths with spaces.
- Deep nested folders.
- Empty files.
- Large files.
- Windows drive-letter paths.

## Platform UI

- macOS Finder reveal/open.
- macOS Dock icon and app name.
- Windows File Explorer reveal/open.
- Windows display scaling at 100%, 125%, and 150%.
