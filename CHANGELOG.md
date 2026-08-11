# Changelog

All notable user-visible changes to Sociology PhD Desk will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and public releases follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Chinese-first application interface with a complete English alternative across all nine research modules, global workspace tools, forms, dialogs, validation, empty states, navigation, and responsive table labels.
- Visible language control with an explicit `zh-CN` or `en` preference that applies immediately and persists locally with the existing theme preference.
- Typed, namespace-based localization resources; locale-aware date and number formatting; and exhaustive display labels for persisted domain enums.
- Chinese-default README and contribution guide with complete reciprocal English documents.
- Automated coverage for locale defaults and persistence, resource and interpolation parity, navigation labels, dialogs, form validation, locale-independent export semantics, unchanged research content, and raw enum persistence.

### Changed

- Simplified Chinese is now the default for a fresh installation even when the browser language is English.
- Application settings are stored separately from IndexedDB research data and portable workspace JSON; switching language does not change research records, revisions, demo markers, or schema values.
- User-facing dates, numbers, system errors, accessible names, and document metadata now follow the selected application locale.

### Security

- Preserved user-authored research content exactly during language changes; no automatic translation is performed.
- Recorded a permanent compliance gate requiring authoritative, legally usable provenance before any public China Research Map boundary asset can ship.

## [0.1.0] - 2026-08-11

### Added

- Responsive, theme-aware application shell with nine lazy-loaded sociology research modules.
- Projects, Evidence, Field Sites, Interviews, and Field Visits CRUD with relationship-aware deletion and privacy safeguards.
- Focused Today, Literature, Quantitative, Research Log, Manuscript, Submission, and Reviewer Comment workflows.
- Explicitly synthetic demo workspace with visible demo state and no fabricated research evidence.
- Local-first IndexedDB persistence, database migration, revision conflict detection, and same-origin refresh broadcasts.
- Validated JSON export/import, collision-aware merge reporting, explicit replacement, and confirmed demo reset.
- English and Simplified Chinese project documentation.
- Contributor, conduct, security, roadmap, architecture-decision, state, and handoff documentation.
- GitHub issue forms and continuous-integration configuration.
- GitHub Pages production deployment with the public browser-local demo.
- Six substantive roadmap issues covering research objects, provenance, reproducibility, qualitative traceability, import safeguards, and browser coverage.
- Sanitized light/dark product screenshots and browser QA register.

### Changed

- Repository writes now validate the entire workspace and relationship graph before an atomic replacement or merge.
- User edits remove synthetic-demo status from the affected record and workspace while keeping untouched bundled examples visibly marked.
- The dependency lockfile now resolves packages from the official npm registry; the unused `dexie-react-hooks` dependency was removed.
- The portable workspace envelope is now version 2; legacy pre-release v1 exports migrate in memory before strict validation.

### Fixed

- Prevented stale browser tabs from silently overwriting a newer full workspace snapshot.
- Cancelled every dependent optimistic write after an earlier queued write conflicts, closing a revision-number collision that could otherwise reintroduce a stale snapshot.
- Prevented imported children from attaching to semantically different parents after an ID collision.
- Prevented cross-project Field Site, Interview, and Field Visit relationships.
- Added guards for required short titles and duplicate reviewer comment IDs.
- Portalled global dialogs to `document.body` so the topbar backdrop filter cannot clip the Workspace backup/import modal.
- Added a global modal stack so only the top layer handles Escape/backdrop close, scroll locking survives nested confirmations, and focus restores one layer at a time.

### Security

- Public-repository exclusions for secrets, machine-local configuration, private field material, transcripts, and common research-data formats.
- Explicit guidance against storing directly identifying participant information.
- Central schema and relationship validation before persistence or export.

[Unreleased]: https://github.com/Yoesher/sociology-phd-desk/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.1.0
