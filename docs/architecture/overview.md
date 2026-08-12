# Architecture Overview

## Goal

Sociology PhD Desk is a local-first browser application that coordinates research objects across the sociology lifecycle. The core must remain useful without an account, application server, cloud sync, analytics, or AI API.

Verified public `main` is Phase 3B at `4f3d615`. The workspace registry, lock gate, and encrypted-vault architecture below describe the unmerged Phase 3C candidate on `codex/private-local-workspaces`. Its final local automated gate, real-browser smoke, and independent P0/P1 review passed; Pull Request, exact-head CI, merge, exact-`main` CI, Pages, and public interaction remain pending.

## Technology foundation

- **React** renders the application shell and feature interfaces.
- **TypeScript** defines domain, validation, and component contracts.
- **Vite** provides development and production builds.
- **React Router** maps stable feature routes.
- A typed, namespace-based **i18n context** provides the `zh-CN` and `en` interface resources, locale-aware dates and numbers, and stable display labels for persisted enums.
- **IndexedDB**, accessed through **Dexie**, persists local research records.
- A schema-v1 local **workspace registry** routes opaque workspace IDs to separate standard or encrypted IndexedDB databases without storing research content.
- The browser **Web Cryptography API** provides PBKDF2-HMAC-SHA-256 key derivation and AES-256-GCM authenticated encryption for optional encrypted workspaces and `.sociologydesk` backups.
- **Zod** validates imported portable data and other untrusted boundaries.
- **Vitest**, Testing Library, and `fake-indexeddb` test domain, portable-data, migration, conflict, persistence, queued context writes, and nested modal lifecycle. Full route and multi-viewport browser automation remains planned after `0.1.0`.
- **Oxlint** and the TypeScript compiler provide static quality gates.

Package versions and executable scripts are authoritative in `package.json`; this document describes responsibilities rather than pinning duplicate version numbers.

## Layer boundaries

```text
I18nProvider and application settings
        ↓
WorkspaceSessionProvider → WorkspaceAccessGate
        ↓ only while unlocked
WorkspaceProvider → routes, feature pages, reusable components
        ↓
Domain services, whole-workspace validation, import/export
        ↓
LocalWorkspaceManager and session-bound repository port
        ↓
metadata-only registry DB v1
        ├─ standard workspace DB v3 (17 plaintext domain tables)
        └─ encrypted vault DB v1 (one authenticated ciphertext record)
```

### Application shell

Owns navigation, route framing, theme, global utilities, and error boundaries. In the Phase 3C candidate, the i18n provider remains outside the workspace gate so lock screens are bilingual; research routes and `WorkspaceProvider` mount only after a session is unlocked. The shell must not become the database or business-logic layer.

### Interface localization

`I18nProvider` owns the active application locale, document language metadata, interface-message lookup, interpolation, dates, numbers, and enum display labels. A fresh installation deliberately starts in Simplified Chinese; browser language does not override that product default. The explicit `zh-CN` or `en` choice is stored with the theme in a small typed `AppSettings` localStorage record.

Application settings are not part of `WorkspaceData`, IndexedDB domain tables, or the portable JSON envelope. Persisted enum values remain the stable English schema literals while the interface renders localized labels. Switching language must preserve the current route and research data and must never translate user-authored titles, notes, fieldwork material, quotations, or manuscripts.

### Feature modules

Own workflows for Today, Projects, Literature, Fieldwork, Quantitative, Evidence, Research Log, Manuscripts, and Submissions. Project detail also owns the bilingual Research Questions, Claims, and Research Graph workspace merged in Phase 3B. A feature may compose objects from several stores, but persistent writes should pass through domain/repository functions.

### Domain model and services

Own entity types, allowed states, relationships, ID generation, dates, validation, and cross-object rules. They should remain testable without rendering a route.

Phase 3B makes `ResearchQuestion`, `Claim`, and `ClaimQuestionLink` first-class objects. Questions and claims retain stable identity when their authored text or state changes. Their explicit many-to-many link is valid only when both endpoints and the link itself share one project; text is not an identifier. Linked parents and projects with graph dependents use protected deletion rather than silent cascading.

### Persistence

Owns Dexie schema versions, transactions, indexes, migrations, and repository methods. UI code should not scatter direct table operations.

The Phase 3C candidate has three persistence roles:

1. `sociology-phd-desk-registry` schema v1 stores workspace routing and recovery metadata only. Canonical display name, timestamps, kind, encryption mode, auto-lock, migration/cleanup state, an interrupted-conversion target reservation, schema versions, registry revision, and opaque storage locators are plaintext. Research content, passphrases, derived keys, verifiers, and content digests are forbidden.
2. Each standard personal or synthetic-demo workspace uses a separate physical database and the existing IndexedDB schema v3. Its 17 structured domain tables remain plaintext and validate complete `WorkspaceData` v3 snapshots before writes.
3. Each encrypted workspace uses a separate encrypted-vault database v1 with exactly one ciphertext record plus plaintext `storageRevision`, `lockEpoch`, `keyInvocation`, and encryption-attempt coordinates. It has no domain tables or plaintext workspace name.

Physical database separation prevents accidental cross-workspace joins in cooperating code, but all databases remain inside the browser origin's trust boundary. The repository also validates the snapshot's workspace identity and rejects cross-workspace endpoints. Physical preflight/ownership rules treat ready and incomplete routes, conversion reservations, retained sources, migration ledgers, the registry database, and reserved database-name prefixes as one alias space; an unexplained existing database is never cleared as if it were fresh staging.

Random logical IDs, non-bootstrap locators, ownership tokens, encrypted bindings, salts, and IVs require cryptographically secure browser randomness and fail closed when it is unavailable. Deterministic initial seed routes are a narrow concurrency mechanism so simultaneous first boots converge; they are not secrets. Manager close, route invalidation, missing physical storage, or authenticated vault tamper poisons the affected session and clears its cached snapshot rather than allowing stale storage recreation. Encrypted async work rechecks a lifecycle generation after storage/crypto awaits; close or lock advances it, preventing a delayed refresh from restoring key/plaintext state to a closed runtime.

IndexedDB schema v3 itself still adds the Phase 3B stores for questions, claims, and claim–question links and migrates v2 project/evidence text deterministically through the same research-graph semantics used at the portable boundary.

### Portability boundary

Owns export envelopes, schema versions, validation, import previews, collision detection, merge, and explicit replacement. External input is untrusted even when it came from an earlier export.

- Ordinary JSON is the inspectable, plaintext portable `WorkspaceData` format. Portable v3 import composes v1 → v2 → v3, preserves legacy `Evidence.claim` source-context text, and never infers a Claim↔ResearchQuestion link.
- `.sociologydesk` is a different encrypted-backup container. Container v1 authenticates a portable-v3 payload and is parsed, authenticated, decrypted, and strictly validated before a new logical workspace ID or destination vault is created.
- At export, the current registry `displayName` is copied into the generated plaintext or encrypted payload after the active snapshot/route is refreshed. This does not rewrite the active domain database or advance its workspace-data revision; optional last-export bookkeeping is a separate registry update.
- Portable version, standard database version, registry database version, encrypted-vault database version, and encrypted-container version are independent axes even when some currently use the same integer.

Evidence↔Claim linking remains future Issue #2 work rather than an implicit consequence of migration.

## Data flow

1. Bootstrap reads the registry, retries `deleting` tombstones when cross-tab locking is available, and performs idempotent legacy discovery/migration without opening encrypted vault plaintext or deleting the legacy source. Deterministic seed identities let concurrent first boots converge. Only an exact pristine legacy fixture is a demo; an edited legacy demo becomes personal data and receives a separate pristine demo companion.
2. A user selects a ready workspace. Standard mode opens its bound repository; encrypted mode requires the passphrase in the current tab and decrypts into runtime state only.
3. Only an unlocked session mounts research routes. Feature forms enforce user-facing requirements; the repository validates route currency, workspace identity, revision, complete content, and cross-object relationships before persistence. A terminal route/storage/integrity failure closes the session and clears the manager-owned snapshot.
4. Standard writes acquire the workspace operation coordinator, recheck that the registry route still points to the same ready standard database, and reject stale or removed storage rather than recreating it. Destructive conversion, cleanup, provisioning discard, and deletion fail closed when cross-tab Web Locks are unavailable.
5. Encrypted writes reserve an AES-GCM invocation, encrypt outside the transaction, then commit only if revision, lock epoch, invocation, and binding still match. Lock advances the epoch so a delayed cooperating tab cannot commit old plaintext.
6. Standard-to-encrypted conversion durably reserves a fresh target before vault creation. An interrupted existing target can be resumed or discarded only after passphrase authentication and workspace-identity verification; a confirmed-absent target reservation can be cleared without a passphrase. Promotion happens only after authenticated read-back and source recheck.
7. Later plaintext cleanup first flushes pending research writes, then requires the currently unlocked encrypted session. It acquires stable lexically ordered locks on the encrypted target and plaintext source by their actual physical database names; while both locks remain held, it refreshes/authenticates the current vault and rechecks the retained source's ownership and logical identity before deletion. Workspace deletion is finalized only after absence verification; unresolved tombstones remain visible for explicit retry.
8. After a successful write, a content-free `BroadcastChannel` signal may ask other tabs to refresh or lock. It contains workspace/storage coordinates only, never research content, passphrases, or keys.
9. Export reads a coherent snapshot and creates either plaintext portable JSON or a separately encrypted `.sociologydesk` backup. Import/restore parses and validates the entire input before any registry or workspace write.

If one optimistic write fails, its queue generation is poisoned immediately. Dependent writes captured from that optimistic chain are cancelled before reaching the repository, and the UI refreshes from IndexedDB before a new generation can proceed.

## Local-first boundary

IndexedDB is local to an origin and browser profile. It is not automatically backed up, synchronized, or available across browsers. A standard workspace and ordinary JSON are plaintext. An encrypted workspace protects ciphertext at rest, but its registry metadata remains visible and its unlocked plaintext is inside the same-origin runtime trust boundary. Applications hosted at different paths under one shared GitHub Pages origin are not separate security origins.

Clearing site data can destroy records. IndexedDB deletion is logical deletion, not verifiable secure erasure. There is no password reset or recovery key; a forgotten passphrase and lost backups can make encrypted content unrecoverable. See the bilingual threat model: [中文](../zh-CN/privacy-model.md) / [English](../en/privacy-model.md).

The application must communicate these facts and must not send research records to GitHub, analytics services, AI providers, or other third parties by default.

## Offline behavior

The architecture avoids a required backend. A production build can run as static assets once loaded. A later PWA/service-worker decision requires its own ADR because caching can introduce update and stale-schema risks.

## Error and recovery principles

- Validate at the boundary and explain recoverable errors.
- Use transactions for multi-record writes.
- Do not partially import malformed workspaces.
- Do not silently overwrite collisions.
- Make destructive reset or replace actions explicit.
- Preserve a way to export before risky schema or replacement actions when possible.
- Never publish a new registry route until the destination database has been physically read back and strictly verified.
- Never delete a legacy or plaintext recovery source merely because a copy operation started; cleanup is a later, separately recorded transition.
- Preserve durable conversion, provisioning, migration, and deletion recovery records until physical ownership/absence and registry publication agree; expose unresolved deletion recovery in the UI.
- Fail closed when secure randomness or cross-tab-safe destructive coordination required by the operation is unavailable.
- Use stable error codes and generic authentication failure messages rather than exposing raw cryptographic errors.

## Testing strategy

Priority order:

1. Schema validation and import/export round trips.
2. Database migrations and repository CRUD.
3. Projects, evidence, and fieldwork privacy rules.
4. Cross-object links and status transitions.
5. Critical UI flows and destructive confirmations.
6. Responsive, theme, accessibility, and browser-level checks.
7. Message-key and interpolation parity, locale preference, raw enum values, locale-independent export semantics, and unchanged user research content.
8. Registry isolation, legacy migration idempotence, provisioning/deletion recovery, standard/encrypted session identity, wrong-passphrase/tamper zero-write behavior, lock/reload/auto-lock, backup restore, retained-plaintext cleanup, demo separation, and cross-tab stale-session rejection.

Every release revision must run lint, type checking, tests, and production build. Manual route review complements tests; it does not replace them.

## Planned extension points

- Additional domain objects such as Variable, Model, Code, Memo, and Revision Task.
- Explicit Evidence↔Claim and Claim↔manuscript-location navigation only after its separate schema, provenance, migration, and deletion semantics are implemented; retained free text is not such a relationship.
- Adapters for Zotero and analysis-tool metadata after API/license/privacy review.
- Document and reproducibility exports.
- Optional AI suggestion services isolated from source evidence and the offline core.

Extension points are not promises of compatibility until an implementation and migration are documented.
