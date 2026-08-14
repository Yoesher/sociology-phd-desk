# Next Tasks

> `v0.2.2` remains the published release. The authorized `v0.3.0` milestone is active. Navigation, Zotero, Import Guard, and browser E2E are merged through exact main `22c68d6`; Issues #44/#45 and the release-time Issue #37 map gate remain. No `v0.3.0` Release is claimed.

## P0 — v0.3.0 completed foundations and active gates

- [x] Create milestone `v0.3.0`, Issue #34, and dedicated branch `fix/active-navigation-collapse` from exact verified main `f4a4baa`.
- [x] Separate route activity from desktop expansion; allow active collapse/reopen; preserve active styling, breadcrumb, query navigation, compact/mobile behavior, and local-only preference storage.
- [x] Add focused bilingual/ARIA/persistence/non-regression coverage and pass the focused 11-test suite, typecheck, lint, and diff check.
- [x] Pass the complete local gate: 33 files / 303 tests, production build, typecheck, lint, and diff check; complete bilingual desktop/mobile browser smoke with zero console entries.
- [x] Commit/push, open PR with `Closes #34`, pass exact-head CI and P0 = 0 / P1 = 0 self-review, merge, and verify exact-main CI/Pages before Phase B.
- [x] Merge the app-side Zotero Handoff v1, Literature provenance/dedup/preview, schema v5, encrypted v3/v4→v5 compatibility, and bilingual workflow through PR #39; pass exact-main CI/Pages.
- [x] Finish isolated Zotero 8 and Zotero 9 GUI install/send/duplicate/fallback/disable/uninstall/restart gates using synthetic profiles only; merge plugin PR #40 and verify exact-main CI/Pages.
- [x] Implement the Issue #5 Import Guard candidate on `feat/import-guards`: two-step write-free workspace/encrypted preflight, file/record/string bounds, explicit migrations, collection+ID collisions, relationship conflicts, bilingual risk UI, 36 files / 320 tests, and production/PWA build.
- [x] Commit/push the Import Guard candidate, merge PR #41 after exact-head CI/self-review, and verify exact-main CI/Pages.
- [x] Complete Issue #6 browser E2E through PR #43: Chromium desktop and 390 × 844 coverage, synthetic standard/encrypted/import/export/stale-tab/modal/PWA flows, failure-only artifacts, exact-head CI/self-review, squash merge, and exact-main CI/Pages/deployment on `22c68d6`.

## P0 — v0.3.0 later phases (blocked until Phase A exact-main passes)

- [x] Phase B: Issue #36 isolated-profile Zotero 8/9 manual gate and plugin PR merge.
- [x] Phase C: Issue #5 remote PR/CI/main/Pages closeout; schema v5 is merged through app-side Zotero PR #39.
- [ ] Phase D: Issue #37 — current official province-map source/terms/approval/completeness gate; enable no production map unless every mandatory gate passes.
- [x] Phase E: Issue #6 browser E2E, deterministic reload persistence, failure-only artifacts, and exact-main CI/Pages closeout.
- [ ] Phase F1: Issue #44 — merge the current Node 24-backed official Actions majors, bounded Dependabot, CodeQL v4, and high/critical npm audit after exact-head CI/self-review. Current local candidate gates pass; remote state is pending.
- [ ] Phase F2: Issue #45 — privacy-safe diagnostics, bilingual feedback entry/template, citation/maintainer metadata, release checklist, and truthful Codex-for-OSS draft.

## P0 — v0.2.2 Simplicity & Motion

- [x] Create Issue #30 and `feat/simplicity-motion` from verified `v0.2.1` main without changing package or schema versions.
- [x] Reduce secondary navigation from 67 to 32 durable entries while retaining nine primary modules and explicit old-link mappings.
- [x] Consolidate smart views into filters, simplify the Topbar/settings, and add progressive-disclosure forms without deleting hidden values.
- [x] Add a dependency-free semantic motion system, state-preserving route/view transitions, component exit presence, and global reduced-motion support.
- [x] Pass the local candidate gate: `npm ci`, lint, typecheck, 33 files / 300 tests, production build/PWA verification, diff check, and desktop/mobile bilingual browser QA.
- [x] Capture four PNG after-state screenshots from the final production preview using only the synthetic Demo workspace.
- [x] Commit/push exact feature head `0ba748e`, pass exact-head push/PR CI, record P0 = 0 / P1 = 0 self-review, and squash-merge PR #31 as `34bb469`.
- [x] Pass exact-main CI `31715233210`, Pages `31715233124`, and deployment `5890896670`; verify public app/manifest/service worker/assets and exact build SHA with the interaction boundary recorded as LIMITED PASS.
- [x] Finish `release/0.2.2`, pass the release gate, pass exact-head CI/self-review, squash-merge PR #32 as `e766d18`, and pass final exact-main CI/Pages/deployment/public static verification.
- [x] Create annotated `v0.2.2`, publish the latest non-draft/non-prerelease UTF-8 GitHub Release, verify tag dereference and Chinese/English API read-back, then stop at `V0.2.2 ADOPTION & STABILIZATION`.

## P0 — v0.2.1 Distribution & PWA

- [x] Create Issue [#23](https://github.com/Yoesher/sociology-phd-desk/issues/23) and branch `codex/v0.2.1-distribution-pwa` from verified main `782311864b61b0aaeece0e803c0e886c726ed1af`.
- [x] Add a complete manifest, 192/512 app icons, and an inject-manifest service worker that precaches only static application assets with project/version-specific cache names.
- [x] Add startup/throttled-focus/updatefound/waiting detection, bilingual waiting UI, no forced reload, flush/read-back verification, and service-worker client enumeration that blocks activation while another app tab is open.
- [x] Add app/build-date/portable/database/container version display, persistent-storage status/request plus estimate, capability-aware install/fallback, personal-workspace Off/7/14/30 reminder (default 14; Demo excluded), and once-per-version bilingual summary.
- [x] Add researcher-first README entry, bilingual getting-started guides, and a durable A/B/C origin-risk decision; retain current shared origin with explicit risk and no cross-origin IndexedDB claim.
- [x] Pass final automated gates from a clean install and inspect the emitted manifest/service worker/static cache list: strict lint 0 warnings, typecheck, 31 files / 285 tests, 1,971-module build, 24 static precache entries, direct persistence/postpone/offline regressions, and build-time no-runtime-route verification.
- [x] Re-run the final browser matrix: fresh personal onboarding; standard and encrypted/locked update; real two-tab refusal and peer notice; offline edit/reload/online recovery; English desktop and 390 × 844 mobile; browser mode; and deletion of both synthetic QA workspaces. Earlier same-branch smoke supplies fresh Chinese/persisted language and zero-console evidence. Installed standalone remains honest NOT RUN because the in-app browser exposes no controllable OS install surface.
- [x] Merge feature [PR #24](https://github.com/Yoesher/sociology-phd-desk/pull/24) from exact final head `e59d1af070d8ff801842cc591873e6d313311d24` after push/PR CI and P0 = 0 / P1 = 0 self-review; verify squash `main` `671cef2fdb62bc4f10f281ccd496cc04ddc2b9a9`, exact-main CI, Pages, deployment, and Issue #23 closure.
- [x] Verify the deployed manifest, service worker, icons, exact app/build SHA, and static-only cache contract over public HTTP. Record public interactive/offline smoke honestly as LIMITED PASS / NOT RUN after the browser bridge timed out; do not infer it from HTTP inspection.
- [x] Open release [PR #25](https://github.com/Yoesher/sociology-phd-desk/pull/25), pass exact-head push/PR CI and P0 = 0 / P1 = 0 self-review, squash-merge as `8db828faaa94f7591dbd806abe90916335862187`, and pass exact-main CI plus Pages/deployment.
- [x] Publish annotated `v0.2.1` tag object `e481de4ac1acfeca98191cfacc81bee55d96ce69` and the latest non-draft, non-prerelease [GitHub Release](https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.2.1); update exact remote evidence/metrics and stop without starting v0.3.
- [x] Repair the `v0.2.1` Release's corrupted Chinese metadata in place from an explicit UTF-8 notes file; verify Chinese/English sentinels through the GitHub API and confirm Release ID, annotated tag object, exact release SHA, and `v0.2.0` remain unchanged.

## P1 — release-process maintenance

- [x] Merge the scoped UTF-8 Release Notes guard from Issue [#27](https://github.com/Yoesher/sociology-phd-desk/issues/27) through PR [#28](https://github.com/Yoesher/sociology-phd-desk/pull/28) after exact-head push/PR CI and P0 = 0 / P1 = 0 self-review; pass exact-main CI, Pages, and deployment without publishing another version.

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

## P0 — Phase 3B Research Question / Claim graph (complete; released in `v0.2.0`)

- [x] Implement the local Issue [#1](https://github.com/Yoesher/sociology-phd-desk/issues/1) candidate with first-class `ResearchQuestion`, `Claim`, and `ClaimQuestionLink` objects, stable IDs, same-project integrity, and protected deletion.
- [x] Add bilingual project-detail Research Questions, Claims, and Research Graph workflows without translating user-authored text.
- [x] Advance IndexedDB and portable workspace data to v3 with deterministic v1 → v2 → v3 migration, preserved legacy `Evidence.claim` text, exact-trimmed same-project Claim creation, and no inferred Claim↔ResearchQuestion links.
- [x] Add focused automated tests for migration, graph validation, collision safety, protected deletion, demo integrity, and bilingual UI behavior.
- [x] Run the complete final shared-revision local gate: clean install, lint, typecheck, 11 files / 55 tests, production build, diff check, Markdown links, and secret/private-data scan; record only actual results.
- [x] Complete Chinese and English desktop/mobile browser smoke for create, view, edit, link, unlink, protected delete, reload persistence, v3 export/import status, responsive layout, themes, keyboard basics, and zero application console errors; remove synthetic QA records and restore the clean v3 demo afterward.
- [x] Open scoped [PR #11](https://github.com/Yoesher/sociology-phd-desk/pull/11) from exact feature head `2c12911c82678077cf9f3687c9308473f2832bf9` with Issue #1 closure semantics and no Issue #2 implementation.
- [x] Pass both exact-feature-head [push](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31508742035/job/93836866829) and [Pull Request](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31508792720/job/93837034735) check jobs; complete [maintainer self-review](https://github.com/Yoesher/sociology-phd-desk/pull/11#issuecomment-5255455230) with P0 = 0 and P1 = 0; squash-merge PR #11 as [`a51a10f`](https://github.com/Yoesher/sociology-phd-desk/commit/a51a10febfb3e186aa1774c0110c27fdceec9f0e); pass exact-`main` [CI 31508962634](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31508962634) and [Pages 31508962638](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31508962638); confirm Issue #1 is CLOSED while Issue #2 remains OPEN. GitHub's outer Pull Request workflow record remained anomalously `in_progress` even though its sole check job was completed and passing.
- [x] Verify the public URL returns HTTP 200 and its deployed asset names/hashes match the final local build. Real public interaction smoke was NOT RUN because browser control returned `instances=[]`; retain this limitation rather than calling it a pass.
- [x] Unlock Phase 3C only after the Phase 3B merge and exact-`main` remote gates completed. At that historical checkpoint, Phase 3B stayed in `Unreleased` and no v0.2.0 tag moved; it is now included in the published `v0.2.0`.

## P0 — Phase 3C Private Local Workspace (complete; released in `v0.2.0`)

- [x] Search existing Issues by title and create the scoped Issue [#13](https://github.com/Yoesher/sociology-phd-desk/issues/13), “feat: add private local workspaces, locking, and encrypted vault support,” without describing it as a sign-in or network-account system.
- [x] Create `codex/private-local-workspaces` from exact verified `main` `4f3d615c62959e4c84d8d72751414e978f5b123b`; keep package version `0.1.0`, preserve the `v0.1.0` tag, and do not begin Phase 3D.
- [x] Finalize and independently audit the local candidate: metadata-only registry; isolated per-workspace databases and unified alias guards; deterministic concurrent bootstrap; empty personal plus separate pristine-demo workspaces; edited legacy demo→personal classification; idempotent, non-destructive migration; create/select/rename/export/delete; pending-deletion automatic/UI retry; standard/encrypted modes; lock/auto-lock; cross-tab coordination; and safe recovery states. The final independent review recorded P0 = 0 and P1 = 0.
- [x] Verify the Web Crypto contract and failure boundaries: authenticated encryption, fresh salt/IV, secure-random fail-closed behavior, no persisted passphrase/key/verifier, generic authentication failure, wrong-passphrase/tamper zero-write behavior, manager/session poison, lifecycle-generation rejection of post-close/lock delayed refresh, lock-epoch and stale-session rejection, durable conversion reservation with authenticated existing-target retry/discard, flush-before-cleanup plus current-session authentication and stable source/target physical-name double locking, versioned `.sociologydesk` backup, restore as a new logical workspace, and no secure-erasure or password-reset claim.
- [x] Reconcile complete Chinese and English UI/documentation and verify that ordinary JSON and standard IndexedDB remain plainly identified as plaintext; registry display name/timestamps/mode/locator remain visible; encrypted data, shared-origin trust, unlocked-device compromise, and retained-plaintext cleanup limits remain visible.
- [x] Run the final shared-revision local gate: `npm ci`; lint with 0 warnings; typecheck; 23 Vitest files / 222 tests in 21.38 s; Vite 8.2.1 production build with 1,953 modules and no size warning; diff check; relative Markdown links; added-line secret/private-path scan; and real Chinese/English browser smoke at 1280 × 720 and 390 × 844. Browser QA covered standard-workspace isolation/CRUD/rename/lock/reopen, conversion copy/read-back, encrypted backup generation, explicit second-confirmation plaintext cleanup, encrypted lock/reload, generic wrong-passphrase handling, correct unlock, truthful privacy state, mobile overflow, CSP, and zero console warnings/errors. Synthetic QA workspaces/backups were deleted. Actual encrypted-backup import/restore was NOT RUN in the browser and remains automated-test evidence, not manual evidence.
- [x] Open scoped [PR #14](https://github.com/Yoesher/sociology-phd-desk/pull/14) from exact feature head `a6681fff763c66692126775a341ba64cafe546fc`, pass [push CI run 31551522108 / job 93975026534](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31551522108/job/93975026534) and [PR CI run 31551571303 / job 93975177107](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31551571303/job/93975177107), and complete [maintainer self-review](https://github.com/Yoesher/sociology-phd-desk/pull/14#issuecomment-5260782671) with P0 = 0 and P1 = 0.
- [x] Squash-merge PR #14 as [`f8b9ef9`](https://github.com/Yoesher/sociology-phd-desk/commit/f8b9ef94e67730955a4ab4b6fbe27f66ab3a5db9), close Issue #13, pass exact-`main` [CI run 31551698246 / job 93975560577](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31551698246/job/93975560577), and pass [Pages run 31551698215](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31551698215) build/deploy jobs `93975560485` / `93975708219` plus deployment `5861195664` at `https://yoesher.github.io/sociology-phd-desk/` on the same exact SHA.
- [x] Verify public HTTP 200, deployed `index-d7Ca3tI7.js` and `index-MceaPGZ1.css` matching the final local build, and a limited real public browser check at 1280 × 720: expected title, `zh-CN`, Demo, all nine modules, and `scrollWidth` 1265 ≤ 1280. English, mobile, workspace-interactive flows, and console/CSP inspection were NOT RUN because the browser bridge timed out; do not call this a complete public smoke pass.
- [x] Update the verified handoff and public evidence after the remote gates. Phase 3C remained unreleased at that historical checkpoint and is now included in `v0.2.0`; the independent source/compliance gate still applies before any future map implementation.

## P0 — Phase 3D China Research Map compliance closeout (feature deferred from v0.2.0)

- [x] Start Issue [#8](https://github.com/Yoesher/sociology-phd-desk/issues/8) on `codex/china-research-map` with an independent source/legal gate before any production map implementation.
- [x] Record the official-source review in [Chinese](docs/zh-CN/map-data-sources.md) and [English](docs/en/map-data-sources.md), including provider, URL, dataset, level, version, terms, redistribution, approval metadata, transformations, limitations, and update path.
- [x] Record the 2026-08-12 gate honestly: `MAP_SOURCE_VERIFIED=BLOCKED`, `MAP_LICENSE_VERIFIED=BLOCKED`, `MAP_APPROVAL_METADATA=BLOCKED`, and `NATIONAL_MAP_COMPLETENESS=BLOCKED/NOT TESTABLE`.
- [x] Keep the blocked branch free of map geometry, production administrative master data, external map services, unverified region persistence, and fabricated national-map UI.
- [x] Open documentation-only [Draft PR #16](https://github.com/Yoesher/sociology-phd-desk/pull/16), pass its recorded exact-head CI checks, and retain the [P0 = 0 / P1 = 0 documentation review](https://github.com/Yoesher/sociology-phd-desk/pull/16#issuecomment-5261353262) without changing any map gate to PASS.
- [x] Reconcile the final exact PR head so the audit remains `BLOCKED` while explicitly deferring and excluding China Research Map from `v0.2.0`; keep the diff documentation-only and pass CI.
- [x] Mark PR #16 ready, complete an exact-head maintainer self-review, and squash-merge the compliance record as [`ca4429f`](https://github.com/Yoesher/sociology-phd-desk/commit/ca4429facfa124e85c3dba37f9ce7da270a82601) without describing it as a map implementation.
- [x] Close Issue #8 with reason `not planned`; retain the unverified open-repository/Pages source, redistribution, transformation, and approval chain plus future-reopen conditions in the bilingual source register.
- [x] Verify exact-`main` [CI run 31567658853 / job 94022736509](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31567658853/job/94022736509) and [Pages run 31567658866](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31567658866), build job `94022736462`, deploy job `94022889244`, and deployment `5863903867` on exact `ca4429f`.
- [x] Preserve the future map requirements—written redistribution rights, project-specific approval, authoritative hierarchy, county-level privacy boundary, and full national completeness—but do not implement or continue source hunting in this release cycle.

## P0 — Phase 3E Theory Research workspace (complete; released in `v0.2.0`)

- [x] Create Theory Research Issue [#17](https://github.com/Yoesher/sociology-phd-desk/issues/17), then branch `feat/theory-research-workspace` from exact verified `main` `ca4429facfa124e85c3dba37f9ce7da270a82601` after the documentation closeout.
- [x] Add only `TheoryMemo` as a new research entity; reuse ResearchQuestion, Claim, Literature, and Manuscript with stable, same-project ID relationships and protected deletion. Merged through PR #18 and released in `v0.2.0`.
- [x] Add complete bilingual Theory CRUD and views for overview, questions/propositions, concepts, mechanisms, dialogue, counterarguments/boundaries, all memos, and theoretical manuscripts. Keep structured prompts UI-only. Merged through PR #18 and released in `v0.2.0`.
- [x] Add the locale-neutral Theory task category and minimal clearly synthetic demo memos without converting old tasks, logs, or notes. Merged through PR #18 and released in `v0.2.0`.
- [x] Advance portable and standard workspace schemas to v4 with explicit v1 → v2 → v3 → v4 migration; keep encrypted container, encrypted-vault database, and registry database at v1; support authenticated encrypted portable-v3 workspace and backup migration without damaging old ciphertext on failure. Merged through PR #18 and released in `v0.2.0`.
- [x] Freeze the final shared revision with P0 = 0 / P1 = 0; pass lint with zero warnings, typecheck, 25 files / 249 tests, production build, diff/relative-link/secret/private-path QA, and real Chinese/English desktop plus 390 × 844 mobile Theory smoke. Browser QA covered CRUD, same-project links, UI-only prompts, preserved user text, task filtering, reload, standard/encrypted isolation, lock/wrong-pass/correct-unlock/reload-lock, no horizontal overflow, zero console warnings/errors, and complete synthetic-workspace cleanup. Old encrypted-backup restore was not run manually and remains automated-test evidence.
- [x] Open Theory [PR #18](https://github.com/Yoesher/sociology-phd-desk/pull/18) after the local gate passed; its initial head `b478875587982d51b049100333c0dfc44c2f5ceb` passed [push CI 31575636028 / job 94047000462](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31575636028/job/94047000462) and [PR CI 31575666773 / job 94047095608](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31575666773/job/94047095608).
- [x] Pass corrected exact-head [push CI 31576458299 / job 94049572484](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31576458299/job/94049572484) and [PR CI 31576462527 / job 94049584975](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31576462527/job/94049584975); complete [P0 = 0 / P1 = 0 self-review](https://github.com/Yoesher/sociology-phd-desk/pull/18#issuecomment-5264007436), squash-merge PR #18 as [`b8c8c60`](https://github.com/Yoesher/sociology-phd-desk/commit/b8c8c60434b1d88c348f83c5d08f2d19770db78a), close Issue #17, and pass exact-main [CI 31576643318 / job 94050153842](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31576643318/job/94050153842) plus [Pages 31576643397](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31576643397) build/deploy `94050153623` / `94050362595` and deployment `5865496339`.

## P0 — Phase 3F hierarchical navigation and integrated publishing

**COMPLETE AND RELEASED:** navigation PR #20 is merged, its exact-head and exact-`main` remote gates passed, and the work is included in formal `v0.2.0`.

- [x] Implement at most two sidebar levels: primary research-work domains and secondary workflows or derived smart views.
- [x] Keep secondary navigation decoupled from database enums; do not add persisted states merely to mirror menu labels.
- [x] Fix the nine primary modules as Today, Projects, Literature, Theory Research, Fieldwork, Quantitative, Evidence, Research Log, and Manuscripts & Publishing; keep workspace/settings separate at the bottom.
- [x] Add the specified smart views, badges, breadcrumbs, compact flyouts, mobile accordion, deep-link query views, restrained context-aware Quick Add, and truly-empty personal-workspace onboarding without mutating research data merely by switching views.
- [x] Present Manuscript, Submission, and ReviewerComment together while keeping their schemas independent; preserve `#/manuscripts` and `#/submissions` through compatibility redirects.
- [x] Complete candidate local gates: `npm ci`, lint with 0 findings, typecheck, 28 files / 269 tests, 1,962-module production build, independent P0 = 0 / P1 = 0 audit, and real Chinese/English desktop/mobile/encrypted browser smoke with zero console warnings/errors.
- [x] Open navigation [PR #20](https://github.com/Yoesher/sociology-phd-desk/pull/20) at exact head `c4a257a3e9c784a6ae13716fb283b3de8b3001bd`; pass push CI `31584494256` / job `94075038357`, PR CI `31584573008` / job `94075295369`, and [P0 = 0 / P1 = 0 self-review](https://github.com/Yoesher/sociology-phd-desk/pull/20#issuecomment-5265145451).
- [x] Squash-merge PR #20 as `1cbedd2f045c99e40f71bbec434c5c14cae7bb58`, close Issue #19 as completed, and pass exact-`main` CI `31585023271` / job `94076742782` plus Pages `31585023439`, jobs `94076743194` / `94077007208`, deployment `5867026274`.
- [x] Record the public-navigation interaction limitation honestly: Pages deployment passed, but the browser bridge timed out before a complete public interaction smoke; do not relabel it as a full PASS.

## P0 — Phase 3G v0.2.0 stabilization and release (complete)

- [x] Declare `FEATURE FREEZE FOR v0.2.0`; accept only P0/P1 release bugs, documentation, screenshots, version/changelog, accessibility, migration, security, and release-process changes.
- [x] Create `release/0.2.0` from verified `main`, update package/lockfile to `0.2.0`, and keep portable schema, standard database schema, encrypted vault schema, encrypted container, and package version as independently documented axes.
- [x] Pass the final exact-candidate automated gate: `npm ci`; lint 0; typecheck; 28 files / 269 tests in 24.96 s; Vite build with 1,962 modules in 481 ms.
- [x] Capture and register eight JPEG release-candidate screenshots from a 1280 × 720 viewport using only the explicitly synthetic Demo, with exact per-file 1265 × 712 or 1280 × 720 dimensions, covering Chinese Today/navigation/Theory/graph/publishing/privacy and the English interface.
- [x] Reconcile the bilingual README, retained map deferral, changelog, project state, roadmap, screenshot register, release checklist, and evidence register with exact candidate facts before publication.
- [x] Complete the integrated release-candidate browser gate: standard create/project/question/Theory Memo/Theory task/reload persistence; plaintext-export action invocation; encrypted create/project/Theory Memo/lock/wrong-passphrase rejection and field clearing/correct unlock/persistence/encrypted-backup generation; all nine English primary routes; English 390 × 844 Theory and mobile More with `scrollWidth` 375 ≤ 390; zero console warnings/errors; and deletion of both synthetic QA workspaces. The in-app browser did not expose the plaintext download for file inspection, actual encrypted-backup import/restore was NOT RUN manually, and fresh Publishing status creation was not repeated; those boundaries remain automated-test evidence rather than fabricated manual evidence.
- [x] Complete final diff/Markdown-link/secret/private-data/dependency/screenshot-truth audit on the exact release candidate; P0 = 0 and P1 = 0.
- [x] Open release [PR #21](https://github.com/Yoesher/sociology-phd-desk/pull/21) at exact head `f94086d` / tree `744f458`; pass [push CI 31593825740 / job 94104572524](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31593825740/job/94104572524) and [PR CI 31593881087 / job 94104740084](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31593881087/job/94104740084); record [P0 = 0 / P1 = 0 self-review](https://github.com/Yoesher/sociology-phd-desk/pull/21#issuecomment-5266485457); and squash-merge as `eb399f7da0a1f3142f7c8361492fa86b08db77db` with the same tree.
- [x] Pass exact-`main` [CI 31594214968 / job 94105807978](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31594214968/job/94105807978) and [Pages 31594215041](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31594215041), build/deploy jobs `94105808046` / `94106022367`, deployment `5868742408`; record the public browser LIMITED PASS without overstating the timed-out mobile expansion.
- [x] Create annotated `v0.2.0` tag object `abd24b42…` pointing to exact release SHA `eb399f7da0a1f3142f7c8361492fa86b08db77db` and publish the [latest non-draft, non-prerelease GitHub Release](https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.2.0). Existing `v0.1.0` remains unmoved.
- [x] Freeze after release documentation closeout. Do not start `v0.3.0` in this task.

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
