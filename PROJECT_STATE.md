# Project State

> Last updated: 2026-08-12
> Status: Phase 0, Phase 1, Phase 2, Phase 3A, Phase 3B, and Phase 3C are complete on `main`; the Phase 3D China Research Map audit has four **BLOCKED** gates and no implementation or asset, so ADR-015 defers and excludes the map from `v0.2.0`; non-map finalization may proceed through Theory Research, hierarchical navigation and integrated publishing, then release stabilization; `v0.1.0` remains the verified public release
> Canonical local project path: `D:\phddesk`

This file is the factual handoff record for maintainers and future Codex sessions. Update it at the end of every development session. Never infer passing checks, repository activity, users, or releases.

## Current version

- Package version: `0.1.0`
- Release status: [`v0.1.0`](https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.1.0) published and verified
- Next release target: gated `v0.2.0` after Theory Research, hierarchical navigation/integrated publishing, and release stabilization; the China Research Map is not part of that scope, no date is promised, and no intermediate phase may create or move the tag

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

The following bullets describe verified `main` at `f8b9ef94e67730955a4ab4b6fbe27f66ab3a5db9`, including the merged but unreleased Phase 3C implementation.

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

### Phase 3C architecture (merged and deployed; unreleased)

- A schema-v1 `sociology-phd-desk-registry` database stores only local routing/recovery metadata. Canonical display name, timestamps, workspace kind/mode, auto-lock, migration/cleanup/deletion truth, interrupted-conversion reservation, schema versions, registry revision, and opaque storage locators remain plaintext; research content, passphrases, keys, verifiers, and content digests do not belong there.
- Each standard personal or synthetic-demo workspace has a separate IndexedDB database using the existing 17-table schema v3 and portable `WorkspaceData` v3 validation. Concurrent first boots converge on deterministic seed routes. Fresh personal data is empty; only an exact pristine legacy fixture remains demo, while an edited legacy demo becomes personal and gets a separate pristine demo companion.
- An encrypted workspace has a separate schema-v1 vault database containing one authenticated ciphertext record and plaintext CAS coordinates. It has no research-domain tables or plaintext workspace name.
- Encrypted container v1 uses Web Crypto PBKDF2-HMAC-SHA-256 (600,000 iterations, fresh 16-byte salt) and AES-256-GCM (non-extractable 256-bit key, fresh 12-byte IV, 128-bit tag, canonical header as AAD). Container v1, portable v3, standard database v3, registry database v1, and encrypted-vault database v1 remain independent version axes.
- A session manager and access gate bind the UI to one ready workspace, keep encrypted keys runtime-only, unmount research routes while locked, and coordinate cooperating tabs without broadcasting passphrases, keys, or research content. Route invalidation, manager close, missing physical storage, or authenticated vault tamper poisons the affected session and clears its cached snapshot. Encrypted async operations recheck a lifecycle generation after awaited storage/crypto work, so close or lock prevents delayed refresh from reviving the runtime.
- Legacy-singleton migration and standard-to-encrypted conversion use physical-name preflight plus staged copy/read-back/validation/publication. Conversion durably reserves its encrypted target before creation; an existing interrupted target requires passphrase authentication and workspace-identity proof for retry or discard, while a confirmed-absent target can have its empty reservation cleared without a passphrase. Plaintext cleanup first flushes pending writes, then requires the current authenticated encrypted session and holds stable lexically ordered locks on the encrypted target and source physical database names while checking route, source identity, and aliases. Plaintext sources remain recorded until cleanup succeeds; deletion is recoverable logical deletion rather than secure erasure.

This architecture was merged through PR #14 and deployed from exact `main` on 2026-08-12. It remains `Unreleased`: package version and the latest formal GitHub Release are still `0.1.0` / `v0.1.0`.

## Current functional state

Verified `main` at [`f8b9ef9`](https://github.com/Yoesher/sociology-phd-desk/commit/f8b9ef94e67730955a4ab4b6fbe27f66ab3a5db9) contains the published `v0.1.0` foundation plus merged, unreleased Phase 3A bilingual, Phase 3B research-graph, and Phase 3C private-local-workspace implementations; the Phase 3B product change itself was squash-merged as [`a51a10f`](https://github.com/Yoesher/sociology-phd-desk/commit/a51a10febfb3e186aa1774c0110c27fdceec9f0e):

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

### Phase 3C functional state (merged and deployed; unreleased)

The merged Phase 3C implementation provides:

- creating, selecting, opening, renaming, exporting, and deleting isolated local workspaces through a metadata-only registry;
- a separate empty personal workspace and resettable synthetic demo workspace, deterministic concurrent bootstrap, edited-legacy-demo preservation as personal data, and deletion tombstones with automatic/bootstrap plus UI-discoverable retry;
- idempotent, non-destructive copy and read-back verification from the legacy `sociology-phd-desk` singleton without automatic source deletion;
- standard plaintext workspaces, optional encrypted workspaces, immediate lock, Never/5/15/30/60-minute auto-lock choices, reload-locked encrypted sessions, and bilingual lock/unlock interfaces;
- staged standard-to-encrypted conversion with a durable target reservation, authenticated retry/discard for an existing target, source recheck, and route publication only after stored-ciphertext read-back, complete v3 validation, and semantic equality, while retaining plaintext recovery truth until separately authenticated and identity-checked cleanup;
- ordinary plaintext JSON import/export plus distinct `.sociologydesk` encrypted backup/restore-as-new-workspace behavior; both payloads receive an export-only copy of the canonical registry display name without advancing the workspace-data revision;
- a bilingual Workspace Center, Privacy Center, and threat-model documentation that distinguish browser isolation, interface locking, encrypted storage, shared-origin code, and device compromise.

These features are present on `main` and Pages at exact SHA `f8b9ef94e67730955a4ab4b6fbe27f66ab3a5db9`. They remain outside the formal `v0.1.0` Release.

## Validation status

### Phase 3C — complete on `main` and Pages; unreleased

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

The documentation-only [PR #16](https://github.com/Yoesher/sociology-phd-desk/pull/16) records this blocked gate. Its initial exact documentation head `bc3c6cb261e92008210536f97aa3e2e54a689c89` passed [push CI 31556499910](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31556499910) and [Pull Request CI 31556578385](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31556578385); the [maintainer gate review](https://github.com/Yoesher/sociology-phd-desk/pull/16#issuecomment-5261353262) recorded documentation P0 = 0 and P1 = 0 while retaining all four map gates as BLOCKED. The audit may be merged as documentation after its final exact-head checks; doing so does not merge or deploy a map. Issue [#8](https://github.com/Yoesher/sociology-phd-desk/issues/8) is to be closed as not planned for this release, with a future reopen permitted only if the public-source and approval conditions become verifiable.

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
- Phase 3C is merged and deployed but remains unreleased. The public desktop browser check covered only title, `zh-CN`, Demo, all nine modules, and horizontal fit at 1280 × 720. English, mobile, workspace-interactive flows, and console/CSP inspection were NOT RUN publicly because the browser bridge timed out; local browser and automated evidence remain recorded separately and must not be relabeled as public interaction evidence.
- The local registry intentionally exposes workspace display names, timestamps, modes, auto-lock settings, migration/cleanup state, versions, and opaque storage locators. Encrypted storage does not hide approximate database or backup size.
- There is no account, cloud sync, password reset, recovery key, or secure-erasure guarantee. A forgotten passphrase and lost backups can make encrypted data unrecoverable.
- Applications at different paths under the shared GitHub Pages origin are not separate security origins. Encryption at rest cannot protect an unlocked session or a compromised device/runtime.
- China Research Map remains blocked on authoritative source rights, public-redistribution permission, project-specific map-review metadata, and testable national completeness. It is deferred and excluded from `v0.2.0`; these missing conditions block only the map feature, not Theory, navigation, publishing integration, or release stabilization.
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
- Verified Phase 3B closeout base: local `main`, `origin/main`, and the Phase 3C branch point matched `4f3d615c62959e4c84d8d72751414e978f5b123b`, the squash merge of documentation-closeout PR [#12](https://github.com/Yoesher/sociology-phd-desk/pull/12). The underlying Phase 3B product merge remains `a51a10febfb3e186aa1774c0110c27fdceec9f0e` from PR #11.
- Remote status: `origin` is restored to `https://github.com/Yoesher/sociology-phd-desk.git`. Phase 2 temporarily used a repository-scoped deploy key over GitHub's official SSH-over-443 transport because direct `github.com` Git HTTPS timed out; the key lived only under `.git`, was never tracked, and was revoked after the final status push.
- Push/merge status: Phase 3A PRs #9/#10, Phase 3B PRs [#11](https://github.com/Yoesher/sociology-phd-desk/pull/11)/[#12](https://github.com/Yoesher/sociology-phd-desk/pull/12), and Phase 3C [PR #14](https://github.com/Yoesher/sociology-phd-desk/pull/14) are merged. Phase 3D documentation-only [PR #16](https://github.com/Yoesher/sociology-phd-desk/pull/16) is currently OPEN and Draft while its final deferral reconciliation and exact-head checks are pending; the audit may be marked ready and merged without changing any map gate to PASS. Issues [#1](https://github.com/Yoesher/sociology-phd-desk/issues/1) and [#13](https://github.com/Yoesher/sociology-phd-desk/issues/13) are CLOSED; Issues [#2](https://github.com/Yoesher/sociology-phd-desk/issues/2) and [#8](https://github.com/Yoesher/sociology-phd-desk/issues/8) remain OPEN. PR #14 exact feature head `a6681fff763c66692126775a341ba64cafe546fc` passed push and Pull Request CI, received a P0 = 0 / P1 = 0 maintainer self-review, and was squash-merged as `f8b9ef94e67730955a4ab4b6fbe27f66ab3a5db9`.
- Phase 3C remote checks: exact-`main` [CI 31551698246](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31551698246) and [Pages 31551698215](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31551698215) succeeded on `f8b9ef94e67730955a4ab4b6fbe27f66ab3a5db9`; Pages deployment `5861195664` published the project URL. The public URL returned HTTP 200 and served final-local-matching `index-d7Ca3tI7.js` and `index-MceaPGZ1.css`.
- Phase 3B remote checks: exact-`main` [CI 31508962634](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31508962634) and [Pages 31508962638](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31508962638) succeeded. The earlier release SHA `e9eadf2c2810c9a18a9f3a31ccdf659bd268c994` remains the immutable `v0.1.0` target.
- Phase 3B documentation-closeout checks: [Pages run 31511286350](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31511286350) succeeded on `4f3d615c62959e4c84d8d72751414e978f5b123b`; the sole `main` CI job `93845435745` completed successfully, while its outer workflow record still reported `in_progress` with no conclusion at the recorded check time. The job result is retained without rewriting the outer metadata anomaly as a completed run.

## Release state

- Current GitHub release: [Sociology PhD Desk v0.1.0](https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.1.0).
- Published: `2026-08-11T10:42:22Z`; public, not a draft, and not a prerelease.
- Annotated tag: `v0.1.0`; local and remote tag object `06a81e2b10a20cc71440a3027544345cef6a04a5` dereferences to release SHA `e9eadf2c2810c9a18a9f3a31ccdf659bd268c994`.
- Phase 3A, Phase 3B, and Phase 3C changes remain merged but [`Unreleased`](CHANGELOG.md#unreleased). Deployment on `main` does not create a formal release. No v0.2.0 tag or Release exists, and the v0.1.0 tag has not moved.
- Release assets: no custom binary assets; GitHub provides generated source archives.
- Source-backed metric snapshot on 2026-08-12 after opening blocked Phase 3D Draft PR #16: 1 Star, 0 Forks, 6 open Issues, 3 closed Issues, 1 open Draft Pull Request, 6 merged Pull Requests, and 1 published Release. The six merged PRs include Phase 3C documentation-closeout [PR #15](https://github.com/Yoesher/sociology-phd-desk/pull/15), whose merge commit is the Phase 3D branch base `7078eaeddad236adf9b864e35ff20607e8c61768`. A Star is repository activity, not evidence of a user, tester, endorsement, or adoption.
- External users/testers: 0 verified in project records; the true number is unknown. Institutional adoption: none known.

## Next version objective

Phase 3A, Phase 3B, and Phase 3C gates are complete. Phase 3C is merged on `main` and deployed but remains `Unreleased`; Issue [#13](https://github.com/Yoesher/sociology-phd-desk/issues/13) is closed. The China Research Map audit is **BLOCKED**, retained as compliance evidence, and excluded from `v0.2.0`. The immediate non-map objective is the Theory Research workspace, followed only after its complete gate by hierarchical navigation and integrated publishing, then release stabilization. Issue [#2](https://github.com/Yoesher/sociology-phd-desk/issues/2) remains separate, OPEN, and unimplemented. Do not create `v0.2.0` before the new release gates pass, move `v0.1.0`, translate user-authored research content, or claim external adoption without evidence.

See [NEXT_TASKS.md](NEXT_TASKS.md) for the prioritized queue.
