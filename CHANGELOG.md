# Changelog

All notable user-visible changes to Sociology PhD Desk will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project intends to follow [Semantic Versioning](https://semver.org/) after its first release.

## [Unreleased]

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
- Sanitized light/dark product screenshots and browser QA register.

### Changed

- Repository writes now validate the entire workspace and relationship graph before an atomic replacement or merge.
- User edits remove synthetic-demo status from the affected record and workspace while keeping untouched bundled examples visibly marked.
- The dependency lockfile now resolves packages from the official npm registry; the unused `dexie-react-hooks` dependency was removed.

### Fixed

- Prevented stale browser tabs from silently overwriting a newer full workspace snapshot.
- Prevented imported children from attaching to semantically different parents after an ID collision.
- Prevented cross-project Field Site, Interview, and Field Visit relationships.
- Added guards for required short titles and duplicate reviewer comment IDs.
- Portalled global dialogs to `document.body` so the topbar backdrop filter cannot clip the Workspace backup/import modal.

### Security

- Public-repository exclusions for secrets, machine-local configuration, private field material, transcripts, and common research-data formats.
- Explicit guidance against storing directly identifying participant information.
- Central schema and relationship validation before persistence or export.

## Releases

No version has been publicly released as of 2026-08-11. Do not add a release section until the corresponding tag and release can be verified.
