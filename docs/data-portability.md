# Data Portability and Import Safety

## Purpose

JSON export and import provide backup, inspection, and migration for a browser-local workspace. They are not cloud synchronization and do not make the exported file encrypted.

Verified public `main` [`ca4429f`](https://github.com/Yoesher/sociology-phd-desk/commit/ca4429facfa124e85c3dba37f9ce7da270a82601) implements portable workspace v3 plus the Phase 3C local-workspace registry and `.sociologydesk` container. The current Phase 3E **local unmerged candidate** advances portable and standard storage to v4 while keeping encrypted container v1, encrypted-vault database v1, and registry database v1. Candidate final full-suite/build/browser/PR/CI/merge/Pages evidence remains pending; `PROJECT_STATE.md` is the factual gate record.

## Export envelope

An ordinary portable JSON export contains:

- application identifier;
- portable format version;
- export timestamp;
- explicitly synthetic/demo marker where applicable;
- validated collections of supported research objects.

It should not contain analytics IDs, machine credentials, secrets, source file contents, or a hidden remote identifier. Local path references may still be sensitive and should be reviewed before sharing.

Ordinary JSON is plaintext even when it was exported from an unlocked encrypted workspace. The UI must warn before producing it; the `.json` path remains useful for inspection and migration but is not an encrypted backup.

Before either export path is generated, the active snapshot and registry route are refreshed and the registry's canonical `displayName` is copied into the output payload. This export-only copy does not rewrite the active research database or advance `workspace.revision`. Best-effort `lastExportedAt` bookkeeping happens separately in registry metadata and may advance only `registryRevision`.

## Encrypted `.sociologydesk` backup

Phase 3C defines a separate encrypted-backup container v1. It is not a portable JSON envelope renamed with a custom extension:

- the file extension is `.sociologydesk` and the encrypted-backup purpose is authenticated in its protected header;
- new candidate backups contain a complete, strictly validated portable-v4 workspace; authenticated legacy portable-v3 payloads are supported only through explicit in-memory migration;
- each backup uses a fresh PBKDF2 salt and AES-GCM IV, independent from the local vault and every other backup;
- the protected header intentionally omits workspace name, logical/binding ID, and research timestamp, although the authenticated/decrypted portable payload contains the canonical exported workspace name;
- the exact transport wrapper uses canonical JSON field order (`protected`, `iv`, `ciphertext`) and canonical unpadded base64url, but its contents are an authenticated ciphertext container rather than inspectable portable JSON;
- the wrapper/header is rejected if fields, bytes, encoding, size, or versions are missing, unknown, noncanonical, or unsupported;
- authentication, explicit v3 → v4 migration where needed, complete portable-v4 validation, and workspace-identity checks happen before any destination registry or database write;
- restore always creates a new logical workspace ID and a new encrypted-vault binding; it never overwrites the source workspace merely because the backup carries the same decrypted identity.

The protected header is limited to 8 KiB and ciphertext to 64 MiB. Content is not compressed. The operating system and filesystem can still expose file name, size, location, and file timestamps. There is no password reset or recovery key.

## Import sequence

1. Parse JSON without writing to the database.
2. Validate the application identity, format version, collections, fields, IDs, relationships, enumerations, and dates.
3. Present a summary: objects to add, collisions, unsupported content, and validation failures.
4. Require the user to choose a supported mode.
5. Apply all writes in a transaction.
6. Report the exact result; do not treat skipped or failed records as imported.

Malformed or incompatible input must not produce a partial workspace.

When ordinary JSON carries a different workspace ID, the local-workspace flow creates a new personal workspace with a new local route rather than writing through the currently bound repository. Same-workspace import may use the existing previewed merge or explicit replacement semantics. Encrypted restore always uses the authenticated restore-as-new path described above.

## Merge mode

Merge is the default. New IDs may be added. Existing-ID collisions must be visible and must preserve the local record until the user makes a supported conflict choice. Implementations may evolve richer per-record resolution, but must never adopt silent last-write-wins behavior.

## Replace mode

Replace is a separate destructive operation. It must:

- name the workspace/data that will be replaced;
- explain that local records not in the import will be removed;
- require explicit confirmation distinct from selecting a file;
- offer or strongly prompt an export backup when feasible;
- validate the complete incoming workspace before deleting anything;
- perform replacement transactionally so failure does not leave an empty or partial database.

## Schema versions

Database schema and portable format versions solve different problems. An internal IndexedDB migration need not change the portable format if its meaning is unchanged; an export semantic change may require a new portable version even without a database migration.

Public `main` uses IndexedDB schema v3 and portable workspace v3. The unmerged Theory candidate advances both axes to v4 for its new `theoryMemos` collection, but they remain independent versions and are unrelated to the unchanged package version `0.1.0`.

Candidate portable import composes supported migration explicitly as v1 → v2 → v3 → v4:

1. v1 → v2 supplies the application discriminator and initial optimistic revision that the pre-release v1 envelope did not contain.
2. v2 → v3 removes the legacy `Project.researchQuestion` field after creating a stable-ID `ResearchQuestion` under the same project for each non-empty value.
3. Each non-empty legacy `Evidence.claim` contributes to deterministic Claim creation. Only exact equality after trimming, within the same project, may group sources; records from different projects never merge.
4. The original `Evidence.claim` string remains in the evidence record as source-context text. Migration does not rewrite or discard it.
5. Migration does not perform semantic matching, fuzzy matching, or infer that a Claim answers a ResearchQuestion. Legacy `claimQuestionLinks` therefore starts empty.
6. v3 → v4 adds only `theoryMemos: []`. It never converts logs, notes, tasks, claims, literature annotations, or other user-authored text into theory content. A v3 envelope that already contains a `theoryMemos` field is ambiguous and rejected rather than guessed.

The v3 envelope adds `researchQuestions`, `claims`, and `claimQuestionLinks`. Each record uses a stable ID. A `ClaimQuestionLink` names `projectId`, `researchQuestionId`, and `claimId`; both endpoints must exist in that same project, and a duplicate endpoint pair is invalid. Text is never used as a foreign key.

Phase 3B does not introduce an Evidence↔Claim relationship or an evidence `claimId`; that remains separate Issue [#2](https://github.com/Yoesher/sociology-phd-desk/issues/2). Retaining the legacy evidence text is not equivalent to an explicit relationship.

The v4 envelope retains every v3 collection and adds `theoryMemos`. Every memo has a stable project ID, stable locale-neutral type, and explicit same-project question/claim/literature ID arrays. Missing endpoints, duplicate IDs within an array, and cross-project references fail validation before write.

Malformed legacy graph or theory fields are rejected rather than silently discarded. Unsupported future versions fail validation rather than being guessed or partially imported.

Unsupported future versions should fail safely with an actionable message. Old supported formats should migrate through tested transformations.

### Independent candidate version axes

Phase 3C shipped the v3/v3/v1/v1/v1 baseline. The current local candidate changes only the first two axes:

| Version domain | Candidate version | Scope |
| --- | ---: | --- |
| Portable workspace | 4 | Candidate plaintext research payload and JSON import/export |
| Standard workspace database | 4 | Candidate per-workspace 18-table IndexedDB adapter |
| Registry database | 1 | Plaintext routing/recovery metadata only |
| Encrypted-vault database | 1 | One ciphertext record and CAS coordinates |
| Encrypted container / backup | 1 | Local-vault and encrypted-backup cryptographic envelopes with distinct authenticated purposes |

These numbers are not the package version. A future change to cryptography, the registry, or portable semantics must advance the affected axis explicitly rather than reinterpret v1/v4 in place.

## Legacy singleton migration

The previous physical singleton database is named `sociology-phd-desk`. Phase 3C migration treats it as a recovery source, not a target to mutate:

1. Discover and read the supported v1/v2/v3/v4 source without changing it.
2. Compose the existing database/portable migrations into one valid portable-v4 snapshot.
3. Reserve a fresh opaque standard-workspace target only after checking registry routes, conversion/recovery locators, migration ledgers, reserved names, and physical existence; an unknown or aliased database is never cleared for reuse.
4. Write the complete snapshot, close/reopen the physical target, read it back, validate it, and compare it semantically with the source.
5. Re-read the legacy source and publish a ready registry route only if its identity, revision, and complete content are unchanged; otherwise record a recoverable failure and retain the source.
6. A repeated bootstrap recognizes the same source identity/revision and returns the same verified result. Concurrent first boots use deterministic seed routes and convergent provisioning rather than duplicating personal/demo workspaces.

The legacy database is never automatically deleted. A migration cannot classify arbitrary user data as the bundled demo: only the exact pristine synthetic fixture is `demo`. An edited legacy demo is migrated as `personal`, and bootstrap creates a separate pristine demo with a non-colliding deterministic identity. On a fresh installation, empty personal and synthetic demo workspaces are likewise provisioned separately.

## Standard-to-encrypted conversion

Conversion is a two-stage operation coordinated per physical workspace:

1. Under a cross-tab-safe exclusive lock, refresh the latest standard snapshot, preflight a fresh encrypted database name, and durably attach an `encryptedConversion` reservation to the standard route **before** target creation. Create the vault, read back its actual ciphertext, authenticate/decrypt it, strictly validate portable v4, compare it semantically, and re-read the still-current standard source. Only then promote the registry route to encrypted mode and record the standard source as retained.
2. After a later successful encrypted reopen, the user may request separate plaintext cleanup. Pending research writes are flushed first. The manager then requires the current unlocked encrypted session and takes stable lexically ordered exclusive locks on the encrypted target and plaintext source using their actual physical database names. While both locks remain held, it refreshes/authenticates the current vault, rechecks the route, proves that the source database name is not shared or aliased, and reads the source identity before deletion. Failure before or during physical deletion leaves the source recorded as pending. Failure after physical deletion but before registry finalization may leave a conservative `cleanup-pending` marker until an idempotent retry verifies absence. Even successful IndexedDB deletion is logical deletion, not a secure-erasure guarantee.

The reservation makes interrupted staging explicit:

- if the reserved vault exists, a retry must authenticate it with the supplied passphrase, verify the logical workspace identity, and compare it with the current standard source before it can be promoted;
- if an existing staged vault is to be discarded, the passphrase and identity proof are still required before deleting that vault;
- if physical inspection confirms that the reserved vault is absent, the empty reservation may be cleared without a passphrase before a new target is reserved.

A stale standard session may not recreate or write the old database after promotion or cleanup. Missing standard storage, a missing encrypted-vault record, authenticated tamper, route invalidation, or manager close poisons the relevant session and clears its cached snapshot. Encrypted async operations carry a lifecycle generation across each storage/crypto await; close or lock advances it, so a delayed refresh fails closed instead of repopulating a closed runtime. If the browser cannot provide cross-tab-safe destructive coordination, conversion, cleanup, and deletion fail closed. Random logical IDs, non-bootstrap locators/tokens, encrypted bindings, salts, and IVs also fail closed when cryptographically secure randomness is unavailable.

## Workspace deletion recovery

Workspace deletion publishes a `deleting` registry tombstone before touching physical storage. Database-name ownership and workspace identity are rechecked, only the owned database is removed, and the registry entry is finalized only after absence is verified. Bootstrap automatically retries unresolved tombstones when cross-tab-safe locking is available; otherwise they stay discoverable in Workspace Center with an explicit retry action. This recovery state reports what the application has verified and is not a secure-erasure claim.

## Research-graph deletion safety

Portable validation rejects missing link endpoints, cross-project links, and duplicate Claim–ResearchQuestion pairs before any write. Repository replacement and merge use the same relationship validation.

A question or claim referenced by `ClaimQuestionLink` is protected from deletion until the relationship is explicitly removed. Project deletion is likewise blocked while questions, claims, or link records remain. Import, merge, and replacement must not silently cascade-delete these records or leave orphaned links.

In the candidate, Theory Memo references add the same protection for their project, question, claim, and literature endpoints. Deleting a memo removes only that memo; import, merge, replacement, and deletion must not cascade through its relationships.

## Required tests

- current-version export validates against its own schema;
- deterministic v1 → v2 → v3 → v4 migration and each supported adjacent path produce the same valid current envelope;
- legacy project-question text migrates without remaining on the v3 project record;
- legacy evidence claim text remains unchanged while same-project exact-trimmed claims receive deterministic IDs;
- migration creates no inferred Claim–ResearchQuestion links;
- missing, cross-project, and duplicate Claim–ResearchQuestion links fail validation;
- v3 → v4 adds only an empty `theoryMemos` collection and rejects ambiguous preexisting theory fields;
- Theory Memo types and same-project question/claim/literature links survive round trip; missing, duplicate, and cross-project endpoints fail validation;
- memo references protect projects and endpoints from deletion, while deleting a memo preserves all endpoints;
- linked questions and claims, and projects with graph dependents, cannot be silently deleted;
- export → empty database import round trip;
- merge with no collisions;
- merge with collisions preserves existing records until resolution;
- explicit replace succeeds transactionally;
- invalid JSON and invalid fields produce no writes;
- unsupported version produces no writes;
- database or validation failure does not leave partial state;
- demo markers and relationship IDs survive round trip;
- sensitive-path warning is visible in the UI.
- idempotent v1/v2/v3/v4 legacy-singleton copy, physical read-back, semantic equality, and failure retention;
- target-storage collision, orphaned target, interrupted provisioning, and retry behavior without deleting an unrelated database;
- deterministic concurrent bootstrap convergence and edited-legacy-demo classification as personal beside a separate pristine demo;
- fresh empty personal workspace and separate exact synthetic demo workspace, including demo-only reset and deleted-demo behavior;
- same entity IDs in separate physical databases remain isolated and cross-workspace endpoints are rejected;
- stale standard sessions cannot recreate or modify plaintext after conversion, cleanup, or deletion;
- encrypted local/backup round trips, independent salt/IV generation, wrong-passphrase and tamper generic failures, strict canonical wrapper parsing, and authentication-before-write;
- authenticated legacy portable-v3 vault/backup migration to v4, verified read-back, idempotent repeat unlock, and old-ciphertext retention on every failure path;
- lock, reload, auto-lock, lock-epoch delayed-write rejection, and cross-tab route transition behavior;
- plaintext JSON export from standard/encrypted workspaces remains visibly distinct from `.sociologydesk` encrypted backup;
- canonical registry-name export copies do not persist a domain rename or advance the workspace-data revision;
- encrypted restore creates a new logical workspace identity and wrong-password/corrupt restore creates no registry or vault record;
- interrupted encrypted conversion requires authentication before retry/discard of an existing target, while a confirmed-absent target can be cleared without a passphrase;
- retained plaintext is removed only through a current authenticated encrypted session plus source-identity/alias checks; cleanup/deletion failures retain UI-discoverable recoverable state.

See the bilingual threat model for what portability and encryption do not protect: [中文](zh-CN/privacy-model.md) / [English](en/privacy-model.md).
