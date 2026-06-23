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

## Contributor License Agreement

Chrona requires contributor agreement before accepting pull requests.

By submitting a contribution, you agree to the Chrona Contributor License Agreement in `CLA.md`. In short:

- you keep copyright ownership of your contribution;
- you confirm that you have the right to submit it;
- you grant the copyright holder (Mingyu) the right to use, modify, and distribute the contribution under alternative licenses, including commercial licenses, at their sole discretion;
- you provide the contribution as-is, without warranty or required support.

Add this line to each pull request description or a pull request comment:

```text
I agree to the Chrona CLA.
```

Pull requests without CLA acknowledgment may be closed or left unmerged until the acknowledgment is added.

## License

By contributing, you agree that your contribution is provided under the project license and the CLA terms in `CLA.md`. The current public project license is PolyForm Noncommercial License 1.0.0.
Commercial use is not permitted without separate written permission from the copyright holder.
