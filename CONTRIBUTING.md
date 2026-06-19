# Contributing to Chrona

Chrona is currently an early-stage project. Contributions should stay aligned with the current phase plan and avoid expanding future scope too early.

## Before You Start

1. Read `README.md` or `README.ko.md`.
2. Check `docs/project-plan.md` for the overall direction.
3. Check the current phase plan in `docs/plans/`.
4. Check `docs/development-log.md` for recent decisions.
5. Create a branch from the active development branch.

## Development Rules

- Keep changes scoped to the current issue or phase.
- Add or update tests for behavior changes.
- Update specs when repository formats, metadata, or command interfaces change.
- Update the development log for meaningful implementation or verification work.
- Add an implemented record for large completed features.
- Do not introduce snapshot, restore, compression, encryption, or cloud features before their phase is explicitly planned.

## Verification

Run the relevant commands before opening a PR or merging:

```bash
npm test
npm run build
cd src-tauri && cargo test
```

For desktop runtime changes, also run:

```bash
npm run tauri dev
```

## License

By contributing, you agree that your contribution is provided under the project license: PolyForm Noncommercial License 1.0.0.
Commercial use is not permitted without separate written permission from the copyright holder.
