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

Phase 3 is planned as six gated increments. Each increment must be implemented, tested, reviewed, and verified in production before work advances to the next one. Listing an increment here does not mean it has shipped; verified status remains in [PROJECT_STATE.md](PROJECT_STATE.md).

**Current gate:** Phase 3A, Phase 3B, and Phase 3C are complete on `main`. Phase 3D began with the mandatory source/compliance review on `codex/china-research-map`, and that review is **BLOCKED**: authoritative source scope, public-redistribution rights, project-specific map-approval metadata, and testable national completeness have not all been established. No production map asset or implementation may merge or deploy, and Phase 3E/3F may not begin. See the bilingual source register: [简体中文](docs/zh-CN/map-data-sources.md) / [English](docs/en/map-data-sources.md).

Every Phase 3 increment follows the same evidence chain: scoped Issue → dedicated feature branch → implementation and tests → Pull Request → passing PR CI → maintainer self-review → squash merge → passing `main` CI → GitHub Pages verification. A later increment must not begin while any earlier gate is incomplete.

### Phase 3A — Chinese-first bilingual foundation

- Make Simplified Chinese the default interface language while preserving a complete, user-selectable English interface.
- Centralize typed interface messages, locale-aware dates and numbers, and persistent language preference without coupling language to workspace data.
- Keep schema values and portable JSON locale-neutral, and never translate user-authored research content during a language switch.
- Verify all nine research routes, dialogs, forms, validation, responsive table labels, keyboard access, narrow layouts, themes, persistence, and reload behavior in both languages.

### Phase 3B — Research Question and Claim graph

- Promote Research Question and Claim to first-class, versioned domain objects rather than storing them only as incidental text.
- Represent the explicit, inspectable many-to-many relationship between research questions and analytical claims with stable IDs and same-project integrity.
- Introduce schema version 3 only with migration, import/export compatibility, graph-integrity, and protected-delete tests.
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

The 2026-08-12 review found every mandatory map gate blocked. The next work is external rights and approval evidence, not a substitute dataset or fabricated UI. Architecture and migration design may remain documented, but production administrative data, geometry, region-writing workflows, and deployment wait until all four gates pass.

### Phase 3E — Hierarchical navigation and information architecture

- Organize primary navigation around research-work domains and secondary navigation around workflows or derived smart views within those domains.
- Keep the main sidebar to at most two levels; concrete projects, manuscripts, interviews, regions, and other objects continue their drill-down in the content area.
- Treat secondary navigation as presentation and filtering by default. Do not add persisted enum values merely to mirror menu labels.
- Preserve routes, deep links, keyboard and screen-reader semantics, responsive access, both languages, and unchanged user-authored content through the navigation migration.

### Phase 3F — Stabilization and v0.2.0 release

- Integrate and audit the Phase 3B–3E data, privacy, map, navigation, accessibility, responsive, and bilingual boundaries as a whole.
- Run migration paths, import/export, protected deletion, local workspace isolation and encryption checks where implemented, production builds, browser smoke tests, and the complete CI and Pages release gate.
- Reconcile bilingual documentation, architecture decisions, privacy and map-source records, changelog, project state, screenshots, and release notes with the verified revision.
- Create the v0.2.0 tag and formal release only after every earlier Phase 3 gate passes; do not move the existing v0.1.0 tag.

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
