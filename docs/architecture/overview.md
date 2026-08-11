# Architecture Overview

## Goal

Sociology PhD Desk is a local-first browser application that coordinates research objects across the sociology lifecycle. The core must remain useful without an account, application server, cloud sync, analytics, or AI API.

## Technology foundation

- **React** renders the application shell and feature interfaces.
- **TypeScript** defines domain, validation, and component contracts.
- **Vite** provides development and production builds.
- **React Router** maps stable feature routes.
- A typed, namespace-based **i18n context** provides the `zh-CN` and `en` interface resources, locale-aware dates and numbers, and stable display labels for persisted enums.
- **IndexedDB**, accessed through **Dexie**, persists local research records.
- **Zod** validates imported portable data and other untrusted boundaries.
- **Vitest**, Testing Library, and `fake-indexeddb` test domain, portable-data, migration, conflict, persistence, queued context writes, and nested modal lifecycle. Full route and multi-viewport browser automation remains planned after `0.1.0`.
- **Oxlint** and the TypeScript compiler provide static quality gates.

Package versions and executable scripts are authoritative in `package.json`; this document describes responsibilities rather than pinning duplicate version numbers.

## Layer boundaries

```text
Routes and application shell
        ↓
Feature pages and reusable components
        ↓
Domain services, validation, and import/export
        ↓
Repositories / database adapter
        ↓
IndexedDB in the current browser profile
```

### Application shell

Owns navigation, route framing, theme, global utilities, and error boundaries. It must not become the database or business-logic layer.

### Interface localization

`I18nProvider` owns the active application locale, document language metadata, interface-message lookup, interpolation, dates, numbers, and enum display labels. A fresh installation deliberately starts in Simplified Chinese; browser language does not override that product default. The explicit `zh-CN` or `en` choice is stored with the theme in a small typed `AppSettings` localStorage record.

Application settings are not part of `WorkspaceData`, IndexedDB domain tables, or the portable JSON envelope. Persisted enum values remain the stable English schema literals while the interface renders localized labels. Switching language must preserve the current route and research data and must never translate user-authored titles, notes, fieldwork material, quotations, or manuscripts.

### Feature modules

Own workflows for Today, Projects, Literature, Fieldwork, Quantitative, Evidence, Research Log, Manuscripts, and Submissions. A feature may compose objects from several stores, but persistent writes should pass through domain/repository functions.

### Domain model and services

Own entity types, allowed states, relationships, ID generation, dates, validation, and cross-object rules. They should remain testable without rendering a route.

### Persistence

Owns Dexie schema versions, transactions, indexes, migrations, and repository methods. UI code should not scatter direct table operations.

### Portability boundary

Owns export envelopes, schema versions, validation, import previews, collision detection, merge, and explicit replacement. External JSON is untrusted input even when it came from an earlier export.

## Data flow

1. A user opens a route and selects or creates a research object.
2. Feature forms enforce their user-facing requirements; the repository then validates the complete workspace and its cross-object relationships before persistence.
3. A queued context write passes an expected workspace revision to a repository transaction. Stale writers are rejected instead of silently overwriting newer data.
4. The context refreshes the current snapshot after a successful write and broadcasts a refresh signal to other same-origin tabs.
5. Export reads a coherent snapshot and creates a versioned JSON envelope.
6. Import parses and validates the entire envelope before any write, then applies the chosen safe mode transactionally.

If one optimistic write fails, its queue generation is poisoned immediately. Dependent writes captured from that optimistic chain are cancelled before reaching the repository, and the UI refreshes from IndexedDB before a new generation can proceed.

## Local-first boundary

IndexedDB is local to an origin and browser profile. It is not automatically encrypted, backed up, synchronized, or available across browsers. Clearing site data can destroy records. Exported files can expose everything entered into the application.

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

## Testing strategy

Priority order:

1. Schema validation and import/export round trips.
2. Database migrations and repository CRUD.
3. Projects, evidence, and fieldwork privacy rules.
4. Cross-object links and status transitions.
5. Critical UI flows and destructive confirmations.
6. Responsive, theme, accessibility, and browser-level checks.
7. Message-key and interpolation parity, locale preference, raw enum values, locale-independent export semantics, and unchanged user research content.

Every release revision must run lint, type checking, tests, and production build. Manual route review complements tests; it does not replace them.

## Planned extension points

- Additional domain objects such as Research Question, Claim, Variable, Model, Code, Memo, and Revision Task.
- Adapters for Zotero and analysis-tool metadata after API/license/privacy review.
- Document and reproducibility exports.
- Optional AI suggestion services isolated from source evidence and the offline core.

Extension points are not promises of compatibility until an implementation and migration are documented.
