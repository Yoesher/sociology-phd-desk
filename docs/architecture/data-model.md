# Data Model

This document describes website 0.4.0 S1: portable workspace, standard storage and authenticated payload v7, container/vault/registry v1. PR #57 main is `1da2883c4fd7a54125e1cea3bf321cb5c7ecdb5a`; its exact CI/CodeQL/Pages, fresh public desktop/phone smoke and native update/data-retention checks passed. The earlier verified 0.3.1 website uses v6; formal [`v0.3.0`](https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.3.0) at [`bb0d32f`](https://github.com/Yoesher/sociology-phd-desk/commit/bb0d32fe99348204ba89a16d6469014ae38e0ecf) uses v5. Phase 3C v3 and Phase 3E v4 remain migration history. Types/migrations are authoritative for a revision; deployment evidence belongs in `PROJECT_STATE.md`, and later documentation commits require independent verification. [Local-map/storage guide](../local-field-maps-and-storage-2026-10-04.md).

## Shared conventions

- Every durable object has a stable opaque ID.
- Relationships use IDs, not display titles.
- Dates use an unambiguous ISO representation where practical.
- Optional human-facing labels do not replace stable IDs.
- Demo objects carry an explicit synthetic/demo marker.
- Fieldwork identifiers must not encode names or other direct identifiers.
- Local file paths are references only; the application does not ingest or secure the files they point to.
- Optional literature PDFs are distinct from path references: v6 stores the selected file's bytes with the record and includes them in ordinary/encrypted backups.
- v7 also persists user-supplied local-map image bytes and explicit same-project site markers; raw EXIF/GPS may remain, and normalized image positions do not anonymize detailed material.
- A portable `WorkspaceData` snapshot belongs to exactly one logical workspace. An imported snapshot must be explicitly reidentified when it creates a new workspace; entities never link across workspace boundaries.

## Local workspace boundary (Phase 3C)

The local workspace registry and encryption container are infrastructure metadata, not new research-domain collections inside portable `WorkspaceData`.

### Workspace registry entry

`WorkspaceRegistryEntry` routes one logical workspace to one physical storage adapter. Its fields include:

- stable logical `id` and opaque local `storageId`;
- user-authored `displayName`;
- `kind`: `personal` or `demo`;
- `encryptionMode`: `standard` or `encrypted`;
- `createdAt`, `updatedAt`, optional `lastOpenedAt`, and optional `lastExportedAt`;
- portable `schemaVersion`, adapter `storageSchemaVersion`, and optimistic `registryRevision`;
- locale-neutral `autoLock`: `never`, `5`, `15`, `30`, or `60`;
- lifecycle `state`: `provisioning`, `ready`, `migration-failed`, or `deleting`;
- optional provisioning/migration coordinates, recorded plaintext recovery sources, and a durable `encryptedConversion` reservation containing target locator, target storage version, source workspace revision, start time, and optional verification time.

The registry is plaintext by design so the application can list, route, and recover workspaces before an encrypted workspace is unlocked. Display name, times, modes, auto-lock, versions, lifecycle state, conversion/recovery coordinates, and opaque locators are therefore visible to code with origin access. The registry must not hold domain collections, passphrases, derived keys, password verifiers, or content-derived digests.

`displayName` is the canonical user-visible workspace name. Plain JSON export and encrypted-backup creation copy the current registry value into the generated payload after refreshing the active route. That copy does not persist a changed domain snapshot or advance `workspace.revision`; the later best-effort `lastExportedAt` update is separate registry metadata and may advance `registryRevision`.

`PlaintextSourceReference` records non-sensitive recovery truth for a legacy or standard database with state `retained`, `cleanup-pending`, or `removed`. It may name the source database/storage locator and verification/removal time. It does not copy the source research content into the registry.

### Workspace registry settings and migration ledger

One schema-v1 registry settings record stores the bootstrap version and optional active logical workspace ID. Before bootstrap completion, deterministic seed IDs/locators and convergent provisioning let concurrent callers acquire the same initial personal/demo routes; these locators are coordination values, not security secrets. Once `bootstrapVersion` is recorded, deleting an initial workspace does not silently seed it again.

A migration ledger identifies the legacy database/workspace revision and intended target, then records `copying`, `verified`, or `failed`. Idempotence is based on that source identity and revision; the source is reread before route publication, and a failed, repeated, or source-raced bootstrap does not silently delete or overwrite it. Provisioning and migration also inspect the proposed physical database before creation and reject unexplained existing storage.

### Standard workspace representation

A standard workspace uses one physical IndexedDB database named from an opaque locator. The 0.4.0 source uses v7/20 plaintext tables including metadata, Theory, Zotero references and new fieldMaps. Historical 0.3.1 v6/formal v0.3.0 v5 used 19 tables; Phase 3C started at v3/17. PDF/image bytes are ordinary structured plaintext. A UI lock does not change this representation and must not be described as encryption.

Every bound repository verifies the logical workspace ID before reads and writes. Once a registry route is converted, deleted, or no longer ready, a stale session rejects the operation, closes, and clears its cached snapshot rather than recreating the missing old database. Physical disappearance or a structurally invalid/mismatched bound database likewise poisons the standard session. Standard writes and destructive transitions are coordinated per storage locator; conversion, plaintext cleanup, and deletion require a cross-tab-safe coordinator.

### Encrypted workspace representation

An encrypted workspace uses a separate schema-v1 vault database containing exactly one authenticated ciphertext record. The record has no research-domain tables or plaintext workspace name. Outside the ciphertext it contains only a fixed record ID, protected format bytes, IV, ciphertext, `storageRevision`, `lockEpoch`, `keyInvocation`, and an encryption-attempt counter used to avoid exceeding/reusing the AES-GCM invocation space.

The decrypted payload is a complete portable WorkspaceData snapshot, including PDF/image bytes and markers. The 0.4.0 source writes v7 and accepts authenticated v3/v4/v5/v6 only through explicit migration plus verified atomic rewrite. The derived key and plaintext snapshot exist only while unlocked. Lock advances lockEpoch and clears cooperating session state; reload requires unlock. Every asynchronous storage/crypto path rechecks its lifecycle generation so close/lock cannot be undone by a delayed decrypt. Missing/tampered/stale/invalidated storage poisons the runtime and clears its manager-owned snapshot. This does not guarantee physical memory zeroization or protect an unlocked device/runtime.

### Demo separation

A fresh installation provisions an empty personal workspace and a distinct `demo` workspace containing only the bundled synthetic fixture. Only a legacy snapshot that exactly matches the pristine fixture is migrated as `demo`; any edited legacy demo is classified as `personal`, and bootstrap provisions a different pristine demo beside it. Demo reset operates only on the demo route. Once registry bootstrap has completed, deleting the demo does not cause a later bootstrap to silently recreate it or mix it into personal data. Ordinary imports are reidentified as non-demo when they create a new personal workspace.

### Lifecycle reservations and physical ownership

An `encryptedConversion` reservation belongs to a ready standard route and reserves a distinct encrypted target before the vault is created. A retry may reuse an existing target only after passphrase authentication and logical-workspace identity verification. Discard also requires that proof while the target exists; if physical inspection confirms that it is absent, the empty reservation may be cleared without a passphrase. Promotion clears the reservation and records the old standard database as a `PlaintextSourceReference`.

Plaintext cleanup first flushes pending research writes and requires a currently unlocked encrypted session. The manager resolves the encrypted target and plaintext source to their actual physical database names and always acquires both exclusive locks in lexical order. While both remain held, it refreshes/authenticates the current vault, rechecks the encrypted route, ensures the source physical name is not aliased by another route, conversion, recovery source, or migration, and verifies the source snapshot belongs to the same logical workspace before deletion. Workspace deletion similarly moves through `deleting`; bootstrap attempts idempotent physical deletion/finalization, and unresolved tombstones remain listable for a UI retry.

All non-bootstrap logical IDs, opaque storage locators, provisioning tokens, encrypted binding IDs, cryptographic salts, and IVs require browser cryptographic randomness and fail closed when it is unavailable. Physical database ownership checks cover ready and non-ready routes, conversion targets, recovery sources, migration ledgers, reserved application names/prefixes, and existing databases so a colliding alias is never treated as disposable storage.

## Core objects

### Research Project

Fields include project ID, title, short title, topic, method, status, start date, target date, and notes. Since portable v3, research questions are separate objects rather than a `Project.researchQuestion` string; current v7 preserves that model.

Methods: Quantitative, Qualitative, Mixed Methods, Theoretical.

Statuses: Idea, Design, Data / Fieldwork, Analysis, Writing, Submission, Revision, Published, Archived.

The project is the primary coordination boundary for tasks, literature, fieldwork, datasets, analysis runs, evidence, logs, theory memos, manuscripts, and submissions.

A project space is a display projection within this logical workspace, not a new physical database. New records use the selected project; every write, backup, migration, conflict check, and diagnostic retains the complete-workspace boundary and other projects. Today's goals remain workspace-wide. The selected project ID may be remembered as session UI context without persisting research text there.

### Research question

Fields include stable question ID, project ID, text, status, notes, creation time, update time, and the shared synthetic/demo marker.

Persisted statuses: `draft`, `active`, `addressed`, `retired`.

A question's ID remains stable when its wording, notes, or status changes. Text is authored research content, not a key and not a locale resource. Every question belongs to exactly one project.

### Analytical claim

Fields include stable claim ID, project ID, text, status, notes, creation time, update time, and the shared synthetic/demo marker.

Persisted statuses: `draft`, `active`, `superseded`, `retired`.

An analytical claim is a judgment formed and revised during research. Its status does not mean that the claim has been proven, nor does it represent statistical significance. A claim's ID remains stable as the analysis changes, and every claim belongs to exactly one project.

The interface explains this boundary as: “分析主张是研究过程中形成和修订的分析判断。其状态不代表该主张已经被证实，也不代表统计显著性。” / “Analytical claims are interpretive judgments formed and revised during the research process. Their status does not indicate that they have been substantiated, nor does it indicate statistical significance.”

### Claim–question link

`ClaimQuestionLink` represents the explicit many-to-many relationship between claims and research questions. It contains stable entity metadata plus `projectId`, `researchQuestionId`, and `claimId`.

Both endpoints must exist and must share the link's project. Cross-project links, missing endpoints, and duplicate claim–question pairs are invalid. The relationship uses stable IDs rather than text, and no relationship is inferred from matching or similar prose.

### Theory memo (Phase 3E)

`TheoryMemo` is the only new theory-specific entity. Fields are stable memo ID, project ID, locale-neutral `memoType`, user-authored title and content, arrays of related question/claim/literature IDs, creation/update times, and the shared synthetic/demo marker.

Persisted types are `concept`, `mechanism`, `dialogue`, `counterargument`, `boundary`, and `synthesis`. Labels and structured prompts are localized UI resources; prompts never become stored content automatically.

Every related endpoint must exist and share the memo's project. Duplicate IDs within any one relationship array, missing endpoints, and cross-project relationships are invalid. Project, question, claim, and literature deletion is blocked while a memo references that record. Deleting a memo removes only the memo; it never deletes an endpoint. Manuscript remains the writing object, including for theoretical manuscripts.

### Task and Today planning

A research task records title, date/deadline, completion state, category, priority, and a required project link. Categories distinguish reading, writing, analysis, fieldwork/interview, submission, the raw value `Theory / Conceptual Work`, and other research work. Today's goals are a short prioritized focus, not a second unbounded task database.

`0.3.1` permits an omitted deadline, displays the absolute due date and calendar-day remaining/overdue status, and supports editing deadline and notes while retaining completion state. Reminders appear while the application is open; they do not schedule closed-webpage system notifications.

### Literature item

Fields include title, authors, year, journal, DOI, URL, project link, status, priority, why-read, and notes.

Portable v6 introduced optional `localPdf: { fileName, size, base64 }`. 0.4.0 raises historical 0.3.1 limits of 5/12 MiB to 10 MiB each / 20 MiB per workspace. Validation checks filename, PDF header, canonical encoding, declared byte size and aggregate limit before persistence/import. Complete ordinary JSON includes bytes in plaintext; encrypted workspace/backup encrypt the same snapshot. Downloads decode on click and use temporary, cleaned object URLs. Zotero remains metadata-only. The separate complete-readable-JSON 32 MiB budget may be reached before attachment maxima; no data is truncated.

Statuses: Inbox, To Read, Reading, Read, Cited, Archived.

The object captures research relevance and argumentative use. It is not a complete citation-library record and must not manufacture DOI verification.

### Literature external reference (v0.3.0)

`LiteratureExternalReference` stores a stable link from one existing Literature item to the allowlisted provider `zotero`. It records stable metadata, `literatureItemId`, provider, external library/item identity, optional external version and last-seen modified time, and import time. Provider identity remains separate from researcher-authored literature fields. The same provider/library/item identity is unique, and a missing Literature endpoint is invalid. Migration to v5 adds an empty collection and never infers Zotero identity from bibliographic text.

### Field site

Fields include site ID, site name or alias, project link, status, and notes. Use an alias when a real place would increase disclosure risk.

### Local field map (v7)

`FieldMap` has metadata, projectId, title, `image: { fileName, mimeType, size, width, height, base64 }` and `markers: [{ fieldSiteId, x, y }]`. Static PNG/JPEG bytes are ≤2 MiB per image / ≤4 MiB per workspace, edge ≤8192 / area ≤16 million pixels. Markers use finite normalized x/y in [0,1], unique per site per map, and an existing same-project site. Unknown geographic-coordinate fields, missing/duplicate/cross-project endpoints and malformed image metadata fail validation.

Use only entitled coarse county-or-broader sketches or anonymous public settings; participant homes, precise participant locations and identifiers are outside scope. Raw metadata may remain, and normalized positions do not guarantee anonymity or legal/map-review approval. No bundled national map/catalog, online map/tile, GPS or public image export is provided; national gates remain BLOCKED. Removing maps/markers retains research records, replacing annotated images requires explicit marker clearing, and site/project endpoint operations are protected.

### Interview

Fields include interview ID, participant alias, project link, field-site link, interview date, status, transcript status, coding status, memo status, and notes.

The participant alias is not permission to enter a direct identifier. Source transcripts remain outside the application unless a future ethically reviewed design explicitly changes that boundary.

### Field visit

Fields include visit ID, date, site link, purpose, observations, follow-up, and memo. Observations must be written with disclosure risk in mind.

### Dataset

Fields include dataset ID, name, wave, source, local-path reference, project link, and notes. It is a registry record, not the dataset itself.

### Analysis run

Fields include run ID, project link, date, software, script-path reference, dataset link, sample, model, outcome, key predictor, status, result summary, and output-path reference.

Software: Stata, R, Python, Other.

Future versions should add model specification, robustness checks, sample restrictions, timestamps, and code versions without pretending to execute or validate the analysis automatically.

### Evidence item

Fields include evidence ID, project link, legacy/source-context claim text, evidence type, source, locator, finding, support level, limitations, and manuscript location.

Evidence types: Literature, Quantitative Result, Interview, Fieldnote, Policy / Document, Other.

Support levels: Strong, Moderate, Weak, Contradictory, Unclear.

A support level is a researcher's documented judgment. It is not an automated truth score. Locator and limitations are essential provenance fields.

Portable v3 introduced retention of the existing Evidence.claim text; current v7 preserves it unchanged. Evidence↔Claim remains separate Issue #2 work, and neither Claim–question nor Theory links are inferred from evidence text.

### Research log entry

Fields include date, project link, what changed, decision, problem, and next step. This is a research decision trail, not a general diary.

### Manuscript

Fields include title, project link, target journal, status, word count, next action, and deadline.

Statuses: Idea, Outline, Drafting, Internal Review, Ready to Submit, Submitted, Under Review, Revision, Accepted, Published, Rejected, Reworking.

### Submission

Fields include manuscript/project link, journal, submission date, manuscript version, status, editorial status, decision date, decision, and notes.

### Reviewer comment

Fields include submission link, reviewer label, comment ID, comment, severity, response, revision action, and status.

Statuses: Open, Addressing, Resolved, Rejected with Rationale.

Reviewer labels should avoid unnecessary identifying speculation.

## Relationship direction

The target graph is:

```text
Project
 ├─ Research Question ← ClaimQuestionLink → Claim
 ├─ Literature
 ├─ Theory Memo → Research Question / Claim / Literature
 ├─ Dataset → Analysis Run → Evidence
 ├─ Interview / Field Visit
 ├─ Local Field Map → same-project Field Site → Interview / Field Visit
 ├─ Research Log
 ├─ Task
 └─ Manuscript → Submission → Reviewer Comment → Revision Task
```

Research questions, claims, and their explicit many-to-many links are first-class Phase 3B objects. Evidence↔Claim remains a future explicit relationship; the retained `Evidence.claim` string must not be presented as equivalent to one.

All relationships above are scoped to one portable workspace snapshot and one physical workspace database. Even if two databases contain identical entity IDs, the application must not resolve a link endpoint across them. Cross-workspace copying happens only through an explicit, validated import/create operation that reidentifies the complete snapshot.

## Deletion and archiving

Prefer archival states for research history. Before deleting an object, identify incoming links and explain the effect. Cascading deletion of research records is unsafe unless the relationship and recovery behavior are explicit and tested.

Research questions and claims use protected deletion: a record with an incoming `ClaimQuestionLink` cannot be deleted until the user explicitly removes that link. Incoming Theory Memo references likewise protect questions, claims, literature, and projects. Deleting a project is blocked while its questions, claims, claim–question links, or theory memos remain; these records are not silently cascade-deleted.

Field-map project/site references also protect deletion and site project reassignment. Deleting a map/marker preserves the site, visit and interview records; it never silently cascades through them. Import collisions must not rebind a new map to a different local site identity.

## Schema evolution

- Increment the database schema version for stored-structure changes.
- Write migrations that preserve user records.
- Test upgrades from every supported prior schema.
- Update portable format versions independently when export semantics change.
- Record durable changes in `DECISIONS.md` and current limitations in `PROJECT_STATE.md`.

Current 0.4.0 website S1 axes are below; exact deployment evidence is separately recorded in PROJECT_STATE.md. Historical 0.3.1 uses v6 and formal v0.3.0 uses v5:

| Version domain | Current version | Meaning |
| --- | ---: | --- |
| Portable workspace | 7 | Complete research payload, migration v1 through v7, PDF/image bytes and markers |
| Standard workspace IndexedDB | 7 | 20 tables including the new fieldMaps store |
| Authenticated encrypted payload | 7 | Complete snapshot; authenticated v3/v4/v5/v6 migrate before use |
| Local workspace registry IndexedDB | 1 | Routing, lifecycle, migration, and cleanup metadata only |
| Encrypted vault IndexedDB | 1 | One authenticated ciphertext record and CAS coordinates |
| Encrypted container / `.sociologydesk` | 1 | Authenticated cryptographic envelope; not an application version |

Changing one axis does not automatically change the others or the package version.

### Portable workspace migration through v7

- Compose supported upgrades deterministically as v1 → v2 → v3 → v4 → v5 → v6 → v7 rather than skipping version-specific semantics.
- Migrate each non-empty legacy `Project.researchQuestion` into a first-class `ResearchQuestion` under the same project, then omit the legacy project field from v3.
- Preserve every legacy `Evidence.claim` string as source-context text in v3.
- Create first-class claims from non-empty legacy evidence claim text deterministically within each project. Grouping is allowed only for byte-for-byte equal values after trimming; do not perform semantic or fuzzy merging and do not rewrite the text.
- Do not infer that any migrated claim answers any research question. Legacy migration produces no `ClaimQuestionLink` records.
- Validate all migrated endpoint and project invariants before writing.
- Migrate v3 → v4 by adding only `theoryMemos: []`. Reject an ambiguous v3 input that already contains `theoryMemos`; never convert research logs, notes, tasks, claims, or other text into theory records.
- Migrate v4 → v5 by adding only `literatureExternalReferences: []`. Reject an ambiguous v4 input that already contains the v5 collection; never infer Zotero identity from DOI, ISBN, title, authors, year, URL, or other bibliographic text.
- Migrate v5 → v6 by changing only the envelope version and preserving existing literature and Zotero provenance. Do not infer attachments; reject a v5 envelope that already contains a `localPdf` property.
- v6 → v7 adds only fieldMaps: []; preserve existing PDF/research bytes and reject ambiguous preexisting fieldMaps, without inventing images or coordinates.
- Authenticate legacy portable-v3/v4/v5/v6 ciphertext before migration. Publish v7 only after validation/read-back; restore validates before creating a new vault. Failure retains old authenticated ciphertext and creates no partial destination.
- A v7 backup requires a v7-capable application; earlier 0.3.1 (v6) cannot read it. Preserve tested original-version backups before moving between app versions.

## Schema9 candidate extension

The unpublished0.6.0-rc.1 candidate preserves the existing19 collections and adds shared8 plus qualitative17. See [qualitative provenance](qualitative-provenance.md) for the exact collection registry and ownership/version rules. Executable interfaces, strict row schemas, graph constraints and full-snapshot commands live in src/models/provenance.ts and src/utils/provenance-*.ts. TheoryMemo/Claim/EvidenceItem/Manuscript remain canonical roots; there is no parallel analytical memo or manuscript evidence object.
