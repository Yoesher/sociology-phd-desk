[简体中文](README.md) | **English** · [Roadmap](ROADMAP.md) · [Contributing](CONTRIBUTING.en.md) · [Project state](PROJECT_STATE.md)

# Sociology PhD Desk

**A local-first ResearchOps workstation for sociology doctoral researchers.**

Manage the full research lifecycle—from literature and fieldwork to quantitative analysis, evidence, manuscripts, and peer-review revisions.

**Live demo:** [https://yoesher.github.io/sociology-phd-desk/](https://yoesher.github.io/sociology-phd-desk/)

> **`v0.2.0` release candidate:** the package version is now `0.2.0` and the feature set is frozen. Two-level navigation across nine research domains, Theory Research, the Research Question–Claim graph, private/encrypted local workspaces, and integrated Manuscripts & Publishing are in candidate scope. Navigation [PR #20](https://github.com/Yoesher/sociology-phd-desk/pull/20) is merged and passed exact-`main` CI and Pages; the candidate continues through release gates on `release/0.2.0`. The latest formal GitHub Release is still [`v0.1.0`](https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.1.0); no `v0.2.0` tag or Release exists yet. The China Research Map is deferred because its source, redistribution, approval-metadata, and national-completeness gates remain blocked, and is **not part of `v0.2.0`**. See [PROJECT_STATE.md](PROJECT_STATE.md) for exact evidence and limitations.

The project has not yet been tested by external researchers. Do not keep the only copy of irreplaceable research material here; public availability, a Star, or maintainer self-testing does not establish adoption.

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

## `v0.2.0` candidate scope

The workspace is organized around nine stable sociology research domains:

- **Today** — research goals, project-linked tasks, overdue work, and a concise daily research log.
- **Projects** — research questions, methods, stages, dates, and linked research activity.
- **Literature** — a reading workflow that records why a source matters and how it enters an argument; Zotero remains the reference library.
- **Theory Research** — concepts, mechanisms, theoretical dialogue, counterarguments, boundary conditions, and synthesis memos with explicit same-project links to questions, claims, and literature.
- **Fieldwork** — field sites, visits, and interviews identified by aliases and anonymous IDs.
- **Quantitative** — registries for datasets and analysis runs across Stata, R, Python, and other tools.
- **Evidence ledger** — claims, source locators, findings, limitations, support levels, and manuscript destinations.
- **Research log** — an audit trail of changes, decisions, problems, and next steps.
- **Manuscripts and publishing** — writing stages, journal submissions, reviewer comments, responses, and revision actions in one presentation while preserving each entity and its history.
- **Portable workspace data** — validated JSON export and import, with no silent replacement of existing data.
- **Demo workspace** — explicitly synthetic records that explain the product without imitating real papers, results, or interview material.

The product is desktop-first, responsive, theme-aware, offline-friendly, and designed to keep its core workflow usable without an account or application server. `v0.2.0` also adds:

- a Chinese-first interface with a complete English alternative; language switching never rewrites user research text or portable data;
- first-class `ResearchQuestion`, `Claim`, explicit same-project links, and a visual Research Graph;
- complete bilingual `TheoryMemo` CRUD, same-project relationship protection, and structured prompts that remain UI guidance only;
- standard and encrypted local workspaces, locking, and `.sociologydesk` encrypted backup; ordinary IndexedDB and JSON export remain plaintext;
- at most two URL-addressable Smart View levels across desktop and mobile without mutating data when views open;
- portable workspace and standard IndexedDB v4; v3 → v4 adds only an empty `theoryMemos` collection and does not infer or rewrite research content.

See [PROJECT_STATE.md](PROJECT_STATE.md), [data portability](docs/data-portability.md), and the [privacy and encryption model](docs/en/privacy-model.md) for the full feature, migration, security, and exact-gate record. Explicit Evidence↔Claim↔Manuscript traceability under Issue [#2](https://github.com/Yoesher/sociology-phd-desk/issues/2) remains unimplemented, and complete edit/delete parity across all objects is not claimed.

## Why sociology-specific?

The product is for sociology doctoral researchers first: quantitative, qualitative, mixed-methods, and theoretical work, including population, labour, family, organizational, and youth research. Adjacent empirical researchers may find it useful, but the product will not trade away its sociology identity for generic productivity features.

A proposed feature should answer a simple question: **does it solve a distinctive problem in the sociological research workflow?** Social networking, chat, a general note editor, a reference database, and an all-purpose AI assistant are deliberately outside the current scope.

## Language and data boundaries

- [README.md](README.md) is the default Chinese entry point; this file is the complete English version.
- The product direction is Simplified Chinese first with a complete English interface. Every substantial interface feature must maintain both languages; consult [PROJECT_STATE.md](PROJECT_STATE.md) for verified delivery status.
- Interface language preference is stored separately from the research workspace. Domain enums, identifiers, and portable JSON remain locale-neutral.
- Switching language changes application chrome, system messages, and date and number presentation. It never silently translates or rewrites user-authored titles, notes, quotations, fieldwork material, or other research content.

## Local-first and privacy

- Core research records are stored in the browser with IndexedDB. Separate workspaces use separate physical databases, but remain inside one Web-origin trust boundary.
- No account, default cloud synchronization, analytics, or third-party tracker is required.
- Local file fields are references; the application is not a secure vault for source datasets or transcripts.
- Standard workspaces and ordinary JSON exports are plaintext. Only an explicitly encrypted workspace or `.sociologydesk` backup uses application-layer encryption.
- Workspace names, timestamps, mode, auto-lock state, and opaque storage-locator metadata remain visible in the plaintext registry. Encryption does not hide approximate database or backup size.
- AI is not a core dependency. Any future AI suggestion must remain visibly separate from source evidence.

Local-first does **not** mean risk-free. Browser storage can be cleared, devices can fail, an unlocked workspace can be read by malicious same-origin code or a compromised device, and ordinary JSON may contain sensitive notes. An interface lock is not encryption, and deleting IndexedDB is not verifiable secure erasure. Maintain and test appropriate backups and follow your institution's research-ethics, consent, retention, and data-protection requirements.

Read [Security](SECURITY.md), the [privacy and encryption model](docs/en/privacy-model.md), and the [research ethics guidance](docs/research-workflows/research-ethics.md) before entering fieldwork or interview metadata.

## Screenshots

These `v0.2.0` candidate screenshots come from the real application at a 1280-pixel viewport and show only the explicitly synthetic Demo workspace. See the [screenshot register](docs/screenshots/README.md) for capture and privacy details.

![Chinese Today research desk](docs/screenshots/v0.2.0/01-today-zh.jpg)

![Expanded Chinese two-level navigation](docs/screenshots/v0.2.0/02-navigation-expanded-zh.jpg)

![Theory Research overview](docs/screenshots/v0.2.0/03-theory-overview-zh.jpg)

![Theory core-concepts view](docs/screenshots/v0.2.0/04-theory-concepts-zh.jpg)

![Research Question–Claim graph](docs/screenshots/v0.2.0/05-research-graph-zh.jpg)

![Publishing revision view](docs/screenshots/v0.2.0/06-publishing-revision-zh.jpg)

![Standard-workspace privacy boundary in Privacy Center](docs/screenshots/v0.2.0/07-privacy-lock-zh.jpg)

![Complete English interface](docs/screenshots/v0.2.0/08-interface-en.jpg)

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

Ordinary JSON export is an inspectable, portable, **plaintext** workspace. Treat it according to its most sensitive record, and inspect the destination before sharing the file. On import, validate the preview and choose the intended merge behavior. Replacement must be an explicit action; it must never happen silently.

The `v0.2.0` candidate exports portable v4 and continues to accept supported v1, v2, and v3 files by applying explicit v1 → v2 → v3 → v4 transformations before the same strict validation; v3 → v4 creates only an empty `theoryMemos` collection. See [data portability](docs/data-portability.md) for migration details and the research-graph boundary.

Phase 3C adds `.sociologydesk` encrypted backup for encrypted workspaces. It is a separate container-v1 format, not ordinary JSON with a different extension. Restore authenticates and validates the entire backup before creating an independent workspace with a new logical workspace ID. A wrong passphrase or damaged ciphertext writes no destination workspace. See [data portability](docs/data-portability.md) and the [privacy and encryption model](docs/en/privacy-model.md) for the format and failure boundaries.

## Architecture

The current foundation uses React, TypeScript, and Vite. Dexie provides the IndexedDB data layer, Zod validates portable data, and Vitest covers testable application logic. The design keeps persistence and domain logic separate from page components so research objects can evolve without turning the application shell into a monolith. Merged Phase 3B adds research questions, analytical claims, and their explicit links. Merged Phase 3C adds a metadata-only registry, per-workspace database adapters, a session gate, and a Web Crypto vault outside the domain workspace. Merged Theory adds `TheoryMemo` and advances the portable/standard axes from v3 to v4; container, vault, and registry remain independently at v1.

See [architecture overview](docs/architecture/overview.md), [data model](docs/architecture/data-model.md), and [decisions](DECISIONS.md).

## Roadmap

The `0.1` line established the core research lifecycle, safe import/export, quality gates, and public maintenance infrastructure. The `v0.2.0` feature scope is frozen around the Chinese-first bilingual foundation, Research Question–Claim graph, private/encrypted local workspaces, Theory Research, hierarchical navigation, and integrated Manuscripts & Publishing; only release stabilization remains. The China Research Map is deferred and excluded because no verifiable public-source, redistribution, and map-approval chain has been established. It may resume only after those conditions change and are independently reviewed.

See [ROADMAP.md](ROADMAP.md). Roadmap entries are intentions, not delivery promises.

## Contributing

Researchers, research software engineers, designers, and documentation contributors are welcome. The most useful reports describe a concrete research object or transition the current model cannot represent.

- Read [CONTRIBUTING.en.md](CONTRIBUTING.en.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- Use the bug, feature, or research-workflow issue form that best fits the report.
- Never attach identifiable participant information, private fieldnotes, transcripts, credentials, or proprietary research data.
- Run lint, type checking, tests, and the production build before opening a pull request.

## Research ethics

**Do not store directly identifying participant information here.** Use aliases and anonymous identifiers such as `participant_id`, `case_id`, and `interview_id`. Do not enter names, phone numbers, government identifiers, precise home addresses, signatures, or complete consent forms.

Sociology PhD Desk is a workflow tool, not an ethics review, consent-management, de-identification, or institutional repository system. Optional application-layer encryption does not establish institutional approval, legal compliance, or absolute protection on a compromised device. Researchers remain responsible for lawful and ethical use.

## Project integrity

Project activity, users, stars, forks, downloads, issues, pull requests, releases, and external adoption are reported only when they can be verified. The current evidence register is maintained in [docs/codex-for-oss.md](docs/codex-for-oss.md). The project has not automatically applied to any external program.

## License

Sociology PhD Desk is available under the [MIT License](LICENSE).
