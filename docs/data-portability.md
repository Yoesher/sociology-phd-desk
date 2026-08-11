# Data Portability and Import Safety

## Purpose

JSON export and import provide backup, inspection, and migration for a browser-local workspace. They are not cloud synchronization and do not make the exported file encrypted.

## Export envelope

A portable export should contain:

- application identifier;
- portable format version;
- export timestamp;
- explicitly synthetic/demo marker where applicable;
- validated collections of supported research objects.

It should not contain analytics IDs, machine credentials, secrets, source file contents, or a hidden remote identifier. Local path references may still be sensitive and should be reviewed before sharing.

## Import sequence

1. Parse JSON without writing to the database.
2. Validate the application identity, format version, collections, fields, IDs, relationships, enumerations, and dates.
3. Present a summary: objects to add, collisions, unsupported content, and validation failures.
4. Require the user to choose a supported mode.
5. Apply all writes in a transaction.
6. Report the exact result; do not treat skipped or failed records as imported.

Malformed or incompatible input must not produce a partial workspace.

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

The Phase 3B development candidate uses IndexedDB schema v3 and portable workspace v3. These numbers happen to advance together for the research-graph change but remain independent version axes. The published v0.1.0 release evidence is unchanged, and this candidate is not a new release.

Portable import composes supported migration explicitly as v1 → v2 → v3:

1. v1 → v2 supplies the application discriminator and initial optimistic revision that the pre-release v1 envelope did not contain.
2. v2 → v3 removes the legacy `Project.researchQuestion` field after creating a stable-ID `ResearchQuestion` under the same project for each non-empty value.
3. Each non-empty legacy `Evidence.claim` contributes to deterministic Claim creation. Only exact equality after trimming, within the same project, may group sources; records from different projects never merge.
4. The original `Evidence.claim` string remains in the evidence record as source-context text. Migration does not rewrite or discard it.
5. Migration does not perform semantic matching, fuzzy matching, or infer that a Claim answers a ResearchQuestion. Legacy `claimQuestionLinks` therefore starts empty.

The v3 envelope adds `researchQuestions`, `claims`, and `claimQuestionLinks`. Each record uses a stable ID. A `ClaimQuestionLink` names `projectId`, `researchQuestionId`, and `claimId`; both endpoints must exist in that same project, and a duplicate endpoint pair is invalid. Text is never used as a foreign key.

Phase 3B does not introduce an Evidence↔Claim relationship or an evidence `claimId`; that remains separate Issue [#2](https://github.com/Yoesher/sociology-phd-desk/issues/2). Retaining the legacy evidence text is not equivalent to an explicit relationship.

Malformed legacy graph fields are rejected rather than silently discarded. Unsupported future versions fail validation rather than being guessed or partially imported.

Unsupported future versions should fail safely with an actionable message. Old supported formats should migrate through tested transformations.

## Research-graph deletion safety

Portable validation rejects missing link endpoints, cross-project links, and duplicate Claim–ResearchQuestion pairs before any write. Repository replacement and merge use the same relationship validation.

A question or claim referenced by `ClaimQuestionLink` is protected from deletion until the relationship is explicitly removed. Project deletion is likewise blocked while questions, claims, or link records remain. Import, merge, and replacement must not silently cascade-delete these records or leave orphaned links.

## Required tests

- current-version export validates against its own schema;
- deterministic v1 → v2 → v3 migration and direct v2 → v3 migration produce the same valid current envelope;
- legacy project-question text migrates without remaining on the v3 project record;
- legacy evidence claim text remains unchanged while same-project exact-trimmed claims receive deterministic IDs;
- migration creates no inferred Claim–ResearchQuestion links;
- missing, cross-project, and duplicate Claim–ResearchQuestion links fail validation;
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
