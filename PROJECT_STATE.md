# Project State

> Last updated: 2026-08-12
> Status: Phase 0, Phase 1, Phase 2, Phase 3A, and Phase 3B complete; Phase 3B was squash-merged through [PR #11](https://github.com/Yoesher/sociology-phd-desk/pull/11) as [`a51a10f`](https://github.com/Yoesher/sociology-phd-desk/commit/a51a10febfb3e186aa1774c0110c27fdceec9f0e), with exact-`main` CI and Pages passing; static public deployment checks passed, but real public interaction smoke was not run because browser control returned `instances=[]`; Phase 3C is unlocked and next; `v0.1.0` remains the verified public release
> Canonical local project path: `D:\phddesk`

This file is the factual handoff record for maintainers and future Codex sessions. Update it at the end of every development session. Never infer passing checks, repository activity, users, or releases.

## Current version

- Package version: `0.1.0`
- Release status: [`v0.1.0`](https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.1.0) published and verified
- Next release target: gated `v0.2.0` after the remaining Phase 3C–3F work; no date is promised and no intermediate phase may create or move the tag

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
- Merged Phase 3B adds stable-ID `ResearchQuestion`, `Claim`, and `ClaimQuestionLink` domain objects, same-project relationship validation, protected deletion, IndexedDB schema v3, and portable workspace v3.
- Vitest and Testing Library for tests; `fake-indexeddb` for persistence tests.
- Oxlint, TypeScript project checks, and Vite production build as quality gates.
- No server, account, default cloud synchronization, analytics, or required AI API in the core architecture.

See [DECISIONS.md](DECISIONS.md) and [docs/architecture/overview.md](docs/architecture/overview.md).

## Current functional state

Verified `main` at [`a51a10f`](https://github.com/Yoesher/sociology-phd-desk/commit/a51a10febfb3e186aa1774c0110c27fdceec9f0e) contains the published `v0.1.0` foundation plus merged, unreleased Phase 3A bilingual and Phase 3B research-graph implementations:

- responsive application shell, desktop/mobile navigation, route-level code splitting, and persistent light/dark theme;
- the merged Phase 3A implementation with Chinese as the fresh-install default, immediate persistent Chinese/English switching, locale-aware dates/numbers/validation, stable persisted enum values, and no automatic translation of user-authored content;
- all nine routes: Today, Projects, Literature, Fieldwork, Quantitative, Evidence, Research Log, Manuscripts, and Submissions;
- full create, inspect, edit, and protected-delete flows for Projects, Evidence, Field Sites, Interviews, and Field Visits;
- focused creation, filtering, status, and registry workflows for Today tasks, Literature, Datasets/Analysis Runs, Research Log, Manuscripts, Submissions, and Reviewer Comments;
- a fully synthetic bundled demo workspace with visible demo state and no fabricated DOI, statistical result, source publication, participant narrative, or real place;
- browser-local IndexedDB v3 persistence with a tested v1 → v2 → v3 migration, whole-workspace validation, generation-aware queued writes, optimistic revision checks, stale-tab/dependent-write cancellation, and same-origin refresh broadcasts;
- validated portable JSON v3 export/import with explicit v1 → v2 → v3 migration, preview, merge collision counts, explicit replacement, and destructive reset confirmation;
- fieldwork privacy warnings and cross-project relationship guards;
- Chinese-default documentation with complete reciprocal English README/contribution guides, contributor/security infrastructure, issue forms, CI, and sanitized screenshots.

Projects, Evidence, and Fieldwork are the deepest CRUD modules in this release. Other modules intentionally provide narrower registry/status workflows; the READMEs do not claim full CRUD parity.

Merged, unreleased Phase 3B adds:

- first-class `ResearchQuestion` and `Claim` objects with stable IDs, project IDs, authored text, locale-neutral statuses, notes, timestamps, and explicit demo markers;
- stable-ID `ClaimQuestionLink` records for an explicit many-to-many relationship whose question, claim, and link must all belong to the same project;
- complete bilingual project-detail workflows for creating, inspecting, editing, linking, and deleting unreferenced research questions and analytical claims, plus a Research Graph view of explicit and unlinked records;
- protected deletion for linked questions and claims, and project deletion that counts graph records as dependencies rather than silently cascading them;
- IndexedDB schema v3 and portable workspace v3 with explicit deterministic v1 → v2 → v3 migration;
- migration of non-empty legacy `Project.researchQuestion` values to first-class questions and deterministic same-project Claim creation from exact-trimmed legacy `Evidence.claim` text, while leaving each original evidence string unchanged;
- no semantic or fuzzy merge, automatic rewriting, or inferred Claim↔ResearchQuestion links during migration.

Issue [#2](https://github.com/Yoesher/sociology-phd-desk/issues/2) remains unimplemented: v3 retains `Evidence.claim` as source-context free text and does not add an evidence `claimId` or an explicit Evidence↔Claim relationship.

## Validation status

Recorded on 2026-08-11. The Phase 3A final candidate passed local verification after the final accessibility and responsive fixes. Pull Request final-head CI, maintainer self-review, squash merge, exact-`main` CI, Pages deployment, and bilingual public browser verification then passed. The published `v0.1.0` release and annotated tag remain unchanged; Phase 3A is merged on `main` but not presented as a new release.

The final Phase 3B feature head `2c12911c82678077cf9f3687c9308473f2832bf9` passed its recorded local automated and real-browser gates on 2026-08-11. PR #11 was then reviewed and squash-merged as exact `main` SHA `a51a10febfb3e186aa1774c0110c27fdceec9f0e`; exact-`main` CI and Pages succeeded. The deployed URL returned HTTP 200 and its asset names/hashes matched the final local build. Real public interaction smoke was not executed because browser control exposed no usable instance (`instances=[]`), so that check is explicitly NOT RUN rather than PASS.

| Phase 3B local candidate check | Command or target | Recorded result |
| --- | --- | --- |
| Clean install | `npm ci` | PASS — 126 packages installed from the lockfile |
| Lint | `npm run lint` | PASS — Oxlint exited 0 with no findings |
| Type check | `npm run typecheck` | PASS — TypeScript build check exited 0 |
| Tests | `npm test -- --run` | PASS — 11 files, 55 tests |
| Production build | `npm run build` | PASS — Vite 8.2.1 transformed 1,928 modules; largest `vendor` chunk 402.70 kB / 125.99 kB gzip; no oversized-chunk warning |
| Repository hygiene | `git diff --check`, Markdown link check, and added-line secret/private-path scan | PASS — no whitespace errors, broken relative links, secret-pattern matches, private research files, or personal-machine paths |
| Local browser smoke | `http://127.0.0.1:41739/` | PASS — Chinese and English project graph; create/edit/view; one Claim linked to two same-project questions; raw `active` value; reload persistence; explicit unlink; protected delete; top-layer Escape; light/dark and locale persistence; v3 export and validated import preview; normal desktop and 390 × 844 mobile layouts; no horizontal overflow; zero application console warnings/errors. Only clearly synthetic QA text was used, then removed, and the clean bundled v3 demo was restored. |
| Phase 3B Pull Request | [PR #11](https://github.com/Yoesher/sociology-phd-desk/pull/11) | MERGED — exact feature head `2c12911c82678077cf9f3687c9308473f2832bf9`; [maintainer self-review](https://github.com/Yoesher/sociology-phd-desk/pull/11#issuecomment-5255455230) recorded P0 = 0 and P1 = 0; squash-merged as `a51a10febfb3e186aa1774c0110c27fdceec9f0e` and closed Issue #1. |
| Phase 3B feature-head checks | [push check job](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31508742035/job/93836866829) and [Pull Request check job](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31508792720/job/93837034735) | PASS — `gh pr checks 11` reported both jobs passing and both job records completed with `success`. GitHub's outer record for Pull Request run 31508792720 still reported `in_progress` with no conclusion on 2026-08-12 despite its sole job having completed successfully; this metadata anomaly is retained rather than silently rewritten. |
| Phase 3B exact-`main` CI | [CI run 31508962634](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31508962634) | PASS on `a51a10febfb3e186aa1774c0110c27fdceec9f0e`. |
| Phase 3B Pages | [Pages run 31508962638](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31508962638) | PASS on the same exact `main` SHA. |
| Phase 3B public static deployment | `https://yoesher.github.io/sociology-phd-desk/` | VERIFIED — HTTP 200; deployed asset names/hashes matched the final local production build. |
| Phase 3B public interaction smoke | `https://yoesher.github.io/sociology-phd-desk/` | NOT RUN — browser control returned `instances=[]`; no real deployed-page interaction was executed, so this is not a PASS. |

The exported browser-smoke snapshot was independently parsed as application `sociology-phd-desk`, portable version 3, two questions, three claims, two links, and zero evidence `claimId` properties. Its import preview reported seven research-graph records and required a separate review/confirmation before any write; the merge was cancelled because no destructive or duplicate write was needed.

Historical merged/released evidence follows:

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
| Phase 3A documentation-closeout `main` CI | [CI run 31493245445](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31493245445) | PASS on `d37f5d480932fe511cb505b16cb57adf29fc2805` after merged closeout PR #10 |
| Phase 3A documentation-closeout Pages | [Pages run 31493245443](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31493245443) | PASS on the same final Phase 3A `main` SHA |
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
- Verified `main` now uses database and portable workspace v3 with an explicit v1 → v2 → v3 path; long-term compatibility still requires retained fixtures and upgrade tests from every supported prior version.
- Issue #2 remains open work: retained `Evidence.claim` text is not an explicit Evidence↔Claim link, and Claim↔manuscript-location navigation is not implemented by Phase 3B.
- Phase 3B public static deployment evidence is complete, but real public interaction smoke remains unexecuted because browser control returned `instances=[]`; repeat it when a usable browser instance is available without retroactively calling the missing check a pass.
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
- Final Phase 3A base: local `main` and the locally recorded `origin/main` ref matched `d37f5d480932fe511cb505b16cb57adf29fc2805`, the squash merge of documentation-closeout PR #10. The product implementation itself was merged through PR #9 as `bad788fac457950dfe311dc1b539cec5e74bf65a`. The `v0.1.0` tag is unchanged and still dereferences to release commit `e9eadf2c2810c9a18a9f3a31ccdf659bd268c994`.
- Remote status: `origin` is restored to `https://github.com/Yoesher/sociology-phd-desk.git`. Phase 2 temporarily used a repository-scoped deploy key over GitHub's official SSH-over-443 transport because direct `github.com` Git HTTPS timed out; the key lived only under `.git`, was never tracked, and was revoked after the final status push.
- Push/merge status: Phase 3A product PR #9 and closeout PR #10 are merged. Phase 3B PR [#11](https://github.com/Yoesher/sociology-phd-desk/pull/11) is squash-merged from feature head `2c12911c82678077cf9f3687c9308473f2832bf9` as exact `main` SHA `a51a10febfb3e186aa1774c0110c27fdceec9f0e`; Issue [#1](https://github.com/Yoesher/sociology-phd-desk/issues/1) is CLOSED and Issue [#2](https://github.com/Yoesher/sociology-phd-desk/issues/2) remains OPEN.
- Phase 3B remote checks: exact-`main` [CI 31508962634](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31508962634) and [Pages 31508962638](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31508962638) succeeded. The earlier release SHA `e9eadf2c2810c9a18a9f3a31ccdf659bd268c994` remains the immutable `v0.1.0` target.

## Release state

- Current GitHub release: [Sociology PhD Desk v0.1.0](https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.1.0).
- Published: `2026-08-11T10:42:22Z`; public, not a draft, and not a prerelease.
- Annotated tag: `v0.1.0`; local and remote tag object `06a81e2b10a20cc71440a3027544345cef6a04a5` dereferences to release SHA `e9eadf2c2810c9a18a9f3a31ccdf659bd268c994`.
- Phase 3A and Phase 3B changes remain under [`Unreleased`](CHANGELOG.md#unreleased); no v0.2.0 tag or Release exists, and the v0.1.0 tag has not moved.
- Release assets: no custom binary assets; GitHub provides generated source archives.
- Current verified public project snapshot: 1 Star, 0 Forks, 6 open Issues, 2 closed Issues, 0 open Pull Requests, 3 merged Pull Requests, and 1 published Release. A Star is repository activity, not evidence of a user, tester, endorsement, or adoption.
- External users/testers: 0 verified in project records; the true number is unknown. Institutional adoption: none known.

## Next version objective

Phase 3A and Phase 3B gates are complete. Phase 3B is merged on `main` and deployed but remains `Unreleased`; Issue [#1](https://github.com/Yoesher/sociology-phd-desk/issues/1) is closed. Phase 3C private local workspaces are now unlocked and are the next objective: search existing Issues by title before selecting or creating the scoped task, and do not treat a local workspace as a network account. Issue [#2](https://github.com/Yoesher/sociology-phd-desk/issues/2) remains separate, OPEN, and unimplemented. The China Research Map remains Phase 3D and retains the source/provenance gate in Issue [#8](https://github.com/Yoesher/sociology-phd-desk/issues/8). Do not create `v0.2.0`, move `v0.1.0`, translate user-authored research content, or claim external adoption without evidence.

See [NEXT_TASKS.md](NEXT_TASKS.md) for the prioritized queue.
