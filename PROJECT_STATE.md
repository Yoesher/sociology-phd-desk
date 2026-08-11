# Project State

> Last updated: 2026-08-11  
> Status: Phase 1 implementation and verification in progress  
> Canonical local project path: `D:\phddesk`

This file is the factual handoff record for maintainers and future Codex sessions. Update it at the end of every development session. Never infer passing checks, repository activity, users, or releases.

## Current version

- Package version: `0.1.0`
- Release status: local pre-release; no public release verified
- Next release target: a runnable, tested, documented `v0.1.0`

## Phase 0 audit

Observed on 2026-08-11 before project bootstrap:

- `D:\phddesk` existed and was empty.
- It was not a Git repository.
- Node.js: `v24.14.0`.
- npm: `11.17.0`.
- Git: `2.54.0.windows.1`.
- GitHub CLI (`gh`): not installed; `gh auth status` therefore unavailable.
- The available GitHub connector did not discover `Yoesher/sociology-phd-desk`.
- No authenticated GitHub push path was available during the Phase 0 audit.

These facts do not prove that a similarly named remote repository cannot exist; they record only the checks that were actually available.

## Current architecture

- React + TypeScript + Vite client application.
- Browser-local IndexedDB persistence through Dexie.
- Zod validation at portable-data boundaries.
- React Router for application navigation.
- Vitest and Testing Library for tests; `fake-indexeddb` for persistence tests.
- Oxlint, TypeScript project checks, and Vite production build as quality gates.
- No server, account, default cloud synchronization, analytics, or required AI API in the core architecture.

See [DECISIONS.md](DECISIONS.md) and [docs/architecture/overview.md](docs/architecture/overview.md).

## Current functional state

The implementation is being assembled during the current session. Before closing the session, the maintainer must replace this paragraph with an audited list of workflows that were opened and exercised. A route, component, or planned feature is not counted as complete merely because its name exists.

Expected `0.1.0` vertical slice:

- application shell, responsive navigation, and light/dark theme;
- Today, Projects, Literature, Fieldwork, Quantitative, Evidence, Research Log, Manuscripts, and Submissions;
- explicit synthetic demo workspace;
- IndexedDB persistence;
- validated JSON export and import;
- core logic tests and production build.

## Validation status

The following fields are intentionally unresolved until the final commands run against the completed revision:

| Check | Command | Current recorded result |
| --- | --- | --- |
| Install | `npm ci` | Not yet recorded in this file |
| Lint | `npm run lint` | Not yet recorded in this file |
| Type check | `npm run typecheck` | Not yet recorded in this file |
| Tests | `npm test` | Not yet recorded in this file |
| Build | `npm run build` | Not yet recorded in this file |
| Manual UI review | `npm run dev` plus route review | Not yet recorded in this file |

Record the exact result and date after running each check. Do not change `Not yet recorded` to `PASS` based on another agent's statement without confirming the command output for the final shared tree.

## Known issues and technical debt

- Release screenshots are pending final build, route, responsive-layout, and privacy review.
- Browser-local data still requires an explicit user backup practice; IndexedDB is not a substitute for encrypted backups.
- The initial schema will need versioned migrations before long-term compatibility can be promised.
- Import conflict behavior and replacement safeguards require end-to-end verification against the final UI.
- Accessibility, keyboard navigation, and cross-browser behavior need a dedicated audit.
- Integration plans are unimplemented and require API/license/privacy review.

Remove any item that is demonstrably resolved; add exact reproduction details for unresolved defects.

## Git and GitHub state

- Initial directory state: no Git repository.
- Target remote: `https://github.com/Yoesher/sociology-phd-desk`.
- Intended visibility: public.
- Intended default branch: `main`.
- GitHub CLI/authentication: blocked during Phase 0 because `gh` was not installed.
- Connector lookup: target repository not discovered during Phase 0.
- Push status: not verified; do not claim a push until a remote and commit are independently confirmed.

## Release state

- Current GitHub release: none verified.
- Current tag: none verified.
- `v0.1.0` must not be published until install, start, persistence, JSON migration, lint, type checking, tests, build, documentation accuracy, secret/data review, and core page review all pass.

## Next version objective

Finish and verify the honest `0.1.0` local vertical slice, capture sanitized screenshots, establish a public GitHub repository when authenticated access is available, and publish the first release only after all release gates pass.

See [NEXT_TASKS.md](NEXT_TASKS.md) for the prioritized queue.
