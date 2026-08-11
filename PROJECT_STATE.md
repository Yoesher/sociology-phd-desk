# Project State

> Last updated: 2026-08-11  
> Status: Phase 0, Phase 1, Phase 2, and Phase 3A complete; bilingual localization was squash-merged through [#9](https://github.com/Yoesher/sociology-phd-desk/pull/9) as [`bad788f`](https://github.com/Yoesher/sociology-phd-desk/commit/bad788fac457950dfe311dc1b539cec5e74bf65a), with exact-`main` CI, Pages deployment, and public bilingual browser verification passing; `v0.1.0` remains the verified public release
> Canonical local project path: `D:\phddesk`

This file is the factual handoff record for maintainers and future Codex sessions. Update it at the end of every development session. Never infer passing checks, repository activity, users, or releases.

## Current version

- Package version: `0.1.0`
- Release status: [`v0.1.0`](https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.1.0) published and verified
- Next release target: evidence-driven `0.1.x` maintenance fixes or a scoped `0.2.0`; no date is promised

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
- A typed internal i18n layer with Chinese-first `zh-CN` and complete `en` resources; application language/theme settings remain separate from research data.
- Vitest and Testing Library for tests; `fake-indexeddb` for persistence tests.
- Oxlint, TypeScript project checks, and Vite production build as quality gates.
- No server, account, default cloud synchronization, analytics, or required AI API in the core architecture.

See [DECISIONS.md](DECISIONS.md) and [docs/architecture/overview.md](docs/architecture/overview.md).

## Current functional state

Current `main` contains the published `v0.1.0` foundation plus the merged, unreleased Phase 3A bilingual implementation:

- responsive application shell, desktop/mobile navigation, route-level code splitting, and persistent light/dark theme;
- the merged Phase 3A implementation with Chinese as the fresh-install default, immediate persistent Chinese/English switching, locale-aware dates/numbers/validation, stable persisted enum values, and no automatic translation of user-authored content;
- all nine routes: Today, Projects, Literature, Fieldwork, Quantitative, Evidence, Research Log, Manuscripts, and Submissions;
- full create, inspect, edit, and protected-delete flows for Projects, Evidence, Field Sites, Interviews, and Field Visits;
- focused creation, filtering, status, and registry workflows for Today tasks, Literature, Datasets/Analysis Runs, Research Log, Manuscripts, Submissions, and Reviewer Comments;
- a fully synthetic bundled demo workspace with visible demo state and no fabricated DOI, statistical result, source publication, participant narrative, or real place;
- browser-local IndexedDB persistence with a tested database v1-to-v2 migration, whole-workspace validation, generation-aware queued writes, optimistic revision checks, stale-tab/dependent-write cancellation, and same-origin refresh broadcasts;
- validated portable JSON v2 export/import, tested legacy v1-to-v2 migration, preview, merge collision counts, explicit replacement, and destructive reset confirmation;
- fieldwork privacy warnings and cross-project relationship guards;
- Chinese-default documentation with complete reciprocal English README/contribution guides, contributor/security infrastructure, issue forms, CI, and sanitized screenshots.

Projects, Evidence, and Fieldwork are the deepest CRUD modules in this release. Other modules intentionally provide narrower registry/status workflows; the READMEs do not claim full CRUD parity.

## Validation status

Recorded on 2026-08-11. The Phase 3A final candidate passed local verification after the final accessibility and responsive fixes. Pull Request final-head CI, maintainer self-review, squash merge, exact-`main` CI, Pages deployment, and bilingual public browser verification then passed. The published `v0.1.0` release and annotated tag remain unchanged; Phase 3A is merged on `main` but not presented as a new release.

| Check | Command | Current recorded result |
| --- | --- | --- |
| Install | `npm ci` | PASS — 126 packages installed from the lockfile |
| Lint | `npm run lint` | PASS — Oxlint exited 0 with no findings on the final local candidate |
| Type check | `npm run typecheck` | PASS — TypeScript build check exited 0 on the final local candidate |
| Tests | `npm test` | PASS — 11 files, 37 tests |
| Build | `npm run build` | PASS — Vite 8.2.1, 1,927 modules, largest `vendor` chunk 402.70 kB / 125.99 kB gzip; no oversized-chunk warning |
| Phase 3A local browser smoke | `http://127.0.0.1:41739/` | PASS — all nine routes in both languages; Chinese fresh default; immediate switch and reload persistence; stable route/theme/demo content; Chinese/English validation; workspace/reset dialogs; fieldwork privacy; 1280, 1025, and 390 × 844 layouts; mobile status labels; zero console warnings/errors; no horizontal overflow. JSON export showed its versioned success state, while the in-app browser did not expose a download event. |
| Phase 3A Pull Request | [PR #9](https://github.com/Yoesher/sociology-phd-desk/pull/9) | PASS — final head `5094269065a411b522c669a85f9a8a7cf53853b8` passed [PR CI 31491692818](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31491692818) and [push CI 31491689180](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31491689180), received maintainer self-review, and was squash-merged as `bad788fac457950dfe311dc1b539cec5e74bf65a` |
| Phase 3A exact-`main` CI | [CI run 31491968689](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31491968689) | PASS on `bad788fac457950dfe311dc1b539cec5e74bf65a` — install, lint, typecheck, 37 tests, and production build |
| Phase 3A Pages | [Pages run 31491968688](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31491968688) | PASS on the same `main` SHA — production artifact build and Pages deployment both succeeded |
| Phase 3A public bilingual smoke | `https://yoesher.github.io/sociology-phd-desk/` | PASS — deployed JS/CSS asset hashes matched the final production build; Chinese fresh/default state, English switching and reload persistence, hash-route persistence, unchanged synthetic research content, 1280 and 390 × 844 layouts, mobile navigation, and zero application console warnings/errors were verified |
| `v0.1.0` deployed browser smoke | `https://yoesher.github.io/sociology-phd-desk/` | PASS — nine hash routes, light/dark, synthetic demo, task persistence across reload, confirmed demo restore, and zero application console errors at the release revision |
| `v0.1.0` remote CI | [CI run 31483003952](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31483003952) | PASS on release SHA `e9eadf2c2810c9a18a9f3a31ccdf659bd268c994` — install, lint, typecheck, 25 tests, and production build |
| `v0.1.0` Pages | [Pages run 31483003953](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31483003953) | PASS on the same release SHA; deployed URL verified as `https://yoesher.github.io/sociology-phd-desk/` |

The earlier `v0.1.0` browser pass created a clearly synthetic QA project, reloaded the page to prove IndexedDB and theme persistence, then deleted the record through its confirmation flow. JSON export displayed its versioned success filename. Demo reset opened a separate destructive confirmation and was cancelled. A Workspace modal positioning defect discovered during that pass was fixed with a document-body portal and re-verified at 1280 × 720. The browser console contained no warnings or errors at that revision.

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
- Phase 3A product-merge snapshot: local `main`, `origin/main`, and the GitHub API matched `bad788fac457950dfe311dc1b539cec5e74bf65a` before this documentation closeout. The `v0.1.0` tag is unchanged and still dereferences to the release commit `e9eadf2c2810c9a18a9f3a31ccdf659bd268c994`.
- Remote status: `origin` is restored to `https://github.com/Yoesher/sociology-phd-desk.git`. Phase 2 temporarily used a repository-scoped deploy key over GitHub's official SSH-over-443 transport because direct `github.com` Git HTTPS timed out; the key lived only under `.git`, was never tracked, and was revoked after the final status push.
- Push/merge status: PASS for Phase 3A merge SHA `bad788fac457950dfe311dc1b539cec5e74bf65a`; exact-`main` CI and Pages passed. The earlier release SHA `e9eadf2c2810c9a18a9f3a31ccdf659bd268c994` remains the immutable `v0.1.0` target.

## Release state

- Current GitHub release: [Sociology PhD Desk v0.1.0](https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.1.0).
- Published: `2026-08-11T10:42:22Z`; public, not a draft, and not a prerelease.
- Annotated tag: `v0.1.0`; local and remote tag object `06a81e2b10a20cc71440a3027544345cef6a04a5` dereferences to release SHA `e9eadf2c2810c9a18a9f3a31ccdf659bd268c994`.
- Release assets: no custom binary assets; GitHub provides generated source archives.
- Public project state after Phase 3A merge: 0 Stars, 0 Forks, 7 open Issues, 1 closed Issue, 0 open Pull Requests, 1 merged Pull Request, and 1 published Release. Issue [#7](https://github.com/Yoesher/sociology-phd-desk/issues/7) was closed as completed by merged PR [#9](https://github.com/Yoesher/sociology-phd-desk/pull/9); [#8](https://github.com/Yoesher/sociology-phd-desk/issues/8) records the later, source-gated China Research Map.
- External users/testers: 0 verified. Institutional adoption: none known.

## Next version objective

Phase 3A's gate is complete. The next implementation objective is Phase 3B, beginning with the scoped Research Question and Claim work in existing Issue [#1](https://github.com/Yoesher/sociology-phd-desk/issues/1). Phase 3C remains blocked behind Phase 3B and the source/provenance gates in Issue [#8](https://github.com/Yoesher/sociology-phd-desk/issues/8). Do not create `v0.2.0`, translate user-authored research content, or claim external adoption without evidence.

See [NEXT_TASKS.md](NEXT_TASKS.md) for the prioritized queue.
