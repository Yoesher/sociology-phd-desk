# Architecture Decision Records

This file records durable product and architecture choices. Each decision includes its date, decision, rationale, alternatives, and consequences. New entries are append-only; superseded decisions should point to their replacement rather than silently rewriting history.

## ADR-001 — Local-first core

- **Date:** 2026-08-11
- **Status:** Accepted
- **Decision:** Keep the complete core workstation usable without an account, application server, default cloud synchronization, telemetry, or AI API. Store research workflow records on the user's device and make explicit export the portability path.
- **Rationale:** Sociology projects often contain unpublished findings, sensitive fieldwork context, confidential peer review, and institutionally controlled data. A local-first core reduces unnecessary disclosure, lowers operational cost, supports offline work, and prevents a hosted service from becoming a prerequisite for basic research management.
- **Alternatives:** Server-first multi-user application; mandatory account and cloud sync; file-only desktop application; localStorage-only web application.
- **Consequences:** The project can run as a static client and does not need an account service. Users are responsible for device security and backups. Cross-device synchronization and collaboration are not automatic. The UI and documentation must never imply that local storage is encrypted, indestructible, or institutionally compliant by itself.

## ADR-002 — IndexedDB through Dexie for persistence

- **Date:** 2026-08-11
- **Status:** Accepted
- **Decision:** Use IndexedDB as the first persistence layer, accessed through Dexie. Keep a versioned domain schema and repository/data-access boundary rather than reading storage directly throughout page components.
- **Rationale:** The research model contains multiple related object types and will outgrow localStorage size, transaction, and query constraints. IndexedDB is broadly available in modern desktop browsers and supports structured, offline data. Dexie reduces transaction and migration complexity while retaining browser-local operation.
- **Alternatives:** localStorage; SQLite/WASM; a native desktop database; a remote relational database; direct IndexedDB calls without a wrapper.
- **Consequences:** Database upgrades require explicit migrations and tests. Browser storage quotas and deletion behavior remain user-visible risks. Persistence tests need `fake-indexeddb` or browser-level coverage. A future desktop wrapper can add adapters, but domain logic must not assume a server database.

## ADR-003 — React, TypeScript, and Vite client architecture

- **Date:** 2026-08-11
- **Status:** Accepted
- **Decision:** Build the initial client with React, TypeScript, and Vite; organize by application shell, reusable components, features, models, and data services rather than one large `App.tsx`.
- **Rationale:** The stack is mature, maintainable, suitable for a static offline-friendly browser application, and supports typed domain models, fast local development, testing, and a low-friction contributor path. Feature boundaries match the research lifecycle and can evolve independently.
- **Alternatives:** Vanilla TypeScript; Vue; Svelte; Next.js or another server-oriented framework; Electron-first desktop application.
- **Consequences:** The project accepts a JavaScript dependency ecosystem and must monitor supply-chain risk. React components must not become the persistence or domain layer. Server rendering is not a current requirement. Build compatibility is tied to supported Node and browser versions documented in the repository.

## ADR-004 — Complement Zotero; do not recreate it

- **Date:** 2026-08-11
- **Status:** Accepted
- **Decision:** Treat Zotero as the reference-library system of record. Sociology PhD Desk records why a work should be read, which project or question it informs, what analytical judgment follows, and whether it enters a manuscript argument. Any future Zotero integration must respect this boundary.
- **Rationale:** Bibliographic acquisition, deduplication, citation styles, attachments, and citation insertion are already deep specialist capabilities. Reimplementing them would dilute the product and create a high maintenance burden. The unmet need is research orchestration across literature and other research objects.
- **Alternatives:** Build a full reference manager; store only free-form literature notes; exclude literature entirely.
- **Consequences:** The initial literature object can store descriptive metadata but does not promise reference-library completeness. DOI and URL fields must not imply verification. Future integration needs official API and license review, conflict semantics, and clear ownership of edits.

## ADR-005 — Anonymous identifiers at the fieldwork boundary

- **Date:** 2026-08-11
- **Status:** Accepted
- **Decision:** Model field sites, cases, participants, interviews, and visits with anonymous IDs and aliases. Keep the warning “Do not store directly identifying participant information here” at relevant entry points. Do not add fields that solicit direct identifiers.
- **Rationale:** Direct identifiers increase harm if a device, browser profile, export, issue attachment, or repository fixture is exposed. The workstation can coordinate research without storing names, phone numbers, government identifiers, precise addresses, signatures, or full consent documents.
- **Alternatives:** Permit arbitrary personally identifying fields; encrypt identifiers inside the application; omit fieldwork support; rely only on a documentation warning.
- **Consequences:** Researchers must keep re-identification keys, consent records, and protected source material in institutionally approved systems outside the application. Anonymous IDs still may be linkable and are not automatically de-identified. Demo fixtures must be clearly synthetic. Encryption and ethics approval remain outside the product's guarantee.

## ADR-006 — Safe import: merge by default, replacement only by explicit choice

- **Date:** 2026-08-11
- **Status:** Accepted
- **Decision:** Validate the complete portable workspace envelope before writing. Default to a non-destructive merge flow that reports collisions and preserves existing records unless the user resolves them. Whole-workspace replacement is a separate, explicit action with a clear consequence and confirmation; it must never be triggered by ordinary import.
- **Rationale:** Research workspaces can represent months or years of work. Silent overwrite is unacceptable, and partial writes from malformed input make recovery difficult. A previewable, transactional import boundary supports portability without turning data migration into a destructive operation.
- **Alternatives:** Always replace; last-write-wins merge; import without validation; reject any workspace containing an existing ID; silently create duplicate IDs.
- **Consequences:** Import requires schema versioning, validation, conflict reporting, and transaction tests. Merge semantics may be more verbose for users. Replacement must remain visibly distinct in UI and tests. Exports should include a format version and enough metadata to validate compatibility, without adding identifying telemetry.

## ADR-007 — Source evidence and AI suggestions are different object classes

- **Date:** 2026-08-11
- **Status:** Accepted
- **Decision:** AI is optional and outside the core dependency path. Any generated output must be labeled as an AI-generated suggestion, retain relevant provenance and review state, and never automatically become source evidence or a verified finding.
- **Rationale:** Language-model output can be incomplete, incorrect, fabricated, or detached from consent and data-governance constraints. Sociology requires evidence provenance and accountable interpretation. Treating generation as evidence would undermine the product's central research-ethics and traceability goals.
- **Alternatives:** Make an AI assistant the primary interface; automatically add generated claims to the evidence ledger; exclude AI integrations permanently; treat AI and human notes identically.
- **Consequences:** Core workflows remain available offline without model access. Future AI interfaces need explicit consent, disclosure of any data leaving the device, provider/configuration boundaries, and review actions. Generated content cannot inherit a source locator or support level without a human linking actual evidence.

## ADR-008 — Original academic visual language

- **Date:** 2026-08-11
- **Status:** Accepted
- **Decision:** Use an original, calm, editorial, research-oriented interface with deliberate typography, quiet surfaces, clear rules, and dense-but-readable registries. Do not import a generic Bootstrap/admin-dashboard visual template or use emoji as the product's primary icon/status system.
- **Rationale:** The application supports sustained scholarly judgment, not operational monitoring or sales analytics. A distinctive academic visual system makes hierarchy and provenance legible while reinforcing the sociology-specific identity.
- **Alternatives:** Generic component-library defaults; colourful startup dashboard; document-editor clone; minimal unstyled forms.
- **Consequences:** New screens must reuse shared tokens and primitives and pass light/dark, responsive, keyboard, and density review. Originality does not justify decorative complexity: accessibility, focus, semantics, and information clarity remain hard constraints. See [DESIGN.md](DESIGN.md).

## ADR-009 — Chinese-first bilingual interface with locale-neutral research data

- **Date:** 2026-08-11
- **Status:** Accepted
- **Decision:** Use Simplified Chinese as the default application and repository entry language, and maintain a complete English interface. Store language preference separately from workspace research data. Keep identifiers, schema enums, import/export values, and persisted domain records locale-neutral. A language switch changes application chrome, system messages, dates, and number presentation, but never silently translates or rewrites user-authored research content.
- **Rationale:** The project is intended to be directly usable by Chinese sociology researchers while remaining accessible to international contributors and researchers. Treating translated labels as persisted values would make schemas language-dependent, break validation and portability, and risk corrupting existing work. Automatically translating research notes would also change authorship and analytical meaning without consent.
- **Alternatives:** English-only interface with a Chinese README; browser-language auto-detection as the sole default; separate Chinese and English applications; storing translated labels inside domain records; automatic translation of user content.
- **Consequences:** Every substantial interface feature must ship with aligned Chinese and English resources, including validation, accessible names, responsive table labels, dialogs, and recovery guidance. Tests must check message-key and interpolation parity, raw persisted values, language persistence, and unchanged user content. CJK and English layouts require responsive and accessibility review. Documentation may have language-specific entry files, but verified behavior and project status must remain consistent.

## ADR-010 — Compliance-gated, county-level China Research Map

- **Date:** 2026-08-11
- **Status:** Accepted
- **Decision:** Treat the China Research Map as a first-class sociology research capability for linking regional research notes and comparing coverage across province, prefecture, and county levels. Stop the supported hierarchy at county level and never collect, infer, display, or export exact participant locations. Do not implement or publish map boundaries until an authoritative, legally usable source has been verified and its provenance, permitted use, attribution, version, and update path are documented. Never substitute an arbitrary map dataset merely to make the feature visible.
- **Rationale:** Place and administrative context matter to comparative, population, labour, family, organizational, migration, and fieldwork research in China. At the same time, incorrect boundaries, unclear licensing, and overly precise participant geography create legal, maintenance, research-integrity, and re-identification risks. A decorative map without source discipline would weaken rather than strengthen the workstation.
- **Alternatives:** Omit geographic organization; use any convenient open boundary file; support point coordinates and street-level participant mapping; embed a mandatory commercial map service; implement a generic global map first.
- **Consequences:** Phase 3C remains blocked until source and legal verification passes. The feature must retain local-first operation, document attribution, support a useful non-map fallback, and model regions independently from translated display labels. Tests and review must cover administrative hierarchy, incomplete or changing codes, privacy boundaries, import/export behavior, accessibility, and graceful source failure. Exact household, interview, or participant coordinates are outside the product scope even when a researcher could technically provide them.
