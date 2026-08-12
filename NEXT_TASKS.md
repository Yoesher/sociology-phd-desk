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
- [x] Update the verified handoff and public evidence after the remote gates. Phase 3C is complete; keep it in `Unreleased`, leave package/release at `0.1.0` / `v0.1.0`, and require the independent source/compliance gate before any future map implementation.

## P0 — Phase 3D China Research Map compliance closeout (feature deferred from v0.2.0)

- [x] Start Issue [#8](https://github.com/Yoesher/sociology-phd-desk/issues/8) on `codex/china-research-map` with an independent source/legal gate before any production map implementation.
- [x] Record the official-source review in [Chinese](docs/zh-CN/map-data-sources.md) and [English](docs/en/map-data-sources.md), including provider, URL, dataset, level, version, terms, redistribution, approval metadata, transformations, limitations, and update path.
- [x] Record the 2026-08-12 gate honestly: `MAP_SOURCE_VERIFIED=BLOCKED`, `MAP_LICENSE_VERIFIED=BLOCKED`, `MAP_APPROVAL_METADATA=BLOCKED`, and `NATIONAL_MAP_COMPLETENESS=BLOCKED/NOT TESTABLE`.
- [x] Keep the blocked branch free of map geometry, production administrative master data, external map services, unverified region persistence, and fabricated national-map UI.
- [x] Open documentation-only [Draft PR #16](https://github.com/Yoesher/sociology-phd-desk/pull/16), pass its recorded exact-head CI checks, and retain the [P0 = 0 / P1 = 0 documentation review](https://github.com/Yoesher/sociology-phd-desk/pull/16#issuecomment-5261353262) without changing any map gate to PASS.
- [ ] Reconcile the final exact PR head so the audit remains `BLOCKED` while explicitly deferring and excluding China Research Map from `v0.2.0`; keep the diff documentation-only and pass CI.
- [ ] Mark PR #16 ready, complete an exact-head maintainer self-review, and squash-merge the compliance record without describing it as a map implementation.
- [ ] Close Issue #8 as `not planned` with a maintainer note explaining the unverified open-repository/Pages source, redistribution, transformation, and approval chain and the conditions for a future reopen.
- [ ] Preserve the future map requirements—written redistribution rights, project-specific approval, authoritative hierarchy, county-level privacy boundary, and full national completeness—but do not implement or continue source hunting in this release cycle.

## P0 — Phase 3E Theory Research workspace

- [ ] Search for or create `feat: add a theory research workspace for conceptual sociology`, then branch `feat/theory-research-workspace` from the latest verified `main` after the documentation closeout.
- [ ] Add only `TheoryMemo` as a new research entity; reuse ResearchQuestion, Claim, Literature, and Manuscript with stable, same-project ID relationships and protected deletion.
- [ ] Implement complete bilingual Theory CRUD and views for overview, questions/propositions, concepts, mechanisms, dialogue, counterarguments/boundaries, all memos, and theoretical manuscripts. Keep structured prompts UI-only.
- [ ] Add the locale-neutral Theory task category and minimal clearly synthetic demo memos without converting old tasks, logs, or notes.
- [ ] Advance portable and standard workspace schemas to v4 with explicit v1 → v2 → v3 → v4 migration; keep encrypted container v1 independent and support authenticated encrypted portable-v3 workspace and backup migration without damaging old ciphertext on failure.
- [ ] Pass clean install, lint, typecheck, full tests, build, bilingual desktop/mobile real-browser verification, exact PR CI, self-review, squash merge, exact-`main` CI, and Pages before navigation work begins.

## P0 — Phase 3F hierarchical navigation and integrated publishing, only after Theory passes

- [ ] Implement at most two sidebar levels: primary research-work domains and secondary workflows or derived smart views.
- [ ] Keep secondary navigation decoupled from database enums; do not add persisted states merely to mirror menu labels.
- [ ] Fix the nine primary modules as Today, Projects, Literature, Theory Research, Fieldwork, Quantitative, Evidence, Research Log, and Manuscripts & Publishing; keep workspace/settings separate at the bottom.
- [ ] Add the specified smart views, badges, breadcrumbs, compact flyouts, mobile accordion, deep-link query views, restrained context-aware Quick Add, and truly-empty personal-workspace onboarding without mutating research data merely by switching views.
- [ ] Present Manuscript, Submission, and ReviewerComment together while keeping their schemas independent; preserve `#/manuscripts` and `#/submissions` through compatibility redirects.
- [ ] Pass the full automated and real Chinese/English desktop/mobile browser gate, exact PR CI, self-review, squash merge, exact-`main` CI, and Pages before release work begins.

## P0 — Phase 3G v0.2.0 stabilization and release, only after navigation passes

- [ ] Declare `FEATURE FREEZE FOR v0.2.0`; accept only P0/P1 release bugs, documentation, screenshots, version/changelog, accessibility, migration, and security fixes.
- [ ] Create `release/0.2.0` from verified `main`, update package/lockfile to `0.2.0`, and keep portable schema, standard database schema, encrypted vault schema, encrypted container, and package version as independently documented axes.
- [ ] Run the integrated bilingual, graph, Theory, private/encrypted workspace, lock/backup, navigation, publishing, old-route, v4 migration, accessibility, responsive, secret-audit, CI, Pages, and public-browser release gates.
- [ ] Reconcile bilingual README, privacy records, retained map deferral evidence, architecture decisions, changelog, screenshots, project state, evidence register, and release notes with the exact verified revision.
- [ ] Merge the release PR only with P0 = 0 and P1 = 0, verify exact `main` CI/Pages/public behavior, then create an annotated `v0.2.0` tag and a non-draft, non-prerelease GitHub Release; never move `v0.1.0`.

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
