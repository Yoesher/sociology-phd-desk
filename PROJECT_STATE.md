# Project State

> Last updated: 2026-08-11  
> Status: Phase 0 and Phase 1 complete locally; GitHub publication blocked by missing authenticated tooling
> Canonical local project path: `D:\phddesk`

This file is the factual handoff record for maintainers and future Codex sessions. Update it at the end of every development session. Never infer passing checks, repository activity, users, or releases.

## Current version

- Package version: `0.1.0`
- Release status: locally verified pre-release; no public repository, tag, or release verified
- Next release target: publish the already runnable, tested, and documented `v0.1.0` only after remote CI succeeds

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
- Zod validation at portable-data and repository write boundaries.
- React Router for application navigation.
- Vitest and Testing Library for tests; `fake-indexeddb` for persistence tests.
- Oxlint, TypeScript project checks, and Vite production build as quality gates.
- No server, account, default cloud synchronization, analytics, or required AI API in the core architecture.

See [DECISIONS.md](DECISIONS.md) and [docs/architecture/overview.md](docs/architecture/overview.md).

## Current functional state

The local `0.1.0` vertical slice is implemented and exercised:

- responsive application shell, desktop/mobile navigation, route-level code splitting, and persistent light/dark theme;
- all nine routes: Today, Projects, Literature, Fieldwork, Quantitative, Evidence, Research Log, Manuscripts, and Submissions;
- full create, inspect, edit, and protected-delete flows for Projects, Evidence, Field Sites, Interviews, and Field Visits;
- focused creation, filtering, status, and registry workflows for Today tasks, Literature, Datasets/Analysis Runs, Research Log, Manuscripts, Submissions, and Reviewer Comments;
- a fully synthetic bundled demo workspace with visible demo state and no fabricated DOI, statistical result, source publication, participant narrative, or real place;
- browser-local IndexedDB persistence with a v1-to-v2 migration, whole-workspace validation, queued writes, optimistic revision checks, stale-tab conflict rejection, and same-origin refresh broadcasts;
- validated, versioned JSON export/import with preview, merge collision counts, explicit replacement, and destructive reset confirmation;
- fieldwork privacy warnings and cross-project relationship guards;
- English/Chinese documentation, contributor/security infrastructure, issue forms, CI, and sanitized screenshots.

Projects, Evidence, and Fieldwork are the deepest CRUD modules in this release. Other modules intentionally provide narrower registry/status workflows; the READMEs do not claim full CRUD parity.

## Validation status

Recorded against the final local shared tree on 2026-08-11:

| Check | Command | Current recorded result |
| --- | --- | --- |
| Install | `npm ci --registry=https://registry.npmjs.org --prefer-offline` | PASS — 126 packages installed, 127 audited, 0 vulnerabilities |
| Lint | `npm run lint` | PASS — Oxlint exited 0 with no findings |
| Type check | `npm run typecheck` | PASS — TypeScript build check exited 0 |
| Tests | `npm test` | PASS — 4 files, 22 tests |
| Build | `npm run build` | PASS — Vite 8.2.1, 1,907 modules, main chunk 448.08 kB / 139.66 kB gzip |
| Manual UI review | `npm run dev` plus route review | PASS — nine routes, 1280 px desktop, prior 390 × 844 responsive pass, light/dark, persistence, export, confirmations, and console review |

The browser pass created a clearly synthetic QA project, reloaded the page to prove IndexedDB and theme persistence, then deleted the record through its confirmation flow. JSON export displayed its versioned success filename. Demo reset opened a separate destructive confirmation and was cancelled. A Workspace modal positioning defect discovered during this pass was fixed with a document-body portal and re-verified at 1280 × 720. The final browser console contained no warnings or errors.

## Known issues and technical debt

- Browser-local data still requires an explicit user backup practice; IndexedDB is not a substitute for encrypted backups.
- Complete edit/delete parity is not yet implemented for Today, Literature, Quantitative, Research Log, Manuscripts, Submissions, and Reviewer Comments.
- Automated tests cover domain, portable-data, repository, conflict, and migration behavior, but not browser UI/route flows; multi-viewport end-to-end coverage is still needed.
- The current database includes one tested v1-to-v2 migration. Long-term compatibility will require migrations from every supported prior schema and fixture-based upgrade testing.
- JSON import has schema/relationship limits but no separate file-size or collection-count guard for extremely large files.
- Accessibility, keyboard navigation, and cross-browser behavior need a dedicated audit.
- Integration plans are unimplemented and require API/license/privacy review.

## Git and GitHub state

- Initial directory state: no Git repository.
- Target remote: `https://github.com/Yoesher/sociology-phd-desk`.
- Intended visibility: public.
- Intended default branch: `main`.
- GitHub CLI/authentication: blocked during Phase 0 because `gh` was not installed.
- Connector lookup: target repository not discovered during Phase 0.
- Local Git status: `main` contains durable bootstrap, application, and documentation commits; final handoff requires a clean working tree.
- Remote status: no `origin` is configured.
- Push status: blocked; do not claim a push until a remote and commit are independently confirmed.

## Release state

- Current GitHub release: none verified.
- Current tag: none verified.
- The local release gates pass, but `v0.1.0` remains unpublished until an authenticated public repository exists, the pushed commit is verified, and remote CI passes.

## Next version objective

Establish and verify the public GitHub repository when authenticated access becomes available, run remote CI on the exact pushed revision, then publish `v0.1.0` with its privacy model and known limitations. After publication, gather consented feedback from real sociology researchers before claiming adoption.

See [NEXT_TASKS.md](NEXT_TASKS.md) for the prioritized queue.
