# Changelog

All notable user-visible changes to Sociology PhD Desk will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and public releases follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- Separated active-route state from desktop navigation expansion so the current primary module can be collapsed and reopened without leaving the page or losing its breadcrumb.
- Persisted the collapse preference as local application chrome; query-only Smart View changes no longer force the active group open, and research workspace data remains unchanged.

### Security & Maintenance

- Moved CI and Pages to the current official Node 24-backed action majors, including checkout/setup, artifact handling, and Pages deployment.
- Added bounded weekly Dependabot checks for npm and GitHub Actions plus official JavaScript/TypeScript CodeQL analysis.
- Added a release gate that blocks high or critical npm dependency advisories without treating registry failures as a pass.

## [0.2.2] - 2026-08-13

### Changed

- Simplified the secondary navigation from 67 status-heavy entries to 32 durable research workflows while preserving all nine primary modules.
- Consolidated legacy status views into URL-addressable in-page filters and kept old deep links working through explicit compatibility mappings.
- Reduced the default top bar to hierarchy, module-aware New, transient state, context-appropriate lock, and More.
- Added progressive disclosure to longer forms without removing or resetting hidden values, and moved low-frequency workspace controls into calmer on-demand settings.

### Motion

- Added coherent, restrained route and smart-view transitions without remounting workspace state.
- Added sidebar, modal, popover, drawer, theme, workspace, and lock/unlock transition polish based on four semantic timing tokens.
- Added a global `prefers-reduced-motion` contract and regression coverage; no motion dependency was added.

### Compatibility

- Existing standard and encrypted workspace data is unchanged.
- Portable schema remains v4, standard database remains v4, and encrypted container remains v1.
- Existing `v0.2.1` PWA, user-confirmed update, offline, backup, and encrypted-workspace behavior remains in place.

## [0.2.1] - 2026-08-13

### Added

- Installable PWA manifest and bilingual application metadata with project-scoped app icons.
- Static-asset-only service worker precaching for offline application startup; no research-data request, upload, proxy, or runtime cache route.
- User-controlled update detection at startup and after a throttled window focus check. Waiting updates never force a refresh and activate only after pending workspace writes are flushed and the latest committed standard or encrypted snapshot is verified.
- Application & storage controls showing app/build-date/schema versions, browser persistence/estimate state and request action, install availability, manual update checks, and Off/7/14/30-day personal-workspace backup reminders (default 14 days; Demo excluded) based on generated-export metadata.
- A browser-local backup-due banner that can open backup tools or be snoozed per workspace for one week without changing research data.
- A dismissible, once-per-version bilingual update summary and bilingual getting-started guides for browser use, installation, encrypted-backup recovery, updates, and browser-data deletion risks.

### Changed

- Prepared package version `0.2.1` while retaining portable workspace v4, standard IndexedDB v4, encrypted container v1, encrypted vault v1, and registry database v1.
- Reframed the README first screen for ordinary researchers; developer clone/npm instructions remain available later in the document.

### Privacy

- Retained the current GitHub Pages origin for v0.2.1 with an explicit shared-origin risk statement. A future custom or dedicated origin cannot automatically read IndexedDB from `yoesher.github.io`; migration must keep an old-site notice and use a user-controlled encrypted backup transfer.
- Coordinated updates through the waiting service worker: other scoped app windows receive a metadata-only notice and activation fails closed until they are closed. No passphrase, key, or research content is broadcast.

## [0.2.0] - 2026-08-12

### Added

- A bilingual Theory Research workspace that reuses Research Questions, Claims, Literature, and Manuscripts while adding project-scoped Theory Memos for concepts, mechanisms, dialogue, counterarguments, boundary conditions, and synthesis.
- UI-only structured theory prompts, complete Theory Memo CRUD with explicit stable-ID links, the locale-neutral `Theory / Conceptual Work` task category, and a minimal clearly synthetic Theory demo.
- Two-level research navigation with nine primary domains, URL-addressable derived Smart Views, breadcrumbs, compact flyouts, complete mobile More accordion, and restrained module-aware Quick Add.
- A Manuscripts & Publishing workspace that presents Manuscript, Submission, and ReviewerComment workflows together while retaining separate entities, histories, IDs, and persisted statuses; legacy manuscript and submission routes redirect to compatible publishing views.

- A metadata-only local workspace registry with explicit create, select, rename, lock, export, and delete workflows, plus physically separate databases for each personal or synthetic-demo workspace.
- Standard local workspaces and optional encrypted local workspaces, with a workspace access gate that unmounts research routes while locked and auto-lock choices of Never, 5, 15, 30, or 60 minutes.
- A separate, clearly synthetic demo workspace that can be reset without mixing or replacing personal research records.
- A bilingual Workspace Center and Privacy Center for workspace mode, local storage, last-export time, auto-lock, retained-plaintext cleanup state, backups, and threat-model boundaries.
- Durable recovery records and user-visible retry paths for interrupted provisioning, encrypted conversion, plaintext cleanup, and workspace deletion.
- Versioned `.sociologydesk` encrypted backup and authenticated restore-as-new-workspace flows, distinct from ordinary portable JSON.
- Chinese and English privacy-model documentation covering browser isolation, interface locking, encrypted storage, shared-origin code, device compromise, password loss, logical deletion, and backup limits.
- First-class `ResearchQuestion`, `Claim`, and `ClaimQuestionLink` records with stable IDs, project-scoped many-to-many relationships, and locale-neutral status values.
- Bilingual Research Questions, Claims, and Research Graph workflows in project detail for creating, inspecting, editing, explicitly linking, and safely deleting graph objects.
- IndexedDB v3 stores and portable workspace v3 collections for research questions, claims, and their explicit links.
- Regression coverage for deterministic v1 → v2 → v3 migration, graph integrity, cross-project and duplicate-link rejection, protected deletion, repository collision safety, and bilingual research-graph workflows.
- Chinese-first application interface with a complete English alternative across all nine research modules, global workspace tools, forms, dialogs, validation, empty states, navigation, and responsive table labels.
- Visible language control with an explicit `zh-CN` or `en` preference that applies immediately and persists locally with the existing theme preference.
- Typed, namespace-based localization resources; locale-aware date and number formatting; and exhaustive display labels for persisted domain enums.
- Chinese-default README and contribution guide with complete reciprocal English documents.
- Automated coverage for locale defaults and persistence, resource and interpolation parity, navigation labels, dialogs, form validation, locale-independent export semantics, unchanged research content, and raw enum persistence.

### Changed

- Advanced portable workspaces and standard per-workspace IndexedDB storage from v3 to v4 by adding `theoryMemos`; supported migration now composes explicitly as v1 → v2 → v3 → v4 without inferring research content.
- Kept encrypted container v1, encrypted-vault database v1, and registry database v1 independent from portable/standard v4; authenticated portable-v3 ciphertext and backups upgrade only after authentication and read-back verification.
- Replaced the runtime singleton-database assumption with session-bound standard/encrypted repository adapters and physically isolated workspace databases.
- Moved the bundled synthetic demo into its own workspace and made a fresh personal workspace empty; concurrent first boots converge on deterministic seed routes.
- Made legacy-singleton migration and standard-to-encrypted conversion staged and non-destructive, with physical preflight, durable target reservation, strict read-back validation, recovery states, and explicit later plaintext cleanup.
- Kept ordinary JSON import/export as the inspectable plaintext portability path while adding a separately versioned encrypted-backup format.
- Migrated legacy research-question and exact-trimmed same-project claim text deterministically while preserving original `Evidence.claim` text and inferring no Claim↔ResearchQuestion links.
- Reorganized navigation as bilingual, URL-addressable derived views without creating persisted statuses for menu labels or changing research data when a view opens.
- Combined Manuscript, Submission, and ReviewerComment presentation without merging their schemas, IDs, histories, or persisted statuses; legacy manuscript and submission URLs redirect to the complete publishing view.
- Made Simplified Chinese the fresh-install default, stored application settings outside research data, and localized system dates, numbers, errors, accessible names, and document metadata without translating user-authored content.

### Privacy

- Added Web Crypto authenticated encryption for encrypted workspaces and backups: PBKDF2-HMAC-SHA-256 at 600,000 iterations derives a non-extractable AES-256-GCM key using a fresh salt, while every encryption uses a fresh IV and authenticated canonical metadata.
- Kept passphrases, derived keys, and content verifiers out of persistent storage and cross-tab messages; wrong passphrases and authenticated-data damage share a generic failure path.
- Added lock-epoch, optimistic-revision, invocation-reservation, workspace-identity, lifecycle-generation, physical-name ownership, and cross-workspace guards for stale, colliding, delayed, or cross-boundary writes.
- Standard workspaces and ordinary JSON exports remain plaintext, and interface locking is not described as encryption.
- The plaintext registry exposes routing/recovery metadata such as display names, timestamps, modes, auto-lock state, schema versions, and opaque storage locators, but not research content, passphrases, keys, verifiers, or content digests.
- Encryption at rest does not protect an unlocked session, create separate security origins under one Pages origin, guarantee secure erasure, or replace institutional ethics and data-protection requirements.
- Relationship validation rejects missing endpoints, cross-project links, duplicate pairs, and deletion that would orphan explicit research links.

### Deferred

- China Research Map is deferred and excluded from `v0.2.0`. Its authoritative-source, public-redistribution/transformation, project-specific approval-metadata, and national-completeness gates remain **BLOCKED / NOT TESTABLE**. No map geometry, production administrative catalog, external map call, region persistence, or map UI shipped.
- Explicit bidirectional Evidence↔Claim↔Manuscript-location navigation remains tracked separately in Issue [#2](https://github.com/Yoesher/sociology-phd-desk/issues/2).
- Complete edit/delete parity, full browser end-to-end coverage, dedicated accessibility and cross-browser audits, and external researcher testing remain future work.
- There is no account, cloud synchronization, password reset, recovery key, or secure-erasure guarantee.

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

[Unreleased]: https://github.com/Yoesher/sociology-phd-desk/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/Yoesher/sociology-phd-desk/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/Yoesher/sociology-phd-desk/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.1.0
