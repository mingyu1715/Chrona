# Packaging Known Limitations

- macOS packaging currently targets Apple Silicon only.
- macOS `.app` is unsigned and not notarized.
- macOS `.dmg` is unsigned and not notarized.
- Windows packaging targets x86-64 NSIS installer only.
- Windows installer is unsigned.
- Windows WebView2 uses `downloadBootstrapper`, so a machine without WebView2 needs internet access during installation.
- Windows runtime validation must be performed on a real Windows x86-64 machine.
- GitHub release automation and auto updates are not part of Phase 14.
- Tauri warns that the current bundle identifier `com.chrona.app` ends with `.app`; this is kept during Phase 14 to avoid changing the requested product identity.
