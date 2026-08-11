# Architecture Overview

## Goal

Sociology PhD Desk is a local-first browser application that coordinates research objects across the sociology lifecycle. The core must remain useful without an account, application server, cloud sync, analytics, or AI API.

## Technology foundation

- **React** renders the application shell and feature interfaces.
- **TypeScript** defines domain, validation, and component contracts.
- **Vite** provides development and production builds.
- **React Router** maps stable feature routes.
- **IndexedDB**, accessed through **Dexie**, persists local research records.
- **Zod** validates imported portable data and other untrusted boundaries.
- **Vitest**, Testing Library, and `fake-indexeddb` test domain, UI, and persistence behavior.
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
2. The form validates domain requirements and privacy-safe fields.
3. A service performs a transaction through the repository layer.
4. Reactive queries update relevant views.
5. Export reads a coherent snapshot and creates a versioned JSON envelope.
6. Import parses and validates the entire envelope before any write, then applies the chosen safe mode transactionally.

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

Every release revision must run lint, type checking, tests, and production build. Manual route review complements tests; it does not replace them.

## Planned extension points

- Additional domain objects such as Research Question, Claim, Variable, Model, Code, Memo, and Revision Task.
- Adapters for Zotero and analysis-tool metadata after API/license/privacy review.
- Document and reproducibility exports.
- Optional AI suggestion services isolated from source evidence and the offline core.

Extension points are not promises of compatibility until an implementation and migration are documented.
