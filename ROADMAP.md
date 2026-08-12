# Roadmap

Sociology PhD Desk is being developed as a long-lived open-source research tool. This roadmap describes direction, not a promise of dates or adoption. Verified current status belongs in [PROJECT_STATE.md](PROJECT_STATE.md); user-visible changes belong in [CHANGELOG.md](CHANGELOG.md).

## Product north star

Build a local-first research orchestration layer that makes this chain increasingly traceable:

```text
Research question
  → Literature
  → Dataset / Interview
  → Analysis
  → Evidence
  → Claim
  → Manuscript
  → Submission
  → Reviewer comment
  → Revision
```

The product remains sociology-specific and complements, rather than replaces, specialist tools.

## Phase 3 — Chinese-first research platform expansion

Phase 3 uses independently verified increments. Listing an increment here does not mean it has shipped; verified status remains in [PROJECT_STATE.md](PROJECT_STATE.md).

**Current finalization scope:** Phase 3A, Phase 3B, Phase 3C, Phase 3E, and Phase 3F are complete on `main`; navigation PR #20 squash-merged as [`1cbedd2f`](https://github.com/Yoesher/sociology-phd-desk/commit/1cbedd2f045c99e40f71bbec434c5c14cae7bb58) and exact-main CI/Pages passed. The Phase 3D China Research Map source/compliance review remains a merged documentation-only deferral; Issue #8 is `CLOSED_NOT_PLANNED`, all four map gates remain **BLOCKED**, and no map asset or implementation shipped. Feature freeze is active on `release/0.2.0`; package `0.2.0`, local automated gates, and eight synthetic-Demo screenshots are ready, while the release PR, final exact-main/public gates, tag, and GitHub Release remain pending. See the retained bilingual source register: [简体中文](docs/zh-CN/map-data-sources.md) / [English](docs/en/map-data-sources.md).

Every implemented increment follows the same evidence chain: scoped Issue → dedicated feature branch → implementation and tests → Pull Request → passing PR CI → maintainer self-review → squash merge → passing `main` CI → GitHub Pages verification. The map's blocked gate applies to the map alone; each non-map increment must pass its own complete gate before the next begins.

### Phase 3A — Chinese-first bilingual foundation

- Make Simplified Chinese the default interface language while preserving a complete, user-selectable English interface.
- Centralize typed interface messages, locale-aware dates and numbers, and persistent language preference without coupling language to workspace data.
- Keep schema values and portable JSON locale-neutral, and never translate user-authored research content during a language switch.
- Verify all nine research routes, dialogs, forms, validation, responsive table labels, keyboard access, narrow layouts, themes, persistence, and reload behavior in both languages.

### Phase 3B — Research Question and Claim graph

- Promote Research Question and Claim to first-class, versioned domain objects rather than storing them only as incidental text.
- Represent the explicit, inspectable many-to-many relationship between research questions and analytical claims with stable IDs and same-project integrity.
- Keep the merged research-graph v3 migration and introduce candidate schema v4 only through explicit v1 → v2 → v3 → v4 migration, import/export compatibility, graph/theory integrity, and protected-delete tests.
- Preserve legacy question and claim text through deterministic migration without semantic matching, automatic rewriting, or inferred claim-to-question links.
- Keep this work focused on research traceability; it is not a generic visual knowledge-graph editor.

### Phase 3C — Private Local Workspace

- Make multiple private local workspaces explicit and strictly isolated without turning them into network accounts or requiring cloud storage.
- Separate the synthetic demo workspace from user research and migrate the existing singleton workspace non-destructively.
- Distinguish browser isolation, a local screen lock, and genuine encrypted storage in both implementation and user-facing claims.
- If encrypted workspaces ship, use reviewed standard browser cryptography, retain keys only for the unlocked runtime, detect authentication failure, and provide a genuinely encrypted versioned backup format.
- Document threat-model limits, password-loss consequences, lock behavior, migration safety, and backup semantics in both Chinese and English.

### Phase 3D — China Research Map

- Provide a first-class research map for organizing regional sociology notes and comparing research coverage through province, prefecture, and county levels.
- Stop the hierarchy at county level. Do not collect, infer, display, or export exact participant locations, precise households, interview coordinates, or other re-identifying spatial detail.
- Gate implementation on documented verification of an authoritative, legally usable public China map source, including provenance, permitted use, attribution, version, and update path.
- Do not use an arbitrary third-party boundary file as a temporary substitute. If the source and legal conditions cannot be verified, the map remains planned rather than shipped.
- Preserve local-first operation, never transmit user notes or fieldwork data to GitHub Pages or a map service, and provide a useful non-map fallback for linked regional research notes.

The 2026-08-12 review found every mandatory map gate blocked. China Research Map is deferred and excluded from `v0.2.0`; the retained evidence prevents an unverified substitute dataset or fabricated UI from shipping. If source and approval conditions change in a later release cycle, the feature may be reconsidered only after all four gates are independently verified.

### Phase 3E — Theory Research workspace (complete on `main`; unreleased)

- The merged implementation adds one first-class `TheoryMemo` object for conceptual definitions, mechanisms, theoretical dialogue, counterarguments, boundary conditions, and synthesis while reusing existing ResearchQuestion, Claim, Literature, and Manuscript objects.
- Every memo relationship is stable-ID based, same-project, locale-neutral, explicit, duplicate-free, and deletion-protected; UI prompts guide reasoning but never become stored research content automatically.
- Portable and standard workspace data advance through explicit v1 → v2 → v3 → v4 migration. Encrypted container v1, encrypted-vault database v1, and registry database v1 remain independent; authenticated portable-v3 ciphertext and backups upgrade only after authentication and verification.
- The merged implementation provides Chinese and English Theory views, full memo CRUD, project/type/date filters, the stable `Theory / Conceptual Work` task category, and two clearly synthetic demo memos.
- PR #18 passed final-head CI, P0 = 0 / P1 = 0 self-review, squash merge, exact-main CI, and Pages deployment. It remains unreleased until `v0.2.0` stabilization completes.

### Phase 3F — Hierarchical navigation and information architecture (complete on `main`; unreleased)

- Organize primary navigation around research-work domains and secondary navigation around workflows or derived smart views within those domains.
- Keep the main sidebar to at most two levels; concrete projects, manuscripts, interviews, regions, and other objects continue their drill-down in the content area.
- Treat secondary navigation as presentation and filtering by default. Do not add persisted enum values merely to mirror menu labels.
- Present Manuscript, Submission, and ReviewerComment through one Manuscripts & Publishing UI without merging the underlying entities.
- Preserve old routes, deep links, keyboard and screen-reader semantics, responsive access, both languages, and unchanged user-authored content through the navigation migration.
- PR #20 passed exact-head CI and P0 = 0 / P1 = 0 self-review, squash-merged as `1cbedd2f`, closed Issue #19, and passed exact-main CI plus Pages. Complete public interaction verification remained limited by a browser-bridge timeout and is not recorded as a full PASS.

### Phase 3G — Stabilization and v0.2.0 release

- Feature freeze is active after the navigation merge. Only P0/P1 release bugs, documentation, screenshots, version/changelog, accessibility, migration, security, and release-process fixes may enter the candidate.
- `release/0.2.0` carries package `0.2.0`, reconciled candidate documentation, and eight privacy-reviewed screenshots from the real 1280-wide candidate using only synthetic Demo data.
- Integrate and audit the research graph, Theory, private/encrypted workspaces, navigation, publishing, accessibility, responsive, migration, and bilingual boundaries as a whole.
- Run migration paths, import/export, protected deletion, local workspace isolation and encryption checks where implemented, production builds, browser smoke tests, and the complete CI and Pages release gate.
- Reconcile bilingual documentation, architecture decisions, privacy records, retained map deferral evidence, changelog, project state, screenshots, and release notes with the verified revision.
- Open and merge the release PR only with P0 = 0 / P1 = 0, then pass exact-main CI/Pages/public verification.
- Create the `v0.2.0` annotated tag and formal release only after all remaining release gates pass; do not move the existing `v0.1.0` tag.

## `0.1.0` — usable local foundation

Release criteria:

- A responsive, desktop-first application shell with light and dark themes.
- Today, Projects, Literature, Fieldwork, Quantitative, Evidence, Research Log, Manuscripts, and Submissions workflows.
- Project-linked tasks and research objects.
- Local IndexedDB persistence with a documented schema boundary.
- Explicitly synthetic demo workspace.
- Validated JSON export and import without silent replacement.
- Participant-privacy warnings and anonymous fieldwork identifiers.
- Lint, type checking, tests, production build, and CI passing on the release revision.
- English and Chinese documentation, contribution guidance, security policy, issue forms, release notes, and verified screenshots.
- A public repository and tagged release only after the application is runnable and the repository state is verified.

## `0.2.x` — traceability depth

- Complete and stabilize the first-class Research Question, Claim, and `ClaimQuestionLink` foundation; add Variable, Model, Code, Memo, and Revision Task only through separately scoped work.
- Bidirectional evidence-to-claim and claim-to-manuscript navigation.
- Stronger project overview across literature, fieldwork/data, evidence, manuscript, and submission stages.
- Conflict and contradiction review in the evidence ledger.
- Safer import previews, schema migrations, conflict resolution, and backup reminders.
- Accessibility and keyboard-navigation audit.
- Browser-level end-to-end tests for critical persistence and migration paths.

## `0.3.x` — reproducibility and qualitative traceability

- Dataset, variable dictionary, sample restriction, model specification, robustness check, timestamp, code version, and output relationships.
- Analysis-run comparison without attempting to replace Stata, R, or Python.
- Interview → transcript reference → code → memo → analytical claim → manuscript traceability.
- Sampling matrix, participant categories, theoretical-sampling notes, saturation memos, and event timelines where ethically appropriate.
- Reviewer-response matrix with linked revision actions and manuscript locations.

## Later integrations

Each integration requires a separate architecture review of the official API, license, data exposure, authentication, failure modes, and offline behavior.

### Literature and identity

- Zotero import/synchronization at a clear boundary; never a replacement reference manager.
- Crossref and OpenAlex metadata lookup.
- ORCID identity linking where user-controlled and useful.

### Analysis tools

- Configurable local Stata executable and script references, without committed machine-specific paths.
- R and Python script/run metadata.
- NVivo or MAXQDA import only if technically feasible and license-compatible.

### Writing and maintenance

- Word/DOCX, Markdown, and Quarto export or linking.
- GitHub links for reproducible code and project maintenance.
- Optional OpenAI/Codex assistance for literature triage, claim-source checks, research-log summaries, reviewer-comment decomposition, analysis-run explanation, issue triage, and documentation maintenance.

AI features must remain optional and must never turn generated suggestions into source evidence automatically.

## Explicit non-goals for the current horizon

- Social network, chat, or research community.
- A new literature database or Zotero replacement.
- A full Markdown editor.
- A general-purpose AI chatbot.
- Payment, account, cloud-server, or complex permission systems.
- A native mobile application.

## How priorities change

Roadmap changes should be driven by verified workflow reports from real sociology researchers, security and data-integrity needs, maintenance capacity, and evidence that a feature strengthens the research lifecycle. Metrics or anecdotes must not be invented to justify a priority.
