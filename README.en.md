[简体中文](README.md) | **English** · [Roadmap](ROADMAP.md) · [Contributing](CONTRIBUTING.en.md) · [Project state](PROJECT_STATE.md)

# Sociology PhD Desk

**A local-first ResearchOps workstation for sociology doctoral researchers.**

Manage the full research lifecycle—from literature and fieldwork to quantitative analysis, evidence, manuscripts, and peer-review revisions.

**Live demo:** [https://yoesher.github.io/sociology-phd-desk/](https://yoesher.github.io/sociology-phd-desk/)

> **Early public software:** the `0.1.0` codebase, public repository, remote CI, and hosted demo have passed the verification recorded in [PROJECT_STATE.md](PROJECT_STATE.md), but the project has not yet been tested by external researchers. Do not use it as the only copy of irreplaceable research material. Public availability does not imply adoption.

## Why Sociology PhD Desk?

Sociological research is not just task management.

A single project may simultaneously involve literature, interviews, fieldnotes, datasets, models, analytical memos, manuscripts, and reviewer responses. General-purpose tools usually manage files, notes, or tasks separately. Sociology PhD Desk connects research objects and decisions into one traceable workflow:

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

It is an orchestration layer, not a replacement for Zotero, Word, Stata, R, Python, NVivo, MAXQDA, or a journal submission system.

## Features

The `0.1.x` workspace is organized around sociology-specific research objects:

- **Today** — research goals, project-linked tasks, overdue work, and a concise daily research log.
- **Projects** — research questions, methods, stages, dates, and linked research activity.
- **Literature** — a reading workflow that records why a source matters and how it enters an argument; Zotero remains the reference library.
- **Fieldwork** — field sites, visits, and interviews identified by aliases and anonymous IDs.
- **Quantitative** — registries for datasets and analysis runs across Stata, R, Python, and other tools.
- **Evidence ledger** — claims, source locators, findings, limitations, support levels, and manuscript destinations.
- **Research log** — an audit trail of changes, decisions, problems, and next steps.
- **Manuscripts and submissions** — writing stages, journal submissions, reviewer comments, responses, and revision actions.
- **Portable workspace data** — validated JSON export and import, with no silent replacement of existing data.
- **Demo workspace** — explicitly synthetic records that explain the product without imitating real papers, results, or interview material.

The product is desktop-first, responsive, theme-aware, offline-friendly, and designed to keep its core workflow usable without an account or application server.

In `0.1.0`, Projects, Evidence, and Fieldwork provide create, inspect, edit, and protected-delete flows. Literature, Quantitative, Research Log, Manuscripts, Submissions, and Today provide focused registry, creation, filtering, and status workflows; complete edit/delete parity for every object is future work.

### Phase 3B development candidate (not merged or released)

The current feature branch is promoting research questions and analytical claims to first-class, project-scoped research objects:

- `ResearchQuestion`, `Claim`, and `ClaimQuestionLink` use stable IDs; text is never a foreign key.
- Research questions and analytical claims use explicit, same-project many-to-many links. Missing endpoints, cross-project relationships, and duplicate relationships are rejected.
- The project detail view provides complete Chinese and English Research Questions, Claims, and Research Graph interfaces for creating, inspecting, editing, linking, and deleting unreferenced objects.
- A question or claim must be explicitly unlinked before deletion. Project deletion does not silently cascade-delete these research records.
- The candidate advances IndexedDB and the portable workspace to v3 and composes migration explicitly as v1 → v2 → v3. Legacy `Project.researchQuestion` text becomes a research-question object; each original `Evidence.claim` string remains present while same-project exact-trimmed text is used for deterministic claim creation.
- Migration performs no semantic or fuzzy merge, automatic rewrite, or inference that a claim answers a particular research question.

This is not a release claim: the Phase 3B Pull Request, remote CI, merge, `main` CI, and Pages verification remain pending. The explicit Evidence↔Claim relationship in Issue [#2](https://github.com/Yoesher/sociology-phd-desk/issues/2) is not part of this candidate, and v3 does not add an evidence `claimId`.

## Why sociology-specific?

The product is for sociology doctoral researchers first: quantitative, qualitative, mixed-methods, and theoretical work, including population, labour, family, organizational, and youth research. Adjacent empirical researchers may find it useful, but the product will not trade away its sociology identity for generic productivity features.

A proposed feature should answer a simple question: **does it solve a distinctive problem in the sociological research workflow?** Social networking, chat, a general note editor, a reference database, and an all-purpose AI assistant are deliberately outside the current scope.

## Language and data boundaries

- [README.md](README.md) is the default Chinese entry point; this file is the complete English version.
- The product direction is Simplified Chinese first with a complete English interface. Every substantial interface feature must maintain both languages; consult [PROJECT_STATE.md](PROJECT_STATE.md) for verified delivery status.
- Interface language preference is stored separately from the research workspace. Domain enums, identifiers, and portable JSON remain locale-neutral.
- Switching language changes application chrome, system messages, and date and number presentation. It never silently translates or rewrites user-authored titles, notes, quotations, fieldwork material, or other research content.

## Local-first and privacy

- Core research records are stored in the browser with IndexedDB.
- No account, default cloud synchronization, analytics, or third-party tracker is required.
- Local file fields are references; the application is not a secure vault for source datasets or transcripts.
- JSON export is the portability and backup path. Store exports in a location appropriate to their sensitivity.
- AI is not a core dependency. Any future AI suggestion must remain visibly separate from source evidence.

Local-first does **not** mean risk-free. Browser storage can be cleared, devices can fail, and exported workspaces can contain sensitive notes. Maintain encrypted backups and follow your institution's research-ethics, consent, retention, and data-protection requirements.

Read [Security](SECURITY.md) and the [research ethics guidance](docs/research-workflows/research-ethics.md) before entering fieldwork or interview metadata.

## Screenshots

All visible records below come from the explicitly synthetic demo workspace. See the [screenshot register](docs/screenshots/README.md) for capture and privacy details.

![Today research desk in the light theme](docs/screenshots/today-light.jpg)

![Evidence ledger in the dark theme](docs/screenshots/evidence-dark.jpg)

![Workspace backup, import, and demo-reset dialog](docs/screenshots/workspace-data-light.jpg)

## Getting started

### Prerequisites

- Node.js 24 and npm 11 are the verified development environment.
- A current Chromium-, Firefox-, or Safari-based desktop browser with IndexedDB enabled.

### Run locally

From an existing checkout:

```bash
npm ci
npm run dev
```

The public repository is [Yoesher/sociology-phd-desk](https://github.com/Yoesher/sociology-phd-desk). A new checkout can use:

```bash
git clone https://github.com/Yoesher/sociology-phd-desk.git
cd sociology-phd-desk
```

Open the local URL printed by Vite. Data created in one browser profile is not automatically available in another profile or device.

### Validate a contribution

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

These commands are also the required CI sequence. A command is not considered passing unless it has actually run successfully in the current revision.

### Back up or move a workspace

Use the in-app JSON export action and inspect the destination before sharing the file. On import, validate the preview and choose the intended merge behavior. Replacement must be an explicit action; it must never happen silently.

The Phase 3B development candidate exports portable v3 and continues to accept supported v1 and v2 files by applying the explicit v1 → v2 → v3 transformation before the same strict validation. See [data portability](docs/data-portability.md) for migration details and the research-graph boundary.

## Architecture

The current foundation uses React, TypeScript, and Vite. Dexie provides the IndexedDB data layer, Zod validates portable data, and Vitest covers testable application logic. The design keeps persistence and domain logic separate from page components so research objects can evolve without turning the application shell into a monolith. The Phase 3B candidate adds research questions, analytical claims, and their explicit links within this boundary while preserving project scope and protected deletion.

See [architecture overview](docs/architecture/overview.md), [data model](docs/architecture/data-model.md), and [decisions](DECISIONS.md).

## Roadmap

The `0.1` line establishes the core research lifecycle, safe import/export, quality gates, and public maintenance infrastructure. Phase 3 follows a gated sequence: 3A Chinese-first bilingual foundation, 3B Research Question–Claim graph, 3C private local workspaces, 3D China Research Map, 3E hierarchical navigation and information architecture, and 3F stabilization plus the v0.2.0 release. Work does not advance while an earlier gate remains incomplete.

See [ROADMAP.md](ROADMAP.md). Roadmap entries are intentions, not delivery promises.

## Contributing

Researchers, research software engineers, designers, and documentation contributors are welcome. The most useful reports describe a concrete research object or transition the current model cannot represent.

- Read [CONTRIBUTING.en.md](CONTRIBUTING.en.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- Use the bug, feature, or research-workflow issue form that best fits the report.
- Never attach identifiable participant information, private fieldnotes, transcripts, credentials, or proprietary research data.
- Run lint, type checking, tests, and the production build before opening a pull request.

## Research ethics

**Do not store directly identifying participant information here.** Use aliases and anonymous identifiers such as `participant_id`, `case_id`, and `interview_id`. Do not enter names, phone numbers, government identifiers, precise home addresses, signatures, or complete consent forms.

Sociology PhD Desk is a workflow tool, not an ethics review, consent-management, de-identification, encryption, or institutional repository system. Researchers remain responsible for lawful and ethical use.

## Project integrity

Project activity, users, stars, forks, downloads, issues, pull requests, releases, and external adoption are reported only when they can be verified. The current evidence register is maintained in [docs/codex-for-oss.md](docs/codex-for-oss.md). The project has not automatically applied to any external program.

## License

Sociology PhD Desk is available under the [MIT License](LICENSE).
