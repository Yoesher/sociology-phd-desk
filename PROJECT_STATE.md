# Project State

> Last updated: 2026-08-11  
> Status: Phase 0 and Phase 1 complete; Phase 2 public repository, remote CI, and Pages verified, with the `v0.1.0` tag and Release still pending
> Canonical local project path: `D:\phddesk`

This file is the factual handoff record for maintainers and future Codex sessions. Update it at the end of every development session. Never infer passing checks, repository activity, users, or releases.

## Current version

- Package version: `0.1.0`
- Release status: public release candidate; repository, remote CI, Pages, and deployed browser smoke verified; tag and GitHub Release not yet created
- Next release target: publish `v0.1.0` only after the final documentation revision passes the complete local gate and remote CI

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
- browser-local IndexedDB persistence with a tested database v1-to-v2 migration, whole-workspace validation, generation-aware queued writes, optimistic revision checks, stale-tab/dependent-write cancellation, and same-origin refresh broadcasts;
- validated portable JSON v2 export/import, tested legacy v1-to-v2 migration, preview, merge collision counts, explicit replacement, and destructive reset confirmation;
- fieldwork privacy warnings and cross-project relationship guards;
- English/Chinese documentation, contributor/security infrastructure, issue forms, CI, and sanitized screenshots.

Projects, Evidence, and Fieldwork are the deepest CRUD modules in this release. Other modules intentionally provide narrower registry/status workflows; the READMEs do not claim full CRUD parity.

## Validation status

Recorded on 2026-08-11. Local checks were most recently run after the Pages workflow change; remote checks below identify the exact tested revision.

| Check | Command | Current recorded result |
| --- | --- | --- |
| Install | `npm ci` | PASS — 126 packages installed from the lockfile |
| Lint | `npm run lint` | PASS — Oxlint exited 0 with no findings |
| Type check | `npm run typecheck` | PASS — TypeScript build check exited 0 |
| Tests | `npm test` | PASS — 6 files, 25 tests |
| Build | `npm run build` | PASS — Vite 8.2.1, 1,907 modules, main chunk 450.31 kB / 140.43 kB gzip |
| Deployed browser smoke | `https://yoesher.github.io/sociology-phd-desk/` | PASS — nine hash routes, light/dark, synthetic demo, task persistence across reload, confirmed demo restore, and zero application console errors; the export control was exercised but the in-app browser did not expose its download event |
| Remote CI | [CI run 31479384463](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31479384463) | PASS on `56b08b2f46bbdcee1a69f7b75dbf9afb76f57179` — install, lint, typecheck, 25 tests, and production build |
| Pages | [Pages run 31479384392](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31479384392) | PASS after Pages was enabled for GitHub Actions; deployed URL verified as `https://yoesher.github.io/sociology-phd-desk/` |

The browser pass created a clearly synthetic QA project, reloaded the page to prove IndexedDB and theme persistence, then deleted the record through its confirmation flow. JSON export displayed its versioned success filename. Demo reset opened a separate destructive confirmation and was cancelled. A Workspace modal positioning defect discovered during this pass was fixed with a document-body portal and re-verified at 1280 × 720. The browser console contained no warnings or errors at that revision.

A later audit added the generation-poison write queue and nested modal stack. Both are covered by dedicated automated regression tests. The deployed Phase 2 smoke exercised the nested demo-reset confirmation, but complete keyboard Escape/focus lifecycle coverage remains an automated-browser roadmap item.

## Known issues and technical debt

- Browser-local data still requires an explicit user backup practice; IndexedDB is not a substitute for encrypted backups.
- Complete edit/delete parity is not yet implemented for Today, Literature, Quantitative, Research Log, Manuscripts, Submissions, and Reviewer Comments.
- Automated tests cover domain, portable-data, repository, conflict, migration, the optimistic context queue, and nested modal lifecycle. They do not yet automate complete browser route workflows; multi-viewport end-to-end coverage is still needed.
- Expand nested Workspace/confirmation Escape, scroll-lock, and focus-restoration coverage from the existing component test to automated browser tests.
- The current database and portable JSON formats each include a tested v1-to-v2 migration. Long-term compatibility will require retained fixtures and upgrade tests from every supported prior version.
- JSON import has schema/relationship limits but no separate file-size or collection-count guard for extremely large files.
- Accessibility, keyboard navigation, and cross-browser behavior need a dedicated audit.
- Integration plans are unimplemented and require API/license/privacy review.

## Git and GitHub state

- Initial directory state: no Git repository.
- Repository: `https://github.com/Yoesher/sociology-phd-desk`.
- Visibility: public, verified through the GitHub API.
- Default branch: `main`, verified after the first push.
- GitHub CLI/authentication: Phase 0 was blocked because `gh` was not installed; Phase 2 installed the official GitHub CLI and verified the authenticated account as `Yoesher`.
- Connector lookup: target repository not discovered during Phase 0.
- Local Git status: `main` contains the durable application, documentation, and Pages deployment history; the final release-documentation revision is pending commit and gate verification.
- Remote status: `origin` targets the sole repository, `Yoesher/sociology-phd-desk`; Phase 2 temporarily used GitHub's official SSH-over-443 transport because direct `github.com` Git HTTPS timed out in the execution environment.
- Push status: PASS for publication-infrastructure baseline `56b08b2f46bbdcee1a69f7b75dbf9afb76f57179`; local Git, `git ls-remote`, and GitHub API returned the same SHA. The later release SHA must be recorded after its own three-way check.

## Release state

- Current GitHub release: none verified.
- Current tag: none verified.
- `v0.1.0` remains unpublished until the final documentation commit passes local and remote gates and the annotated tag is independently verified.

## Next version objective

Complete the final `v0.1.0` release gate and publish the annotated tag and GitHub Release. After publication, maintain the six substantive roadmap issues and gather consented feedback from real sociology researchers before claiming adoption.

See [NEXT_TASKS.md](NEXT_TASKS.md) for the prioritized queue.
