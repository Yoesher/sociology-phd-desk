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
- [x] Keep Phase 3B and Phase 3C blocked until every Phase 3A gate passes; that prerequisite is now satisfied for Phase 3B only.

## P0 — first authenticated publication (complete)

- [x] Install the official GitHub CLI and verify the authenticated account as `Yoesher` without placing a token in project files, shell history, or documentation.
- [x] Confirm the target did not exist, then create exactly one public repository: [Yoesher/sociology-phd-desk](https://github.com/Yoesher/sociology-phd-desk).
- [x] Add the verified repository as `origin`, push local `main`, and match the release SHA through local Git, Git transport, and the GitHub API.
- [x] Confirm [remote CI](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31483003952) passes `npm ci`, lint, typecheck, 25 tests, and build on the release SHA.
- [x] Enable GitHub Pages through Actions, verify the [release deployment run](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31483003953), and smoke-test the [deployed demo](https://yoesher.github.io/sociology-phd-desk/).
- [x] Re-run the public secret/data review and verify the README plus all three screenshot URLs through GitHub's rendering and Contents APIs.
- [x] Publish [`v0.1.0`](https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.1.0) only after remote CI passes; include supported workflows, narrower CRUD scope, privacy/backup model, known limitations, and roadmap in the release notes.
- [x] Update `PROJECT_STATE.md` and `docs/codex-for-oss.md` with source-backed repository, commit, CI, tag, release, Pages, Issues, and real metric evidence.

## P0 — Phase 3B Research Question / Claim graph (local gates passed; remote gates pending)

- [x] Implement the local Issue [#1](https://github.com/Yoesher/sociology-phd-desk/issues/1) candidate with first-class `ResearchQuestion`, `Claim`, and `ClaimQuestionLink` objects, stable IDs, same-project integrity, and protected deletion.
- [x] Add bilingual project-detail Research Questions, Claims, and Research Graph workflows without translating user-authored text.
- [x] Advance IndexedDB and portable workspace data to v3 with deterministic v1 → v2 → v3 migration, preserved legacy `Evidence.claim` text, exact-trimmed same-project Claim creation, and no inferred Claim↔ResearchQuestion links.
- [x] Add focused automated tests for migration, graph validation, collision safety, protected deletion, demo integrity, and bilingual UI behavior.
- [x] Run the complete final shared-revision local gate: clean install, lint, typecheck, 11 files / 55 tests, production build, diff check, Markdown links, and secret/private-data scan; record only actual results.
- [x] Complete Chinese and English desktop/mobile browser smoke for create, view, edit, link, unlink, protected delete, reload persistence, v3 export/import status, responsive layout, themes, keyboard basics, and zero application console errors; remove synthetic QA records and restore the clean v3 demo afterward.
- [ ] Open the scoped Phase 3B Pull Request with Issue #1 closure semantics only after the final candidate is stable; do not include Issue #2 work.
- [ ] Pass exact-head PR CI, complete maintainer self-review, squash-merge, synchronize local `main`, pass exact-`main` CI and Pages, verify the deployed public app, and only then confirm Issue #1 is closed.
- [ ] Keep Phase 3C blocked until every Phase 3B gate above passes. Do not create or move a v0.2.0 tag.

## P1 — Phase 3C Private Local Workspace, only after Phase 3B passes

- [ ] Search existing Issues by title before creating or selecting the scoped private-local-workspace task; do not assume an Issue number.
- [ ] Implement isolated local workspaces, non-destructive singleton migration, explicit demo separation, lock UX, privacy center, and bilingual threat-model documentation without describing the feature as a network account.
- [ ] Distinguish browser isolation, UI locking, and actual encryption. Claim encryption only if the stored data is genuinely encrypted with a reviewed standard Web Crypto design and tested recovery/failure boundaries.
- [ ] Complete the dedicated Issue → branch → PR → CI → review → merge → exact-`main` CI → Pages gate before Phase 3D begins.

## P1 — Phase 3D China Research Map, only after Phase 3C passes

- [ ] Execute the first-class, bilingual China Research Map Issue [#8](https://github.com/Yoesher/sociology-phd-desk/issues/8) on its own branch.
- [ ] Verify authoritative/legal map provenance, license, approval metadata, and national-map completeness before committing or publicly deploying any boundary asset; keep the feature blocked if the evidence is incomplete.
- [ ] Stop geographic organization at county level, never require or expose participant coordinates or exact locations, and never upload user notes or fieldwork data to GitHub Pages or a map service.

## P1 — Phase 3E hierarchical navigation, only after Phase 3D passes

- [ ] Implement at most two sidebar levels: primary research-work domains and secondary workflows or derived smart views.
- [ ] Keep secondary navigation decoupled from database enums; do not add persisted states merely to mirror menu labels.
- [ ] Preserve routes, deep links, bilingual parity, responsive/keyboard access, and content-area drill-down through the migration.

## P1 — Phase 3F stabilization and v0.2.0 release, only after Phase 3E passes

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
