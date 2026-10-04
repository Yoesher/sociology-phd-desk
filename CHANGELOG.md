# Changelog

All notable user-visible changes to Sociology PhD Desk will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and public releases follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.5.0] - 2026-10-04

- Add bilingual Research navigator with 17 record types, local AND text search, project/type filters, read-only detail and exact paginated totals. Queries/indexes stay transient in the current unlocked workspace; PDF/image bytes/text and dedicated URL/path fields are excluded.
- Browse existing same-project stable-ID relationships across questions/claims/memos, local maps/sites/visits/interviews, datasets/runs and manuscripts/submissions/reviews; never infer evidence links from matching prose.
- Review actual project work queues, unlinked open questions and unique mapped-site coverage; counts are not a scientific quality score or project completion percentage.
- Publish [the complete 20-tool primary-source comparison and staged correction plan](docs/research-workstation-review-2026-10-04.md). Keep v7/v1 schemas, existing attachment limits, complete backups, offline/encrypted workflows and all previous appearance options. [Usage and release identity](docs/releases/v0.5.0.md).

### Previous 0.4.1 final closeout correction

0.4.1 final publication completed through PR #61 at `656b99ac708760b4aae684be8c4b19a95c7608a2`: final CI `37202484967`, CodeQL `37202484990`, Pages `37202484999`, deployment `6841041534` and annotated v0.4.1 / Release `403019896` passed. Final public desktop/touch and a separate genuine S1→S2 waiting-worker cohort retained all 19 collections, PDFs, map bytes/markers, goals/ID and browser preferences. The original runner failure below remains historical. This later evidence resolves its pending-closeout wording without rewriting it.


## [0.4.1] - 2026-10-04 (application S1 published)

- Add browser-local Classic/Paper/Slate/Forest appearance templates; academic/sans/serif/system font stacks; Standard/Large/Larger reading sizes; and Gentle/Fade/Slide/None motion in a bilingual Appearance & motion setting.
- Preserve the previous default appearance, existing language/theme settings and system reduced-motion priority. Preferences follow workspace switches, lock and reload, without entering research data or ordinary/encrypted backups; no remote fonts or research-content templates are introduced.
- Application/package/lock/citation/update metadata are 0.4.1. Schema stays v7 for portable/standard/authenticated payload and v1 for container/vault/registry. [PR #60](https://github.com/Yoesher/sociology-phd-desk/pull/60) shipped S1 `a357ec093eec16e6bbd132d3216ac44611fb96e9`; exact-head/main CI/CodeQL/Pages and independent public desktop/touch workflows passed. Original local and remote CI passed 453 unit / 8 Zotero / 34 real E2E (17 + 17, no actual retries/skips/flaky/failures). Ordinary/encrypted switching, lock/reload/unlock and restore preference retention were additionally verified on public S1.
- Preserve the first native runner's overall FAIL: both original 0.4.0 contexts completed the update/SHA/19-collection/PDF/map/appearance assertions before an extra encrypted fixture's full-title/36-character-short-title locator mismatch closed that runner. A strictly corrected external fixture passed the additional combination in new current-S1 contexts, now held for actual final-build acceptance. Earlier environment/fixture/concurrent-timeout and initial publication-network failures remain history. Final closeout S2 and formal Release require their own checks; exact publication identity is recorded in its PR and [latest Release](https://github.com/Yoesher/sociology-phd-desk/releases/latest). See [actual update notes](docs/releases/v0.4.1.md).

## [0.4.0] - 2026-10-04

The separately authorized local-material/storage/date iteration shipped through [PR #57](https://github.com/Yoesher/sociology-phd-desk/pull/57), followed by PR #58 documentation closeout and [PR #59](https://github.com/Yoesher/sociology-phd-desk/pull/59) presentation/formal publication. Final main `26d23b4b07fe87d9bca2ce01a37ee11743b32f5f` passed its own CI/CodeQL/Pages, 422 unit tests, 8 Zotero tests and 28 real desktop/touch E2E tests with no actual retries/flaky/skips/failures, plus fresh public and native build-update acceptance. Annotated [`v0.4.0`](https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.4.0) and latest non-draft/non-prerelease Release `402953759` point to that main; UTF-8 notes and both public source archives were verified. Older tags and the official v0.3.0 Zotero plugin assets are unchanged. The earlier website-only checkpoint retained formal v0.3.0; this later explicit formal-publication authorization superseded that checkpoint without rewriting it.

### Added

- User-imported local static PNG/JPEG map/sketch annotation, linked to existing same-project field sites, visits and interviews. Image-click, keyboard and percentage entry place normalized image positions; selecting a marker does not move it.
- Image limits of 2 MiB each / 4 MiB per full workspace, ≤8,192 pixels per edge and ≤16 million pixels; bounded format/dimension checks and real image decoding. Explicit image replacement clears old markers only after confirmation, and map/marker removal preserves the original research records.
- Portable/standard/authenticated payload v7 with explicit v6 migration to an empty field-map collection and retained legacy compatibility. Container, vault and registry remain v1; v7 backups require a v7-capable application.

### Changed

- PDF bounds increase from 5/12 MiB to 10 MiB per file / 20 MiB per workspace; bytes are decoded when downloading, rather than for every visible row.
- Full readable ordinary JSON export and new interactive growth use a 32 MiB complete-workspace budget, including all projects and attachments. Export rejects over-budget data explicitly without truncation. Existing over-budget workspaces retain reads/migration and non-growing writes; bounded authenticated encrypted backup remains available within its existing 64 MiB ciphertext ceiling and the independent attachment bounds. Ordinary file import still has a 32 MiB preflight limit.

### Fixed and boundaries

- Open-page local “today” and deadline displays refresh at local midnight, focus and return to visibility. No closed-webpage notification is added.
- Local images and their original metadata, including possible EXIF/GPS, remain in the workspace and complete ordinary/encrypted backups. Only entitled coarse research sketches or anonymous public settings are permitted; participant homes, exact participant locations and identifiers must be excluded. Image percentages and local storage are not anonymity or legal/map-review guarantees.
- No national map assets, administrative catalog, online tiles, external map API, GPS acquisition or public map-image export. All four China Research Map gates stay BLOCKED. Larger PDF-library support requires independent attachment storage and chunked authenticated backups, which are not implemented here.

See [the bilingual local-field-maps/storage guide](docs/local-field-maps-and-storage-2026-10-04.md) and [the actual verification record](PROJECT_STATE.md).

## [0.3.1] - 2026-10-03 (website application update; formal Release/tag unchanged)

### Added

- Optional local PDF attachments for manual literature records, with separate PDF/Zotero file selection, a 5 MiB per-file limit, a 12 MiB workspace-total limit, and inclusion in portable/encrypted workspace backups.
- A project-space selector and project entry action that scope project-linked records across the existing research modules, automatically select the project in forms, and retain full-workspace writes and backups. Daily goals remain explicitly workspace-wide.
- Absolute task deadlines, remaining/overdue days, an in-app deadline summary, a next-seven-days view, and task viewing/editing that preserves completion state and notes.

### Fixed

- Literature records hidden by combinations of page and URL filters can be found with a persistent Show all literature action and visible/saved counts. Successful saves return to the complete scoped list; failed saves retain entered values.
- Existing literature records can be reopened for viewing/editing, including local attachment download/removal. PDF selection and saving are distinct actions with visible feedback.
- Scoped Zotero handoff skips sources already linked to another project; cross-project refresh/link actions require returning to all projects.

### Compatibility and privacy

- Portable workspace, standard IndexedDB, and authenticated encrypted payload advance to v6 with explicit v5 → v6 migration and authenticated v3/v4/v5 compatibility. Encrypted container, vault database, and registry database remain v1.
- Local PDF contents persist with the normal workspace snapshot. Zotero handoff remains metadata-only; citation details still require manual confirmation, and no PDF-text extraction or automatic folder access is added.
- Task reminders are visible while the application is open; no closed-webpage notification, account, cloud sync, or telemetry is introduced. Reported missing literature is not a verified data-loss diagnosis or a claim of restored user records.
- The national map remains deferred. Package/application version `0.3.1` identifies the deployed website update and does not imply a formal GitHub Release or annotated tag.

See [the feedback-improvement guide](docs/feedback-improvements-2026-10-03.md) and [the current verification/deployment record](PROJECT_STATE.md).

## [0.3.0] - 2026-08-15

### Added

- Zotero literature handoff with selected-item and multi-item transfer, guarded bulk-file fallback, explicit import preview, stable external-source provenance, and conservative duplicate suggestions.
- Sociology PhD Desk Zotero plugin `0.1.0`, reproducibly packaged for Zotero 8 and Zotero 9 from synthetic-profile-only test evidence.
- Shared write-free import preflight, file-size checks, per-collection and whole-workspace record ceilings, and authenticated legacy encrypted-workspace migration to portable schema v5.
- Browser end-to-end coverage for critical navigation, import, migration, PWA, offline, encrypted-workspace, and update workflows.
- Privacy-safe local diagnostic export, researcher-feedback workflow, CodeQL, Dependabot, current GitHub Actions, `CITATION.cff`, `MAINTAINERS.md`, and reusable release-maintenance documentation.

### Changed

- Allowed the active primary navigation group to be manually collapsed and reopened while preserving the current route, breadcrumb, and a browser-local collapse preference.
- Advanced portable workspaces and standard IndexedDB storage to schema v5 for explicit Zotero external-reference provenance; container, vault, registry, and Zotero handoff formats remain independently versioned at v1.
- Kept exact Zotero identity updates from overwriting project, reading status, priority, why-read rationale, or local notes.

### Privacy

- Zotero handoff accepts allowlisted bibliographic metadata only. It does not import PDFs, attachments, annotations, private notes, full text, storage paths, account data, or synchronization state.
- Diagnostics exclude research text, workspace identities, Zotero metadata, passphrases, and keys; no cloud synchronization, account system, telemetry, or required AI service was introduced.
- All Zotero installation and GUI evidence used isolated synthetic profiles; no real library, account, or sync profile was accessed.

### Deferred

- The province-level China fieldwork map is deferred because public-source, redistribution, project-review, and completeness requirements are not yet verifiable for this deployment. It is excluded from v0.3.0 and may be reconsidered only if those conditions materially change. No map code, geometry, administrative catalog, external map API, region persistence, or participant GPS shipped.
- Claim–Evidence–Manuscript provenance, advanced quantitative reproducibility, advanced qualitative coding, global search, command palette, accounts, cloud sync, and AI features remain outside this release.

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

[Unreleased]: https://github.com/Yoesher/sociology-phd-desk/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/Yoesher/sociology-phd-desk/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/Yoesher/sociology-phd-desk/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/Yoesher/sociology-phd-desk/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/Yoesher/sociology-phd-desk/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.1.0
