# Data Model

This document describes the Phase 3B conceptual model merged into `main`, portable workspace v3, and the separate local-workspace metadata model in the unmerged Phase 3C candidate. Types and migrations in the code are authoritative for a particular revision; reconcile this document whenever the stored schema changes. Phase 3B remains unreleased, Phase 3C has not passed its publication gates, and the latest formal release remains v0.1.0 until the complete v0.2.0 release gate passes.

## Shared conventions

- Every durable object has a stable opaque ID.
- Relationships use IDs, not display titles.
- Dates use an unambiguous ISO representation where practical.
- Optional human-facing labels do not replace stable IDs.
- Demo objects carry an explicit synthetic/demo marker.
- Fieldwork identifiers must not encode names or other direct identifiers.
- Local file paths are references only; the application does not ingest or secure the files they point to.
- A portable `WorkspaceData` snapshot belongs to exactly one logical workspace. An imported snapshot must be explicitly reidentified when it creates a new workspace; entities never link across workspace boundaries.

## Local workspace boundary (Phase 3C candidate)

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

A standard workspace uses one physical IndexedDB database named from an opaque locator and the existing schema-v3 17-table domain model. Its content is ordinary structured plaintext. A UI lock does not change this representation and must not be described as encryption.

Every bound repository verifies the logical workspace ID before reads and writes. Once a registry route is converted, deleted, or no longer ready, a stale session rejects the operation, closes, and clears its cached snapshot rather than recreating the missing old database. Physical disappearance or a structurally invalid/mismatched bound database likewise poisons the standard session. Standard writes and destructive transitions are coordinated per storage locator; conversion, plaintext cleanup, and deletion require a cross-tab-safe coordinator.

### Encrypted workspace representation

An encrypted workspace uses a separate schema-v1 vault database containing exactly one authenticated ciphertext record. The record has no research-domain tables or plaintext workspace name. Outside the ciphertext it contains only a fixed record ID, protected format bytes, IV, ciphertext, `storageRevision`, `lockEpoch`, `keyInvocation`, and an encryption-attempt counter used to avoid exceeding/reusing the AES-GCM invocation space.

The decrypted payload is still a complete portable-v3 `WorkspaceData` snapshot. The derived key and plaintext snapshot exist only in an unlocked runtime session. Lock advances `lockEpoch` and clears the cooperating application's session state; reload requires a new unlock. Each asynchronous refresh/save/backup/lock path captures a runtime lifecycle generation and checks it after every awaited storage/crypto boundary. Close or lock advances the generation before clearing key/plaintext state, so a delayed decrypt cannot publish its result back into or revive the closed runtime. A missing unique vault record, authenticated tamper, stale storage generation, invalidated route, or manager close likewise poisons/closes the runtime and clears its manager-owned snapshot. This does not guarantee physical memory zeroization or protect an unlocked device/runtime.

### Demo separation

A fresh installation provisions an empty personal workspace and a distinct `demo` workspace containing only the bundled synthetic fixture. Only a legacy snapshot that exactly matches the pristine fixture is migrated as `demo`; any edited legacy demo is classified as `personal`, and bootstrap provisions a different pristine demo beside it. Demo reset operates only on the demo route. Once registry bootstrap has completed, deleting the demo does not cause a later bootstrap to silently recreate it or mix it into personal data. Ordinary imports are reidentified as non-demo when they create a new personal workspace.

### Lifecycle reservations and physical ownership

An `encryptedConversion` reservation belongs to a ready standard route and reserves a distinct encrypted target before the vault is created. A retry may reuse an existing target only after passphrase authentication and logical-workspace identity verification. Discard also requires that proof while the target exists; if physical inspection confirms that it is absent, the empty reservation may be cleared without a passphrase. Promotion clears the reservation and records the old standard database as a `PlaintextSourceReference`.

Plaintext cleanup first flushes pending research writes and requires a currently unlocked encrypted session. The manager resolves the encrypted target and plaintext source to their actual physical database names and always acquires both exclusive locks in lexical order. While both remain held, it refreshes/authenticates the current vault, rechecks the encrypted route, ensures the source physical name is not aliased by another route, conversion, recovery source, or migration, and verifies the source snapshot belongs to the same logical workspace before deletion. Workspace deletion similarly moves through `deleting`; bootstrap attempts idempotent physical deletion/finalization, and unresolved tombstones remain listable for a UI retry.

All non-bootstrap logical IDs, opaque storage locators, provisioning tokens, encrypted binding IDs, cryptographic salts, and IVs require browser cryptographic randomness and fail closed when it is unavailable. Physical database ownership checks cover ready and non-ready routes, conversion targets, recovery sources, migration ledgers, reserved application names/prefixes, and existing databases so a colliding alias is never treated as disposable storage.

## Core objects

### Research Project

Fields include project ID, title, short title, topic, method, status, start date, target date, and notes. In portable v3, research questions are separate objects rather than a `Project.researchQuestion` string.

Methods: Quantitative, Qualitative, Mixed Methods, Theoretical.

Statuses: Idea, Design, Data / Fieldwork, Analysis, Writing, Submission, Revision, Published, Archived.

The project is the primary coordination boundary for tasks, literature, fieldwork, datasets, analysis runs, evidence, logs, manuscripts, and submissions.

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

### Task and Today planning

A research task records title, date/deadline, completion state, category, priority, and a required project link. Categories distinguish reading, writing, analysis, fieldwork/interview, submission, and other research work. Today's goals are a short prioritized focus, not a second unbounded task database.

### Literature item

Fields include title, authors, year, journal, DOI, URL, project link, status, priority, why-read, and notes.

Statuses: Inbox, To Read, Reading, Read, Cited, Archived.

The object captures research relevance and argumentative use. It is not a complete citation-library record and must not manufacture DOI verification.

### Field site

Fields include site ID, site name or alias, project link, status, and notes. Use an alias when a real place would increase disclosure risk.

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

Portable v3 retains the existing `Evidence.claim` text so migration cannot discard or rewrite source context. Phase 3B does not add an evidence `claimId` or an Evidence↔Claim relationship; that remains separate Issue #2 work. Claim–question links must never be inferred from evidence text.

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
 ├─ Dataset → Analysis Run → Evidence
 ├─ Interview / Field Visit
 ├─ Research Log
 ├─ Task
 └─ Manuscript → Submission → Reviewer Comment → Revision Task
```

Research questions, claims, and their explicit many-to-many links are first-class Phase 3B objects. Evidence↔Claim remains a future explicit relationship; the retained `Evidence.claim` string must not be presented as equivalent to one.

All relationships above are scoped to one portable workspace snapshot and one physical workspace database. Even if two databases contain identical entity IDs, the application must not resolve a link endpoint across them. Cross-workspace copying happens only through an explicit, validated import/create operation that reidentifies the complete snapshot.

## Deletion and archiving

Prefer archival states for research history. Before deleting an object, identify incoming links and explain the effect. Cascading deletion of research records is unsafe unless the relationship and recovery behavior are explicit and tested.

Research questions and claims use protected deletion: a record with an incoming `ClaimQuestionLink` cannot be deleted until the user explicitly removes that link. Deleting a project is blocked while its questions, claims, or claim–question links remain; these records are not silently cascade-deleted.

## Schema evolution

- Increment the database schema version for stored-structure changes.
- Write migrations that preserve user records.
- Test upgrades from every supported prior schema.
- Update portable format versions independently when export semantics change.
- Record durable changes in `DECISIONS.md` and current limitations in `PROJECT_STATE.md`.

The Phase 3C candidate keeps version domains separate:

| Version domain | Candidate version | Meaning |
| --- | ---: | --- |
| Portable workspace | 3 | Validated research payload and import/export contract |
| Standard workspace IndexedDB | 3 | The 17 structured domain tables and v1 → v2 → v3 migration |
| Local workspace registry IndexedDB | 1 | Routing, lifecycle, migration, and cleanup metadata only |
| Encrypted vault IndexedDB | 1 | One authenticated ciphertext record and CAS coordinates |
| Encrypted container / `.sociologydesk` | 1 | Authenticated cryptographic envelope; not an application version |

Changing one axis does not automatically change the others or the package version.

### Portable workspace v3 migration

- Compose supported upgrades deterministically as v1 → v2 → v3 rather than skipping version-specific semantics.
- Migrate each non-empty legacy `Project.researchQuestion` into a first-class `ResearchQuestion` under the same project, then omit the legacy project field from v3.
- Preserve every legacy `Evidence.claim` string as source-context text in v3.
- Create first-class claims from non-empty legacy evidence claim text deterministically within each project. Grouping is allowed only for byte-for-byte equal values after trimming; do not perform semantic or fuzzy merging and do not rewrite the text.
- Do not infer that any migrated claim answers any research question. Legacy migration produces no `ClaimQuestionLink` records.
- Validate all migrated endpoint and project invariants before writing.
