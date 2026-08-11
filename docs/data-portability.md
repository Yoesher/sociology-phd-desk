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

Unsupported future versions should fail safely with an actionable message. Old supported formats should migrate through tested transformations.

## Required tests

- current-version export validates against its own schema;
- export → empty database import round trip;
- merge with no collisions;
- merge with collisions preserves existing records until resolution;
- explicit replace succeeds transactionally;
- invalid JSON and invalid fields produce no writes;
- unsupported version produces no writes;
- database or validation failure does not leave partial state;
- demo markers and relationship IDs survive round trip;
- sensitive-path warning is visible in the UI.
