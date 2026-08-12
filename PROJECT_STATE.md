# Project State

> Last updated: 2026-08-12
> Status: `v0.2.0` release finalization is complete. Release PR [#21](https://github.com/Yoesher/sociology-phd-desk/pull/21) passed exact-head CI and P0 = 0 / P1 = 0 maintainer review, then squash-merged as exact release revision [`eb399f7`](https://github.com/Yoesher/sociology-phd-desk/commit/eb399f7da0a1f3142f7c8361492fa86b08db77db). Exact-`main` CI and Pages passed on that revision; annotated tag `v0.2.0` points to it; and [Sociology PhD Desk v0.2.0](https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.2.0) is the latest non-draft, non-prerelease Release. Phase 3D remains a documentation-only map deferral with all four gates **BLOCKED** and no map shipped. No `v0.3.0` work has started.
> Canonical local project path: `D:\phddesk`

This file is the factual handoff record for maintainers and future Codex sessions. Update it at the end of every development session. Never infer passing checks, repository activity, users, or releases.

## Current version

- Package version: `0.2.0` on exact release SHA `eb399f7da0a1f3142f7c8361492fa86b08db77db`
- Release status: [`v0.2.0`](https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.2.0) is published, latest, non-draft, and non-prerelease; annotated tag object `abd24b42…` points to exact release SHA `eb399f7da0a1f3142f7c8361492fa86b08db77db`
- Current target: stop after release documentation closeout. Do not begin `v0.3.0` without a separately scoped plan; retain the China Research Map deferral and do not move either existing release tag

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

The following bullets describe released `v0.2.0` at exact verified release revision `eb399f7da0a1f3142f7c8361492fa86b08db77db`, including Phase 3A / 3B / 3C / 3E / 3F and the documentation-only Phase 3D closeout.

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

### Phase 3C architecture (released in `v0.2.0`)

- A schema-v1 `sociology-phd-desk-registry` database stores only local routing/recovery metadata. Canonical display name, timestamps, workspace kind/mode, auto-lock, migration/cleanup/deletion truth, interrupted-conversion reservation, schema versions, registry revision, and opaque storage locators remain plaintext; research content, passphrases, keys, verifiers, and content digests do not belong there.
- Each standard personal or synthetic-demo workspace has a separate IndexedDB database. Phase 3C introduced this boundary at standard/portable v3; current `main` extends it to v4 through the Theory migration. Concurrent first boots converge on deterministic seed routes. Fresh personal data is empty; only an exact pristine legacy fixture remains demo, while an edited legacy demo becomes personal and gets a separate pristine demo companion.
- An encrypted workspace has a separate schema-v1 vault database containing one authenticated ciphertext record and plaintext CAS coordinates. It has no research-domain tables or plaintext workspace name.
- Encrypted container v1 uses Web Crypto PBKDF2-HMAC-SHA-256 (600,000 iterations, fresh 16-byte salt) and AES-256-GCM (non-extractable 256-bit key, fresh 12-byte IV, 128-bit tag, canonical header as AAD). Current version axes are container v1, portable/standard v4, registry database v1, and encrypted-vault database v1.
- A session manager and access gate bind the UI to one ready workspace, keep encrypted keys runtime-only, unmount research routes while locked, and coordinate cooperating tabs without broadcasting passphrases, keys, or research content. Route invalidation, manager close, missing physical storage, or authenticated vault tamper poisons the affected session and clears its cached snapshot. Encrypted async operations recheck a lifecycle generation after awaited storage/crypto work, so close or lock prevents delayed refresh from reviving the runtime.
- Legacy-singleton migration and standard-to-encrypted conversion use physical-name preflight plus staged copy/read-back/validation/publication. Conversion durably reserves its encrypted target before creation; an existing interrupted target requires passphrase authentication and workspace-identity proof for retry or discard, while a confirmed-absent target can have its empty reservation cleared without a passphrase. Plaintext cleanup first flushes pending writes, then requires the current authenticated encrypted session and holds stable lexically ordered locks on the encrypted target and source physical database names while checking route, source identity, and aliases. Plaintext sources remain recorded until cleanup succeeds; deletion is recoverable logical deletion rather than secure erasure.

This architecture was merged through PR #14 and is included in the formal `v0.2.0` Release.

### Phase 3E architecture (released in `v0.2.0`)

- `TheoryMemo` is the only new theory-specific entity. It belongs to one project, has one of six locale-neutral types (`concept`, `mechanism`, `dialogue`, `counterargument`, `boundary`, `synthesis`), and may reference existing same-project ResearchQuestion, Claim, and Literature records by stable ID. Manuscript remains the writing entity.
- Missing endpoints, cross-project relationships, and duplicate IDs within any memo relationship array are invalid. A referenced project, question, claim, or literature record cannot be deleted until the memo relationship is removed. Deleting a memo removes only that memo and never its endpoints.
- Portable `WorkspaceData` and standard per-workspace IndexedDB storage are v4 in `v0.2.0`. The only v3 → v4 semantic change is `theoryMemos: []`; no old log, note, task, claim, or other text becomes a theory memo. Supported import/migration composes v1 → v2 → v3 → v4.
- Encrypted container v1, encrypted-vault database v1, and registry database v1 do not advance. Existing authenticated portable-v3 vaults or backups migrate only after authentication and complete v4 read-back validation; failure retains the old ciphertext and publishes no partial route/storage update.
- The stable task category is `Theory / Conceptual Work`. It is stored as a locale-neutral raw value and localized only for display.

### Phase 3F architecture (released in `v0.2.0`)

- Nine research-work primary modules have one URL-addressable secondary Smart View level, plus a separate Workspace & Settings utility area. Secondary views are derived presentation filters and do not add persisted status values or mutate research data when opened.
- Manuscript, Submission, and ReviewerComment remain independent entities. They are presented through one Manuscripts & Publishing area, with legacy manuscript/submission routes redirected to the complete publishing view.
- The application shell provides an active breadcrumb, context-aware Quick Add, compact keyboard-operable flyout, complete mobile More accordion, responsive desktop/mobile layouts, and true-empty personal-workspace onboarding.

## Current functional state

Released `v0.2.0` at exact `main` [`eb399f7`](https://github.com/Yoesher/sociology-phd-desk/commit/eb399f7da0a1f3142f7c8361492fa86b08db77db) contains the `v0.1.0` foundation plus Phase 3A bilingual, Phase 3B research graph, Phase 3C private local workspaces, Phase 3E Theory Research, and Phase 3F hierarchical navigation/integrated publishing, following the Phase 3D documentation-only map deferral. The Phase 3B product change itself was squash-merged as [`a51a10f`](https://github.com/Yoesher/sociology-phd-desk/commit/a51a10febfb3e186aa1774c0110c27fdceec9f0e):

- responsive application shell, desktop/mobile navigation, route-level code splitting, and persistent light/dark theme;
- the merged Phase 3A implementation with Chinese as the fresh-install default, immediate persistent Chinese/English switching, locale-aware dates/numbers/validation, stable persisted enum values, and no automatic translation of user-authored content;
- nine current primary domains: Today, Projects, Literature, Theory Research, Fieldwork, Quantitative, Evidence, Research Log, and Manuscripts & Publishing;
- full create, inspect, edit, and protected-delete flows for Projects, Evidence, Field Sites, Interviews, and Field Visits;
- focused creation, filtering, status, and registry workflows for Today tasks, Literature, Datasets/Analysis Runs, Research Log, Manuscripts, Submissions, and Reviewer Comments;
- a fully synthetic bundled demo workspace with visible demo state and no fabricated DOI, statistical result, source publication, participant narrative, or real place;
- browser-local IndexedDB v4 persistence with tested v1 → v2 → v3 → v4 migration, whole-workspace validation, generation-aware queued writes, optimistic revision checks, stale-tab/dependent-write cancellation, and same-origin refresh broadcasts;
- validated portable JSON v4 export/import with explicit v1 → v2 → v3 → v4 migration, preview, merge collision counts, explicit replacement, and destructive reset confirmation;
- fieldwork privacy warnings and cross-project relationship guards;
- Chinese-default documentation with complete reciprocal English README/contribution guides, contributor/security infrastructure, issue forms, CI, and sanitized screenshots.

Projects, Evidence, and Fieldwork are the deepest CRUD modules in this release. Other modules intentionally provide narrower registry/status workflows; the READMEs do not claim full CRUD parity.

Released Phase 3B adds:

- first-class `ResearchQuestion` and `Claim` objects with stable IDs, project IDs, authored text, locale-neutral statuses, notes, timestamps, and explicit demo markers;
- stable-ID `ClaimQuestionLink` records for an explicit many-to-many relationship whose question, claim, and link must all belong to the same project;
- complete bilingual project-detail workflows for creating, inspecting, editing, linking, and deleting unreferenced research questions and analytical claims, plus a Research Graph view of explicit and unlinked records;
- protected deletion for linked questions and claims, and project deletion that counts graph records as dependencies rather than silently cascading them;
- IndexedDB schema v3 and portable workspace v3 with explicit deterministic v1 → v2 → v3 migration;
- migration of non-empty legacy `Project.researchQuestion` values to first-class questions and deterministic same-project Claim creation from exact-trimmed legacy `Evidence.claim` text, while leaving each original evidence string unchanged;
- no semantic or fuzzy merge, automatic rewriting, or inferred Claim↔ResearchQuestion links during migration.

Issue [#2](https://github.com/Yoesher/sociology-phd-desk/issues/2) remains unimplemented: v3 retains `Evidence.claim` as source-context free text and does not add an evidence `claimId` or an explicit Evidence↔Claim relationship.

### Phase 3C functional state (released in `v0.2.0`)

The merged Phase 3C implementation provides:

- creating, selecting, opening, renaming, exporting, and deleting isolated local workspaces through a metadata-only registry;
- a separate empty personal workspace and resettable synthetic demo workspace, deterministic concurrent bootstrap, edited-legacy-demo preservation as personal data, and deletion tombstones with automatic/bootstrap plus UI-discoverable retry;
- idempotent, non-destructive copy and read-back verification from the legacy `sociology-phd-desk` singleton without automatic source deletion;
- standard plaintext workspaces, optional encrypted workspaces, immediate lock, Never/5/15/30/60-minute auto-lock choices, reload-locked encrypted sessions, and bilingual lock/unlock interfaces;
- staged standard-to-encrypted conversion with a durable target reservation, authenticated retry/discard for an existing target, source recheck, and route publication only after stored-ciphertext read-back, complete v4 validation, and semantic equality, while retaining plaintext recovery truth until separately authenticated and identity-checked cleanup;
- ordinary plaintext JSON import/export plus distinct `.sociologydesk` encrypted backup/restore-as-new-workspace behavior; both payloads receive an export-only copy of the canonical registry display name without advancing the workspace-data revision;
- a bilingual Workspace Center, Privacy Center, and threat-model documentation that distinguish browser isolation, interface locking, encrypted storage, shared-origin code, and device compromise.

These features entered verified `main` before Theory and navigation and remain present in exact release SHA `eb399f7da0a1f3142f7c8361492fa86b08db77db` as part of `v0.2.0`.

### Phase 3E functional state (released in `v0.2.0`)

The merged Theory implementation provides complete Chinese and English Theory Memo create/read/update/delete flows; project, type, and updated-date filters; overview, questions/propositions, core concepts, mechanisms, theoretical dialogue, counterarguments/boundaries, all-memos, and theoretical-manuscript views; explicit links to same-project questions, claims, and literature; project and endpoint deletion protection; UI-only structured prompts that never insert stored prose; Theory task-category display/filtering; and a minimal synthetic demo with two memos. The whole fixture contains two projects, two research questions, three claims, and three `ClaimQuestionLink` records. Its concept memo references one question; its mechanism memo references that same question and one claim; neither references literature. It makes no real citation, finding, or theoretical-conclusion claim. A fresh personal workspace remains empty.

Theory [PR #18](https://github.com/Yoesher/sociology-phd-desk/pull/18) was reviewed with P0 = 0 / P1 = 0 and squash-merged as [`b8c8c60`](https://github.com/Yoesher/sociology-phd-desk/commit/b8c8c60434b1d88c348f83c5d08f2d19770db78a). Exact-main [CI run 31576643318 / job 94050153842](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31576643318/job/94050153842) and [Pages run 31576643397](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31576643397) (build `94050153623`, deploy `94050362595`, [deployment `5865496339`](https://github.com/Yoesher/sociology-phd-desk/deployments/5865496339)) passed. It is included in `v0.2.0`.

## Validation status

### Phase 3C — complete and released in `v0.2.0`

Recorded on 2026-08-12 against exact feature head `a6681fff763c66692126775a341ba64cafe546fc`, followed through squash merge and deployment at exact `main` `f8b9ef94e67730955a4ab4b6fbe27f66ab3a5db9`.

| Phase 3C gate | Current factual state |
| --- | --- |
| Final clean install and static gates | PASS — `npm ci` installed 126 lockfile packages; `npm run lint` exited 0 with 0 warnings; `npm run typecheck` exited 0 |
| Final integrated Vitest run | PASS — 23 files, 222 tests in 21.38 s, covering the assembled migration, isolation, encryption, lock, backup/restore logic, demo, locale, session lifecycle, and cross-tab boundaries |
| Production build | PASS — Vite 8.2.1 transformed 1,953 modules; `index.html` 1.31 kB / 0.67 kB gzip, CSS 75.00 kB / 13.81 kB gzip, i18n 145.49 kB / 36.93 kB gzip, main 226.07 kB / 52.32 kB gzip, and vendor 406.49 kB / 127.16 kB gzip; no size warning |
| Repository diff, relative Markdown links, secret/private-path and research-data scan | PASS — final diff check, relative-link validation, and added-line secret/private-path review found no error or prohibited data |
| Desktop/mobile Chinese/English browser smoke | PASS — local `127.0.0.1:41739` at 1280 × 720 and 390 × 844; immediate `zh-CN`/`en` switching updated `html lang`; all nine modules and mobile More remained reachable; no mobile horizontal overflow |
| Workspace and privacy browser workflows | PASS — standard-workspace create, project CRUD, cross-workspace isolation, rename, lock/reload/reopen; standard→encrypted copy/read-back; encrypted backup generation; explicit second-confirmation retained-plaintext cleanup; encrypted lock/reload; generic wrong-passphrase failure with cleared input; correct unlock; truthful locked/unlocked Privacy Center state |
| Browser hygiene and cleanup | PASS — CSP produced no console error; application console warnings/errors were 0; all synthetic QA workspaces and downloaded QA backups were deleted. Actual encrypted-backup import/restore was NOT RUN in the browser; its authenticated restore-as-new and zero-write failure behavior remains covered by automated tests rather than claimed as manual evidence |
| Independent security and maintainer P0/P1 review | PASS — P0 = 0 and P1 = 0 |
| Phase 3C Pull Request and feature-head CI | PASS — [PR #14](https://github.com/Yoesher/sociology-phd-desk/pull/14) used exact head `a6681fff763c66692126775a341ba64cafe546fc`; [push CI run 31551522108 / job 93975026534](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31551522108/job/93975026534) and [PR CI run 31551571303 / job 93975177107](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31551571303/job/93975177107) both completed successfully |
| Maintainer self-review and merge | PASS — [self-review](https://github.com/Yoesher/sociology-phd-desk/pull/14#issuecomment-5260782671) recorded P0 = 0 and P1 = 0; PR #14 was squash-merged as [`f8b9ef9`](https://github.com/Yoesher/sociology-phd-desk/commit/f8b9ef94e67730955a4ab4b6fbe27f66ab3a5db9), and Issue [#13](https://github.com/Yoesher/sociology-phd-desk/issues/13) is CLOSED |
| Exact-`main` CI | PASS — [CI run 31551698246 / job 93975560577](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31551698246/job/93975560577) succeeded on `f8b9ef94e67730955a4ab4b6fbe27f66ab3a5db9` |
| Pages build and deployment | PASS — [Pages run 31551698215](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31551698215) succeeded on the same exact SHA; build job `93975560485`, deploy job `93975708219`, and [deployment 5861195664](https://github.com/Yoesher/sociology-phd-desk/deployments/5861195664) published `https://yoesher.github.io/sociology-phd-desk/` |
| Public static deployment | PASS — the public URL returned HTTP 200; deployed `index-d7Ca3tI7.js` and `index-MceaPGZ1.css` matched the final local production assets |
| Public desktop browser check | LIMITED PASS — at 1280 × 720, the deployed page showed the expected title, `zh-CN`, the Demo state, and all nine modules; `scrollWidth` was 1265 ≤ 1280. English, mobile, workspace-interactive flows, and console/CSP inspection were NOT RUN because the browser bridge timed out; this is not a complete public interaction smoke pass |

Phase 3C is complete. The Phase 3D mandatory source and compliance review is **BLOCKED**. No production map code, administrative catalog, geometry, external map service, or region-writing workflow was added. ADR-015 now defers this feature outside `v0.2.0`; the blocked result continues to govern any future map implementation without blocking the release's non-map work.

## Phase 3D source and compliance gate

Recorded on 2026-08-12 on `codex/china-research-map`, based on local base `7078eaeddad236adf9b864e35ff20607e8c61768`. This is a source-gate result, not a completed feature or release gate.

| Mandatory gate | Result | Evidence boundary |
| --- | --- | --- |
| `MAP_SOURCE_VERIFIED` | **BLOCKED** | Authoritative standard maps, national base geography, and administrative codes were identified, but no verified source set satisfies the required hierarchy, public redistribution, and interactive-transformation scope |
| `MAP_LICENSE_VERIFIED` | **BLOCKED** | The reviewed national base-data terms do not authorize bundling in GitHub, Pages, public forks, or archives; local Hong Kong open data does not clear the national gate |
| `MAP_APPROVAL_METADATA` | **BLOCKED** | The project has no project-specific approval file, review number, approved final specimen, date, validity period, or renewal record for the actual interactive output |
| `NATIONAL_MAP_COMPLETENESS` | **BLOCKED / NOT TESTABLE** | Without an authorized final asset, the required 34 province-level units, Hong Kong, Macao, Taiwan, South China Sea islands, Diaoyu Dao, source-driven hierarchy, county endpoint, and no-cropping checks cannot be honestly run |

The bilingual evidence register is [Chinese](docs/zh-CN/map-data-sources.md) / [English](docs/en/map-data-sources.md). It records the Ministry of Natural Resources Standard Map Service, the National Catalogue Service for Geographic Information, Ministry of Civil Affairs division codes, Hong Kong and Macao local sources, the applicable map-management rules, rejected shortcuts, and the exact unblocking evidence. The review did not download, transform, or commit map data. The branch must not add `public/map/**`, China SVG/GeoJSON/TopoJSON assets, production administrative master data, external tile/API calls, or production region-writing flows while any gate remains blocked.

The documentation-only [PR #16](https://github.com/Yoesher/sociology-phd-desk/pull/16) records this blocked gate. Its initial documentation head `bc3c6cb261e92008210536f97aa3e2e54a689c89` passed [push CI 31556499910](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31556499910) and [Pull Request CI 31556578385](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31556578385); the [maintainer gate review](https://github.com/Yoesher/sociology-phd-desk/pull/16#issuecomment-5261353262) recorded documentation P0 = 0 and P1 = 0 while retaining all four map gates as BLOCKED. PR #16 was then merged as [`ca4429f`](https://github.com/Yoesher/sociology-phd-desk/commit/ca4429facfa124e85c3dba37f9ce7da270a82601), and Issue [#8](https://github.com/Yoesher/sociology-phd-desk/issues/8) was closed with reason `not planned`. Exact-`main` [CI run 31567658853 / job 94022736509](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31567658853/job/94022736509) passed. [Pages run 31567658866](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31567658866) passed build job `94022736462` and deploy job `94022889244`; [deployment 5863903867](https://github.com/Yoesher/sociology-phd-desk/deployments/5863903867) points to the same exact SHA. This merged and deployed a compliance record, not a map, asset, administrative catalog, or region-writing workflow.

## Phase 3E Theory validation status

Theory was based on exact verified `main` `ca4429facfa124e85c3dba37f9ce7da270a82601`. Only the final shared revision supplied the completed evidence below.

| Theory gate | Current factual state |
| --- | --- |
| Entity, relationships, CRUD, bilingual views, demo, task category, v4 migration, encrypted-v3 compatibility | PASS — merged in PR #18 and deployed from exact `main` `b8c8c60434b1d88c348f83c5d08f2d19770db78a`; released in `v0.2.0` |
| Final integrated lint and typecheck | PASS — lint completed with zero warnings; TypeScript completed without errors |
| Final full Vitest suite | PASS — 25 files / 249 tests in 18.71 seconds |
| Final production build and diff/hygiene gate | PASS — Vite built 1,957 modules in 478 ms; largest emitted chunk was `vendor` at 407.60 kB / 127.62 kB gzip; diff, relative-link, secret, and private-path checks passed |
| Chinese/English desktop/mobile real-browser smoke | PASS — Theory CRUD and same-project links, UI-only prompts, preserved user text, Theory task filtering, reload persistence, standard/encrypted isolation, lock/wrong-pass/correct-unlock/reload-lock behavior, 1280 × 720 desktop, 390 × 844 mobile, no horizontal overflow, and zero console warnings/errors. Synthetic QA workspaces were deleted. Browser restore of an old encrypted backup was NOT RUN; automated migration/restore tests cover that boundary. |
| Independent exact-tree P0/P1 review | PASS — P0 = 0 and P1 = 0 on the final local candidate |
| Theory Pull Request and exact-head CI | PASS — [PR #18](https://github.com/Yoesher/sociology-phd-desk/pull/18) final head `978fa3cf3d276de24f16752116518456c661db4f` passed [push CI 31576458299 / job 94049572484](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31576458299/job/94049572484) and [PR CI 31576462527 / job 94049584975](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31576462527/job/94049584975). |
| Maintainer review and merge | PASS — [self-review](https://github.com/Yoesher/sociology-phd-desk/pull/18#issuecomment-5264007436) recorded P0 = 0 / P1 = 0; PR #18 squash-merged as `b8c8c60434b1d88c348f83c5d08f2d19770db78a` and Issue #17 is closed. |
| Exact-`main` CI and Pages | PASS — [CI 31576643318 / job 94050153842](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31576643318/job/94050153842), [Pages 31576643397](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31576643397) build/deploy `94050153623` / `94050362595`, and [deployment 5865496339](https://github.com/Yoesher/sociology-phd-desk/deployments/5865496339) passed on exact `main`. |
| Phase 3F hierarchical navigation | PASS ON `main` — PR #20 merged as `1cbedd2f`; exact-head CI, P0 = 0 / P1 = 0 self-review, exact-main CI, and Pages passed. Complete public interaction remained limited by the browser-bridge timeout. |

## Phase 3F navigation validation status

This section records merged navigation [PR #20](https://github.com/Yoesher/sociology-phd-desk/pull/20) and the exact `main` deployment. It is public `main` evidence, not a formal `v0.2.0` Release claim.

| Navigation candidate gate | Current factual state |
| --- | --- |
| Information architecture and integrated publishing | PASS — nine primaries, derived Smart Views, breadcrumbs, Quick Add, legacy redirects, and separate underlying publication entities are merged |
| Final local static and automated checks | PASS — `npm ci`; lint with 0 findings; typecheck; 28 files / 269 tests; the final exact-tree Vite build transformed 1,962 modules in 580 ms. Main output was 248.28 kB / 57.61 kB gzip, vendor 407.79 kB / 127.67 kB gzip, i18n 182.43 kB / 45.72 kB gzip, Theory 21.40 kB / 5.34 kB gzip, Publishing 20.35 kB / 4.71 kB gzip plus 1.96 kB / 0.70 kB CSS, and common CSS 87.34 kB / 15.67 kB gzip. |
| Independent exact-tree audit | PASS — P0 = 0 and P1 = 0. |
| Local browser interaction and responsive smoke | PASS — Chinese and English desktop 1280 views, keyboard compact-sidebar focus, deep-link/back/forward/reload, Chinese and English 390-wide mobile views with mobile focus behavior (`scrollWidth` 375 ≤ 390), Theory Quick Add in the synthetic demo, Publishing revision view, legacy routes, and an encrypted QA workspace create → lock → wrong-passphrase clear → correct unlock → delete. Console warnings/errors were 0. |
| Navigation Pull Request and exact-head CI | PASS — PR #20 exact head `c4a257a3e9c784a6ae13716fb283b3de8b3001bd`; [push CI 31584494256 / job 94075038357](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31584494256/job/94075038357) and [PR CI 31584573008 / job 94075295369](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31584573008/job/94075295369) succeeded. |
| Maintainer self-review and merge | PASS — [self-review](https://github.com/Yoesher/sociology-phd-desk/pull/20#issuecomment-5265145451) recorded P0 = 0 / P1 = 0; PR #20 squash-merged as `1cbedd2f045c99e40f71bbec434c5c14cae7bb58`, and Issue #19 closed as completed. |
| Exact-`main` CI and Pages | PASS — [CI 31585023271 / job 94076742782](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31585023271/job/94076742782) and [Pages 31585023439](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31585023439) build/deploy jobs `94076743194` / `94077007208` plus [deployment 5867026274](https://github.com/Yoesher/sociology-phd-desk/deployments/5867026274) succeeded on exact `main`. |
| Public navigation interaction | LIMITED — Pages deployment succeeded, but a complete interactive public navigation smoke was not completed because the browser bridge timed out. This is not a full public-browser PASS. |

## `v0.2.0` release validation status

The release candidate was frozen before publication. The table preserves exact candidate evidence and adds the completed remote release chain.

| Release gate | Current factual state |
| --- | --- |
| Version and scope | PASS — `release/0.2.0`; package and lockfile are `0.2.0`; map remains deferred and excluded |
| Clean install and static gates | PASS — `npm ci`; lint exited 0 with no findings; typecheck exited 0 |
| Full automated suite | PASS — 28 files / 269 tests in 24.96 s |
| Production build | PASS — Vite transformed 1,962 modules in 481 ms; main 248.28 kB / 57.61 kB gzip, vendor 407.79 kB / 127.67 kB gzip, i18n 182.43 kB / 45.72 kB gzip, Theory 21.40 kB / 5.34 kB gzip, Publishing 20.35 kB / 4.71 kB gzip plus 1.96 kB / 0.70 kB CSS, and common CSS 87.34 kB / 15.67 kB gzip |
| Candidate screenshots | PASS — eight JPEG captures from an actual 1280 × 720 release-candidate viewport use only the explicitly synthetic Demo; the register records each exact 1265 × 712 or 1280 × 720 image size and covers Chinese Today/navigation/Theory/graph/publishing/privacy plus English UI |
| Integrated release-candidate browser smoke | PASS WITH RECORDED LIMITS — a synthetic standard workspace completed project, research-question, Theory Memo, Theory-task, and reload-persistence flows; a synthetic encrypted workspace completed create, Theory Memo, lock, generic wrong-passphrase rejection with cleared input, correct unlock, persistence, and encrypted-backup generation. All nine English primary routes opened with `html lang=en`; English Theory and mobile More worked at 390 × 844 with `scrollWidth` 375 ≤ 390; console warnings/errors were 0; both QA workspaces and the test tab/server were removed. Plaintext export was invoked but the browser did not expose the downloaded file for inspection. Actual encrypted-backup import/restore and a fresh manual Publishing status matrix were NOT RUN; their behavior remains automated-test evidence. |
| Exact-candidate release audit | PASS — `git diff --check`; 29 tracked Markdown files with 0 broken relative links; dependency tree consistent at package `0.2.0` and 168 lockfile tarballs on the official npm registry; changed-text secret/private-data scan 0; eight screenshots visually reviewed; P0 = 0 and P1 = 0 |
| Release PR exact head | PASS — [PR #21](https://github.com/Yoesher/sociology-phd-desk/pull/21) exact head `f94086d` / tree `744f458`; [push CI 31593825740 / job 94104572524](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31593825740/job/94104572524) and [PR CI 31593881087 / job 94104740084](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31593881087/job/94104740084) passed |
| Maintainer review and merge | PASS — [self-review](https://github.com/Yoesher/sociology-phd-desk/pull/21#issuecomment-5266485457) recorded P0 = 0 / P1 = 0; the [metadata correction](https://github.com/Yoesher/sociology-phd-desk/pull/21#issuecomment-5266508493) preserved exact evidence; PR #21 squash-merged as exact `main` `eb399f7da0a1f3142f7c8361492fa86b08db77db`, with the same tree `744f458` |
| Exact-`main` CI and Pages | PASS — [CI 31594214968 / job 94105807978](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31594214968/job/94105807978) and [Pages 31594215041](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31594215041), build/deploy jobs `94105808046` / `94106022367`, [deployment 5868742408](https://github.com/Yoesher/sociology-phd-desk/deployments/5868742408) passed on exact release SHA |
| Public release browser smoke | LIMITED PASS — English desktop at 1280 reached all nine modules including Theory and Publishing; switching to Chinese updated `html lang` and title; Chinese 390-wide mobile More remained usable with no horizontal overflow; application console warnings/errors were 0. Further mobile expansion was NOT RUN after the browser bridge timed out. |
| Annotated tag and GitHub Release | PASS — annotated tag object `abd24b42…` points to exact release SHA `eb399f7da0a1f3142f7c8361492fa86b08db77db`; [`v0.2.0`](https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.2.0) is published as latest, non-draft, and non-prerelease |

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

- Browser-local data still requires an explicit, tested backup practice. Ordinary JSON and standard-workspace IndexedDB are plaintext; `.sociologydesk` encryption does not create an automatic second copy.
- `v0.2.0` is formally released. Its public smoke is a LIMITED PASS: desktop module access, Chinese switching, one Chinese mobile More/no-overflow check, and zero application console warnings/errors passed, while further mobile expansion was NOT RUN after the browser bridge timed out. Do not relabel this as a complete public interaction pass.
- The local registry intentionally exposes workspace display names, timestamps, modes, auto-lock settings, migration/cleanup state, versions, and opaque storage locators. Encrypted storage does not hide approximate database or backup size.
- There is no account, cloud sync, password reset, recovery key, or secure-erasure guarantee. A forgotten passphrase and lost backups can make encrypted data unrecoverable.
- Applications at different paths under the shared GitHub Pages origin are not separate security origins. Encryption at rest cannot protect an unlocked session or a compromised device/runtime.
- China Research Map remains blocked on authoritative source rights, public-redistribution permission, project-specific map-review metadata, and testable national completeness. It is deferred and excluded from `v0.2.0`; these missing conditions block only the map feature, not Theory, navigation, publishing integration, or release stabilization.
- Complete edit/delete parity is not yet implemented for Today, Literature, Quantitative, Research Log, Manuscripts, Submissions, and Reviewer Comments.
- Automated tests cover domain, portable-data, repository, conflict, migration, the optimistic context queue, and nested modal lifecycle. They do not yet automate complete browser route workflows; multi-viewport end-to-end coverage is still needed.
- Expand nested Workspace/confirmation Escape, scroll-lock, and focus-restoration coverage from the existing component test to automated browser tests.
- Verified public `main` and `v0.2.0` use portable and standard storage v4 through explicit v1 → v2 → v3 → v4 migration; long-term compatibility still requires retained fixtures and upgrade tests from every supported prior version.
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
- Verified Phase 3B closeout base: local `main`, `origin/main`, and the Phase 3C branch point matched `4f3d615c62959e4c84d8d72751414e978f5b123b`, the squash merge of documentation-closeout PR [#12](https://github.com/Yoesher/sociology-phd-desk/pull/12). The underlying Phase 3B product merge remains `a51a10febfb3e186aa1774c0110c27fdceec9f0e` from PR #11.
- Remote status: `origin` is restored to `https://github.com/Yoesher/sociology-phd-desk.git`. Phase 2 temporarily used a repository-scoped deploy key over GitHub's official SSH-over-443 transport because direct `github.com` Git HTTPS timed out; the key lived only under `.git`, was never tracked, and was revoked after the final status push.
- Push/merge status: Phase 3A PRs #9/#10, Phase 3B PRs [#11](https://github.com/Yoesher/sociology-phd-desk/pull/11)/[#12](https://github.com/Yoesher/sociology-phd-desk/pull/12), Phase 3C [PR #14](https://github.com/Yoesher/sociology-phd-desk/pull/14), documentation-only Phase 3D [PR #16](https://github.com/Yoesher/sociology-phd-desk/pull/16), Theory [PR #18](https://github.com/Yoesher/sociology-phd-desk/pull/18), navigation [PR #20](https://github.com/Yoesher/sociology-phd-desk/pull/20), and release [PR #21](https://github.com/Yoesher/sociology-phd-desk/pull/21) are merged. PR #21 produced exact verified `main` `eb399f7da0a1f3142f7c8361492fa86b08db77db`; Issue [#2](https://github.com/Yoesher/sociology-phd-desk/issues/2) remains OPEN and separate.
- `v0.2.0` remote checks: release-head [push CI 31593825740 / job 94104572524](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31593825740/job/94104572524) and [PR CI 31593881087 / job 94104740084](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31593881087/job/94104740084) passed; [self-review](https://github.com/Yoesher/sociology-phd-desk/pull/21#issuecomment-5266485457) recorded P0 = 0 / P1 = 0; exact-`main` [CI 31594214968 / job 94105807978](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31594214968/job/94105807978) and [Pages 31594215041](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31594215041) build/deploy jobs `94105808046` / `94106022367`, deployment `5868742408` passed.
- Phase 3F remote checks: exact-head [push CI 31584494256 / job 94075038357](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31584494256/job/94075038357) and [PR CI 31584573008 / job 94075295369](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31584573008/job/94075295369) passed; exact-`main` [CI 31585023271 / job 94076742782](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31585023271/job/94076742782) and [Pages 31585023439](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31585023439), jobs `94076743194` / `94077007208`, deployment `5867026274` passed.
- Phase 3D closeout remote checks: exact-`main` [CI run 31567658853 / job 94022736509](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31567658853/job/94022736509) and [Pages run 31567658866](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31567658866) succeeded on `ca4429facfa124e85c3dba37f9ce7da270a82601`; Pages build job `94022736462`, deploy job `94022889244`, and deployment `5863903867` all reference that exact closeout revision.
- Phase 3C remote checks: exact-`main` [CI 31551698246](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31551698246) and [Pages 31551698215](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31551698215) succeeded on `f8b9ef94e67730955a4ab4b6fbe27f66ab3a5db9`; Pages deployment `5861195664` published the project URL. The public URL returned HTTP 200 and served final-local-matching `index-d7Ca3tI7.js` and `index-MceaPGZ1.css`.
- Phase 3B remote checks: exact-`main` [CI 31508962634](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31508962634) and [Pages 31508962638](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31508962638) succeeded. The earlier release SHA `e9eadf2c2810c9a18a9f3a31ccdf659bd268c994` remains the immutable `v0.1.0` target.
- Phase 3B documentation-closeout checks: [Pages run 31511286350](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31511286350) succeeded on `4f3d615c62959e4c84d8d72751414e978f5b123b`; the sole `main` CI job `93845435745` completed successfully, while its outer workflow record still reported `in_progress` with no conclusion at the recorded check time. The job result is retained without rewriting the outer metadata anomaly as a completed run.

## Release state

- Current GitHub release: [Sociology PhD Desk v0.2.0](https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.2.0), latest, public, not a draft, and not a prerelease.
- Annotated tag: `v0.2.0`; tag object `abd24b42…` dereferences to exact release SHA `eb399f7da0a1f3142f7c8361492fa86b08db77db`. Existing `v0.1.0` remains unchanged at `e9eadf2c2810c9a18a9f3a31ccdf659bd268c994`.
- Phase 3A, Phase 3B, Phase 3C, Phase 3E, and Phase 3F changes plus the Phase 3D documentation closeout are included in `v0.2.0`.
- Release assets: no custom binary assets; GitHub provides generated source archives.
- Source-backed metric snapshot on 2026-08-12 after PR #21 merged and `v0.2.0` published: 1 Star, 0 Forks, 5 open Issues, 6 closed Issues, 0 open Pull Requests, 10 merged Pull Requests, and 2 published Releases. A Star is repository activity, not evidence of a user, tester, endorsement, or adoption.
- External users/testers: 0 verified in project records; the true number is unknown. Institutional adoption: none known.

## Next version objective

`v0.2.0` release and its remote gates are complete. Stop after this documentation closeout; do not start `v0.3.0` without a separately authorized and scoped plan. The Phase 3D documentation closeout remains durable evidence: all four map gates are **BLOCKED**, no map shipped, and Issue #8 is closed as not planned. Issue [#2](https://github.com/Yoesher/sociology-phd-desk/issues/2) remains separate, OPEN, and unimplemented. Do not move existing tags, translate user-authored research content, or claim external adoption without evidence.

See [NEXT_TASKS.md](NEXT_TASKS.md) for the prioritized queue.
