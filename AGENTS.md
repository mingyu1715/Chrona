# AGENTS.md

Rules for AI coding agents working on Chrona.

## Required Reading

Before making changes, read:

1. `README.md` or `README.ko.md`
2. `docs/project-plan.md`
3. Current phase plan in `docs/plans/`
4. Relevant specs in `docs/specs/`
5. `docs/development-log.md`

## Work Rules

- Stay within the current phase unless the user explicitly changes scope.
- Do not redesign the full project when only the current phase needs work.
- Do not modify unrelated files.
- Do not revert user changes.
- Do not use destructive Git commands unless explicitly requested.
- Prefer small, testable changes.
- Add tests before changing behavior.
- Keep repository metadata paths OS-independent with `/` separators.
- Preserve source/repository containment safety checks.
- Keep commercial-use restrictions visible in README and LICENSE.

## Verification Rules

Run relevant verification before claiming completion:

```bash
npm test
npm run build
cd src-tauri && cargo test
```

For Tauri runtime changes:

```bash
npm run tauri dev
```

## Documentation Rules

Update documentation when behavior changes:

- Specs: repository format, block format, command API, snapshot format
- Plans: phase task checklist
- Development log: completed work, verification, decisions, next work
- Implemented docs: large completed feature records

## License Rule

Chrona is licensed for non-commercial use under PolyForm Noncommercial License 1.0.0. Do not replace the license with a permissive commercial-use license unless the user explicitly requests it.

## Product Design Direction

Chrona UI should read as a focused desktop workflow app, not a marketing SaaS page or broad analytics dashboard. Keep the interface quiet, dense, and task-oriented.

- Preferred palette: warm gray base, white surfaces, deep teal primary actions, muted blue snapshot accents, restrained amber/error states.
- Preferred layout: chapter-based workflow navigation, one active work stage, compact path/status strips, and drop-down panels for repository, ingest, snapshots, and review.
- Prefer lucide-react icons for visible commands and panel anchors.
- Preserve direct path entry even when native picker buttons are available.
- Avoid decorative gradient orbs, oversized hero treatment, nested cards, and future-feature UI that is not implemented.
