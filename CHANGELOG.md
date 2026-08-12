# Changelog

All notable user-visible changes to Sociology PhD Desk will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and public releases follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

> Candidate boundary: the Phase 3D compliance closeout is merged and deployed at exact `main` `ca4429f`; it contains no map implementation. The Theory entries below describe the current local unmerged candidate. Its latest exact-tree independent audit recorded P0 = 0 / P1 = 0, but final full-suite, build, browser, PR/CI, merge, exact-`main`, Pages, and public-verification gates remain pending.

### Added

- A bilingual Theory Research workspace that reuses Research Questions, Claims, Literature, and Manuscripts while adding project-scoped Theory Memos for concepts, mechanisms, dialogue, counterarguments, boundary conditions, and synthesis.
- UI-only structured theory prompts, complete Theory Memo CRUD with explicit stable-ID links, the locale-neutral `Theory / Conceptual Work` task category, and a minimal clearly synthetic Theory demo.

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

- Advanced portable workspaces and standard per-workspace IndexedDB storage from v3 to v4 by adding the `theoryMemos` collection. Supported migration now composes explicitly as v1 → v2 → v3 → v4 without inferring research content.
- Kept encrypted container v1, encrypted-vault database v1, and registry database v1 independent from portable v4. Existing authenticated portable-v3 ciphertext and backups upgrade only after authentication and read-back verification.

- Replaced the runtime singleton-database assumption with session-bound standard/encrypted repository adapters. Phase 3C initially kept portable data at v3; the current unmerged Theory candidate advances portable and standard storage to v4.
- Moved the bundled synthetic demo into its own local workspace and made fresh-install personal data empty. Concurrent first boots converge on deterministic seed routes; only an exact pristine legacy fixture remains demo, while an edited legacy demo is personal data beside a separate pristine demo.
- Made legacy singleton discovery and standard-to-encrypted conversion staged and non-destructive: physical targets are preflighted, a conversion target is reserved before creation, and a destination must be read back, strictly validated, and semantically matched before its route is published, while old plaintext remains recorded until a later cleanup action.
- Kept ordinary JSON import/export as the inspectable plaintext portability path; encrypted backup now has a separate container version and custom extension.
- Made the plaintext registry display name canonical for generated JSON/encrypted payload copies without rewriting the active research snapshot or advancing its workspace-data revision.
- Portable import now composes supported legacy migration explicitly as v1 → v2 → v3. Legacy `Project.researchQuestion` text becomes a first-class research question; same-project exact-trimmed legacy `Evidence.claim` text produces deterministic claim objects while the original evidence text remains unchanged.
- Research-graph migration performs no semantic or fuzzy merge, automatic rewriting, or inferred Claim↔ResearchQuestion linking. Explicit Evidence↔Claim linking remains outside this change under Issue [#2](https://github.com/Yoesher/sociology-phd-desk/issues/2); v3 does not add an evidence `claimId`.
- Project deletion now treats research questions, claims, and claim–question links as dependent research records, while linked questions and claims must be explicitly unlinked before deletion.
- Simplified Chinese is now the default for a fresh installation even when the browser language is English.
- Application settings are stored separately from IndexedDB research data and portable workspace JSON; switching language does not change research records, revisions, demo markers, or schema values.
- User-facing dates, numbers, system errors, accessible names, and document metadata now follow the selected application locale.

### Security

- Added Web Crypto authenticated encryption for encrypted workspaces and backups: PBKDF2-HMAC-SHA-256 with 600,000 iterations and a fresh 16-byte salt derives a non-extractable AES-256-GCM key; each encryption uses a fresh 12-byte IV, a 128-bit tag, and authenticated canonical metadata.
- Kept passphrases and derived keys out of persistent storage and cross-tab messages; wrong passphrases and authenticated-data damage share one generic failure path.
- Added lock-epoch, optimistic revision, invocation-reservation, workspace-identity, read-back, and cross-workspace guards to reject delayed, stale, colliding, or cross-boundary writes.
- Added CSPRNG fail-closed identity/locator generation, physical database-name ownership and alias guards, authenticated existing-target conversion retry/discard, flush-before-cleanup with current-session authentication and stable real-database-name double locking, lifecycle-generation checks that prevent delayed refresh after close/lock, and session poisoning/cleared caches after route, storage, or integrity failures.
- Reject missing graph endpoints, cross-project claim–question relationships, duplicate relationship pairs, and deletes that would orphan explicit research links.
- Preserve legacy `Evidence.claim` source-context text during migration rather than silently rewriting or discarding it.
- Preserved user-authored research content exactly during language changes; no automatic translation is performed.
- Recorded a permanent compliance gate requiring authoritative, legally usable provenance before any public China Research Map boundary asset can ship.
- Merged the Phase 3D documentation-only closeout as `ca4429f`, closed Issue #8 as `not planned`, and kept every map gate BLOCKED; no map asset, catalog, service call, or implementation shipped.

### Privacy

- Standard workspaces and ordinary JSON exports remain plaintext; an interface lock is not described as encryption.
- The local registry exposes workspace display names, timestamps, modes, auto-lock settings, migration/cleanup state, schema versions, and opaque storage locators, but not research content, passphrases, keys, verifiers, or content digests.
- Encrypted workspaces store one authenticated ciphertext record instead of plaintext domain tables. Lock or reload discards the current application key reference, without claiming physical memory zeroization.
- Documented that same-origin scripts and Service Workers, an unlocked or compromised device, browser-profile deletion, storage size, and logical-deletion remnants remain outside the protection provided by encryption at rest.

### Migration

- Added strict v3 → v4 migration that introduces only `theoryMemos: []`; it never converts research logs, notes, or other text into theory memos.

- Added idempotent v1/v2/v3 legacy-singleton copy and read-back verification without automatically deleting the source `sociology-phd-desk` database.
- Added separately recorded `retained`, `cleanup-pending`, and `removed` plaintext-source states for migration and standard-to-encrypted recovery.
- Added `encryptedConversion` target reservations and `deleting` tombstone recovery: existing staged ciphertext needs passphrase/identity proof before retry or discard, confirmed-absent staging can be cleared without a passphrase, and unresolved deletion remains available to bootstrap and explicit UI retry.
- Advanced candidate portable workspace and standard IndexedDB storage to v4 while keeping registry database schema v1, encrypted-vault database schema v1, and encrypted container v1 as independent version axes.

### Known limitations

- There is no account, cloud synchronization, password reset, recovery key, or secure-erasure guarantee.
- Different applications deployed under paths on the same GitHub Pages origin are not separate security origins.
- Encrypted storage cannot protect an unlocked session from hostile same-origin code, compromised dependencies or extensions, malware, administrators, screenshots, clipboard capture, or operating-system compromise.
- Phase 3C is merged and deployed but remains unreleased; it is not part of the formal `v0.1.0` release.
- The China Research Map is deferred and excluded from `v0.2.0` after its official-source review found no verified combination of source scope, public-redistribution rights, project-specific approval metadata, and testable national completeness. No production map asset or implementation has shipped; the recorded gate blocks the map itself, not the non-map release work.
- Theory Research remains a local unmerged candidate. Final full automated, build, browser, review, PR/CI, merge, exact-`main`, Pages, and public-verification evidence is still pending; hierarchical navigation remains blocked until those gates pass.

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
