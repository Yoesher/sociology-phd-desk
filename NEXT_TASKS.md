# Next Tasks

> Verified handoff queue after the public [`v0.1.0`](https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.1.0) release. Checked items have independent evidence; unchecked items remain future work.

## P0 — Phase 3A bilingual gate (complete)

- [x] Create and scope bilingual foundation Issue [#7](https://github.com/Yoesher/sociology-phd-desk/issues/7), separate from the research graph and China Research Map.
- [x] Work on the dedicated `feat/bilingual-localization` branch without changing the `v0.1.0` release.
- [x] Verify the final Chinese-first implementation with a clean install, lint, typecheck, 11 files / 37 tests, production build, and desktop/mobile browser smoke in both languages.
- [x] Open scoped Draft Pull Request [#9](https://github.com/Yoesher/sociology-phd-desk/pull/9) with `Closes #7`, the data-boundary statement, exact local checks, and browser evidence.
- [x] Pass exact-final-head [PR CI](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31491692818), complete maintainer self-review, and mark PR #9 ready only after both gates pass.
- [x] Squash-merge PR #9 as [`bad788f`](https://github.com/Yoesher/sociology-phd-desk/commit/bad788fac457950dfe311dc1b539cec5e74bf65a), then pass exact-`main` [CI](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31491968689), [Pages deployment](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31491968688), and public desktop/mobile browser smoke in Chinese and English.
- [x] Update this handoff, `PROJECT_STATE.md`, and the open-source evidence register with the final PR, commit, CI, Pages, repository description, and metric evidence.
- [x] Keep Phase 3B blocked until every Phase 3A gate passes; that prerequisite was satisfied before Phase 3B began, and Phase 3B has since completed its own gate.

## P0 — first authenticated publication (complete)

- [x] Install the official GitHub CLI and verify the authenticated account as `Yoesher` without placing a token in project files, shell history, or documentation.
- [x] Confirm the target did not exist, then create exactly one public repository: [Yoesher/sociology-phd-desk](https://github.com/Yoesher/sociology-phd-desk).
- [x] Add the verified repository as `origin`, push local `main`, and match the release SHA through local Git, Git transport, and the GitHub API.
- [x] Confirm [remote CI](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31483003952) passes `npm ci`, lint, typecheck, 25 tests, and build on the release SHA.
- [x] Enable GitHub Pages through Actions, verify the [release deployment run](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31483003953), and smoke-test the [deployed demo](https://yoesher.github.io/sociology-phd-desk/).
- [x] Re-run the public secret/data review and verify the README plus all three screenshot URLs through GitHub's rendering and Contents APIs.
- [x] Publish [`v0.1.0`](https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.1.0) only after remote CI passes; include supported workflows, narrower CRUD scope, privacy/backup model, known limitations, and roadmap in the release notes.
- [x] Update `PROJECT_STATE.md` and `docs/codex-for-oss.md` with source-backed repository, commit, CI, tag, release, Pages, Issues, and real metric evidence.

## P0 — Phase 3B Research Question / Claim graph (complete; merged and unreleased)

- [x] Implement the local Issue [#1](https://github.com/Yoesher/sociology-phd-desk/issues/1) candidate with first-class `ResearchQuestion`, `Claim`, and `ClaimQuestionLink` objects, stable IDs, same-project integrity, and protected deletion.
- [x] Add bilingual project-detail Research Questions, Claims, and Research Graph workflows without translating user-authored text.
- [x] Advance IndexedDB and portable workspace data to v3 with deterministic v1 → v2 → v3 migration, preserved legacy `Evidence.claim` text, exact-trimmed same-project Claim creation, and no inferred Claim↔ResearchQuestion links.
- [x] Add focused automated tests for migration, graph validation, collision safety, protected deletion, demo integrity, and bilingual UI behavior.
- [x] Run the complete final shared-revision local gate: clean install, lint, typecheck, 11 files / 55 tests, production build, diff check, Markdown links, and secret/private-data scan; record only actual results.
- [x] Complete Chinese and English desktop/mobile browser smoke for create, view, edit, link, unlink, protected delete, reload persistence, v3 export/import status, responsive layout, themes, keyboard basics, and zero application console errors; remove synthetic QA records and restore the clean v3 demo afterward.
- [x] Open scoped [PR #11](https://github.com/Yoesher/sociology-phd-desk/pull/11) from exact feature head `2c12911c82678077cf9f3687c9308473f2832bf9` with Issue #1 closure semantics and no Issue #2 implementation.
- [x] Pass both exact-feature-head [push](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31508742035/job/93836866829) and [Pull Request](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31508792720/job/93837034735) check jobs; complete [maintainer self-review](https://github.com/Yoesher/sociology-phd-desk/pull/11#issuecomment-5255455230) with P0 = 0 and P1 = 0; squash-merge PR #11 as [`a51a10f`](https://github.com/Yoesher/sociology-phd-desk/commit/a51a10febfb3e186aa1774c0110c27fdceec9f0e); pass exact-`main` [CI 31508962634](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31508962634) and [Pages 31508962638](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31508962638); confirm Issue #1 is CLOSED while Issue #2 remains OPEN. GitHub's outer Pull Request workflow record remained anomalously `in_progress` even though its sole check job was completed and passing.
- [x] Verify the public URL returns HTTP 200 and its deployed asset names/hashes match the final local build. Real public interaction smoke was NOT RUN because browser control returned `instances=[]`; retain this limitation rather than calling it a pass.
- [x] Unlock Phase 3C only after the Phase 3B merge and exact-`main` remote gates completed. Keep Phase 3B in `Unreleased`; do not create or move a v0.2.0 tag.

## P0 — Phase 3C Private Local Workspace (complete; merged, deployed, and unreleased)

- [x] Search existing Issues by title and create the scoped Issue [#13](https://github.com/Yoesher/sociology-phd-desk/issues/13), “feat: add private local workspaces, locking, and encrypted vault support,” without describing it as a sign-in or network-account system.
- [x] Create `codex/private-local-workspaces` from exact verified `main` `4f3d615c62959e4c84d8d72751414e978f5b123b`; keep package version `0.1.0`, preserve the `v0.1.0` tag, and do not begin Phase 3D.
- [x] Finalize and independently audit the local candidate: metadata-only registry; isolated per-workspace databases and unified alias guards; deterministic concurrent bootstrap; empty personal plus separate pristine-demo workspaces; edited legacy demo→personal classification; idempotent, non-destructive migration; create/select/rename/export/delete; pending-deletion automatic/UI retry; standard/encrypted modes; lock/auto-lock; cross-tab coordination; and safe recovery states. The final independent review recorded P0 = 0 and P1 = 0.
- [x] Verify the Web Crypto contract and failure boundaries: authenticated encryption, fresh salt/IV, secure-random fail-closed behavior, no persisted passphrase/key/verifier, generic authentication failure, wrong-passphrase/tamper zero-write behavior, manager/session poison, lifecycle-generation rejection of post-close/lock delayed refresh, lock-epoch and stale-session rejection, durable conversion reservation with authenticated existing-target retry/discard, flush-before-cleanup plus current-session authentication and stable source/target physical-name double locking, versioned `.sociologydesk` backup, restore as a new logical workspace, and no secure-erasure or password-reset claim.
- [x] Reconcile complete Chinese and English UI/documentation and verify that ordinary JSON and standard IndexedDB remain plainly identified as plaintext; registry display name/timestamps/mode/locator remain visible; encrypted data, shared-origin trust, unlocked-device compromise, and retained-plaintext cleanup limits remain visible.
- [x] Run the final shared-revision local gate: `npm ci`; lint with 0 warnings; typecheck; 23 Vitest files / 222 tests in 21.38 s; Vite 8.2.1 production build with 1,953 modules and no size warning; diff check; relative Markdown links; added-line secret/private-path scan; and real Chinese/English browser smoke at 1280 × 720 and 390 × 844. Browser QA covered standard-workspace isolation/CRUD/rename/lock/reopen, conversion copy/read-back, encrypted backup generation, explicit second-confirmation plaintext cleanup, encrypted lock/reload, generic wrong-passphrase handling, correct unlock, truthful privacy state, mobile overflow, CSP, and zero console warnings/errors. Synthetic QA workspaces/backups were deleted. Actual encrypted-backup import/restore was NOT RUN in the browser and remains automated-test evidence, not manual evidence.
- [x] Open scoped [PR #14](https://github.com/Yoesher/sociology-phd-desk/pull/14) from exact feature head `a6681fff763c66692126775a341ba64cafe546fc`, pass [push CI run 31551522108 / job 93975026534](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31551522108/job/93975026534) and [PR CI run 31551571303 / job 93975177107](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31551571303/job/93975177107), and complete [maintainer self-review](https://github.com/Yoesher/sociology-phd-desk/pull/14#issuecomment-5260782671) with P0 = 0 and P1 = 0.
- [x] Squash-merge PR #14 as [`f8b9ef9`](https://github.com/Yoesher/sociology-phd-desk/commit/f8b9ef94e67730955a4ab4b6fbe27f66ab3a5db9), close Issue #13, pass exact-`main` [CI run 31551698246 / job 93975560577](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31551698246/job/93975560577), and pass [Pages run 31551698215](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31551698215) build/deploy jobs `93975560485` / `93975708219` plus deployment `5861195664` at `https://yoesher.github.io/sociology-phd-desk/` on the same exact SHA.
- [x] Verify public HTTP 200, deployed `index-d7Ca3tI7.js` and `index-MceaPGZ1.css` matching the final local build, and a limited real public browser check at 1280 × 720: expected title, `zh-CN`, Demo, all nine modules, and `scrollWidth` 1265 ≤ 1280. English, mobile, workspace-interactive flows, and console/CSP inspection were NOT RUN because the browser bridge timed out; do not call this a complete public smoke pass.
- [x] Update the verified handoff and public evidence after the remote gates. Phase 3C is complete; keep it in `Unreleased`, leave package/release at `0.1.0` / `v0.1.0`, and require Phase 3D to pass its independent source/compliance gate before implementation.

## P0 — Phase 3D China Research Map (source/compliance gate BLOCKED)

- [x] Start Issue [#8](https://github.com/Yoesher/sociology-phd-desk/issues/8) on `codex/china-research-map` with an independent source/legal gate before any production map implementation.
- [x] Record the official-source review in [Chinese](docs/zh-CN/map-data-sources.md) and [English](docs/en/map-data-sources.md), including provider, URL, dataset, level, version, terms, redistribution, approval metadata, transformations, limitations, and update path.
- [x] Record the 2026-08-12 gate honestly: `MAP_SOURCE_VERIFIED=BLOCKED`, `MAP_LICENSE_VERIFIED=BLOCKED`, `MAP_APPROVAL_METADATA=BLOCKED`, and `NATIONAL_MAP_COMPLETENESS=BLOCKED/NOT TESTABLE`.
- [x] Keep the blocked branch free of map geometry, production administrative master data, external map services, unverified region persistence, and fabricated national-map UI.
- [x] Open documentation-only [Draft PR #16](https://github.com/Yoesher/sociology-phd-desk/pull/16), pass exact-head [push CI 31556499910](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31556499910) and [PR CI 31556578385](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31556578385), and record the [P0 = 0 / P1 = 0 documentation review](https://github.com/Yoesher/sociology-phd-desk/pull/16#issuecomment-5261353262) without marking it ready, closing Issue #8, or changing any map gate to PASS.
- [ ] Obtain written rights that expressly cover GitHub, Pages, global public access, forks, archives, extraction, format conversion, simplification, recoloring, responsive scaling, and interactive rendering.
- [ ] Obtain project-specific map-review approval for the final desktop/mobile/zoom/overlay/interaction output; record the review number, approved specimen, date, validity period, renewal owner, and exact asset hashes.
- [ ] Freeze authoritative, versioned national and Hong Kong/Macao/Taiwan hierarchy sources without inventing missing levels; document official English-name or deterministic transliteration provenance separately.
- [ ] Only after all source gates PASS, implement the first-class bilingual module and v4 migration/compatibility contract, including immutable source catalog, workspace-local geographic notes, optional source-qualified FieldSite region links, protected project deletion, standard/encrypted isolation, and v1 → v2 → v3 → v4 migration.
- [ ] Verify exact national completeness, hierarchy, keyboard/list parity, responsive no-cropping, offline asset fallback, privacy, JSON/encrypted round trips, and real browser behavior before making the PR ready or deploying it.
- [ ] Stop geographic organization at county level, never require or expose participant coordinates or exact locations, and never upload user notes or fieldwork data to GitHub Pages or a map service.

## P1 — Phase 3E hierarchical navigation, only after Phase 3D passes

- [ ] **BLOCKED by Phase 3D. Do not start until all four map gates, implementation, PR/CI/review, merge, exact-`main` CI, Pages, and public verification pass.**
- [ ] Implement at most two sidebar levels: primary research-work domains and secondary workflows or derived smart views.
- [ ] Keep secondary navigation decoupled from database enums; do not add persisted states merely to mirror menu labels.
- [ ] Preserve routes, deep links, bilingual parity, responsive/keyboard access, and content-area drill-down through the migration.

## P1 — Phase 3F stabilization and v0.2.0 release, only after Phase 3E passes

- [ ] **BLOCKED by Phase 3D and Phase 3E. Do not create, move, or publish a `v0.2.0` tag or Release.**
- [ ] Run the integrated data, privacy, map, navigation, migration, accessibility, responsive, bilingual, CI, Pages, and public-browser release gates.
- [ ] Reconcile bilingual documentation, privacy and map-source records, architecture decisions, changelog, screenshots, project state, and release notes with the exact verified revision.
- [ ] Create the v0.2.0 tag and formal release only after all earlier Phase 3 gates pass; never move `v0.1.0`.

## P2 — separate research-traceability backlog (not completed by Phase 3B)

- [ ] Add explicit bidirectional Claim ↔ Evidence ↔ Manuscript-location navigation and contradiction/limitation review without collapsing uncertainty into a score ([#2](https://github.com/Yoesher/sociology-phd-desk/issues/2)). Retained `Evidence.claim` text is not this relationship.
- [ ] Add variable, model, sample-restriction, robustness-check, code-version, and output metadata to analysis runs ([#3](https://github.com/Yoesher/sociology-phd-desk/issues/3)).
- [ ] Deepen Interview → transcript reference → code → memo → claim traceability while retaining privacy warnings ([#4](https://github.com/Yoesher/sociology-phd-desk/issues/4)).
- [ ] Retain fixture-based database and portable JSON migration coverage for every supported prior version; add human-readable import preflight, deterministic conflict reporting, and large-workspace guards ([#5](https://github.com/Yoesher/sociology-phd-desk/issues/5)).
- [ ] Add browser-level tests for route rendering, persistence, import/export, cross-tab conflicts, modal layering, and destructive confirmation paths at desktop and mobile viewports ([#6](https://github.com/Yoesher/sociology-phd-desk/issues/6)).
- [ ] Complete accessibility and cross-browser audits.
- [ ] Gather real, consented feedback from sociology researchers through issues or documented testing; do not infer adoption from page views or informal interest.

## P2 — ecosystem work after a stable core

- [ ] Repeat a real public Phase 3B interaction smoke when browser control exposes a usable instance; preserve the current `instances=[]` NOT RUN record until then.
- [ ] Upgrade GitHub Actions dependencies away from the runner's Node 20 deprecation annotations in a separate maintenance PR, then re-run CI and Pages; do not mix this maintenance with Phase 3B product changes.
- [ ] Evaluate Zotero integration against its official API and license while preserving the product boundary.
- [ ] Evaluate Crossref, OpenAlex, and ORCID metadata workflows with explicit network/privacy behavior.
- [ ] Design configurable Stata, R, and Python run references without committing local executable paths.
- [ ] Evaluate Word/DOCX, Markdown, and Quarto export/linking.
- [ ] Investigate NVivo/MAXQDA imports only if formats and licenses permit.
- [ ] Add optional AI-assisted workflows only with clear consent, provenance, and separation between source evidence and generated suggestion.
- [x] Configure GitHub Pages for a synthetic, browser-local demo: `https://yoesher.github.io/sociology-phd-desk/`.
- [ ] Maintain real repository metrics and external mentions in `docs/codex-for-oss.md` from verifiable sources.

## Explicitly out of scope

Do not prioritize social networking, chat, a research community, a Zotero replacement, a full Markdown editor, a large AI chatbot, payments, accounts, a cloud backend, complex permissions, or a native mobile app.
