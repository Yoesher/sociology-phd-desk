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

- First-class Research Question, Claim, Variable, Model, Code, Memo, and Revision Task objects.
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
