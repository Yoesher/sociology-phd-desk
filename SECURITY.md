# Security Policy

## PWA and local-data boundary

The released v0.2.1 service worker precaches emitted application static files only. It defines no research-data upload, proxy, API, or runtime-cache route. Workspace content remains in the existing standard or encrypted browser-local repositories and is not copied into Cache Storage.

The current public deployment remains under `yoesher.github.io`, where IndexedDB and service-worker authority are isolated by origin rather than repository path. See [the origin-strategy decision](docs/architecture/origin-strategy.md). A future origin cannot automatically read this origin's IndexedDB; transfer must use an explicit user-controlled encrypted backup and retain an old-site migration notice.

Sociology PhD Desk is local-first research workflow software. Its threat model deserves extra caution because even metadata can expose participants, field sites, unpublished findings, or career-sensitive peer review.

## Supported versions

The latest formal public release is [`v0.2.2`](https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.2.2). Security fixes are normally developed against the latest maintained `main` revision; no long-term support window or response-time service level is promised during this early public stage.

The authorized `v0.3.0` cycle is unreleased. Verified delivery state, exact revisions, and release boundaries belong in [PROJECT_STATE.md](PROJECT_STATE.md); a merged feature on `main` is not a published release by itself.

## Report a vulnerability

Do **not** open a public issue with exploit details, private research data, credentials, or screenshots that expose sensitive records.

After the public repository enables private vulnerability reporting, use GitHub's **Security → Report a vulnerability** flow for `Yoesher/sociology-phd-desk`. If that channel is unavailable, open a public issue containing only a request for a private maintainer contact—no vulnerability details—and retain the details until a private channel is established.

Include, when safe:

- affected revision or version;
- browser and operating system;
- minimal reproduction using synthetic data;
- security impact and likely attack preconditions;
- whether export files, browser storage, or external links are involved;
- suggested mitigation, if known.

The maintainers will acknowledge and triage reports on a best-effort basis. No response or remediation time is promised during this early public-release stage. Coordinated disclosure timing will be agreed with the reporter when possible.

## Security boundaries

- The application has no account, cloud vault, required server, default synchronization, telemetry, or password-reset service. A private local workspace is not an online identity.
- A standard workspace stores ordinary structured research tables in IndexedDB. Browser/profile isolation and separate physical workspace databases are useful data boundaries, but they are not encryption or separate security origins.
- An interface lock hides the workstation from casual on-screen access. Standard-workspace data remains plaintext underneath it. For an encrypted workspace, lock also discards the current tab's runtime key reference and advances a cooperating-tab lock epoch. The epoch invalidates later repository writes when a tab observes it; it cannot remotely overwrite every plaintext/key reference already held by another tab and is not an access-control boundary against hostile same-origin code.
- The local registry intentionally keeps routing and recovery metadata in plaintext: workspace display name, creation/update/open/export times, workspace kind and encryption mode, auto-lock choice, migration/cleanup state (including an interrupted-conversion target reservation), registry and schema versions, and opaque storage locators. Names and activity times may themselves be sensitive. The registry must not contain research content, passphrases, derived keys, password verifiers, or content-derived digests. Its display name is the canonical user-visible name and is copied into a generated portable/encrypted payload at export time; that copy is not a persisted research-data write and does not advance the workspace-data revision.
- A Phase 3C encrypted workspace stores one authenticated ciphertext record rather than plaintext research tables. It derives a non-extractable AES-256-GCM key from the NFC-normalized passphrase with PBKDF2-HMAC-SHA-256, 600,000 iterations, and a fresh random 16-byte salt; each encryption uses a fresh random 12-byte IV and authenticates the canonical protected header as AAD. The passphrase and key are not persisted.
- New logical IDs, opaque non-bootstrap storage locators, provisioning tokens, encrypted bindings, salts, and IVs fail closed when the required cryptographically secure browser randomness is unavailable. Deterministic initial bootstrap routes exist only so concurrent first-boot callers converge; their locators are not secrets or authentication tokens.
- Reload, close, or lock removes the application's key reference, but JavaScript cannot guarantee physical memory zeroization. While unlocked, same-origin scripts, service workers, compromised dependencies, powerful extensions, malware, remote-control software, administrators, or a compromised operating system may capture plaintext or the passphrase.
- A bound session is invalidated and its cached snapshot is cleared when its registry route is no longer current. A disappeared standard database, missing encrypted-vault record, authenticated tamper, or closed manager poisons the affected repository/runtime instead of letting a stale handle recreate storage or continue from cached plaintext. Encrypted refresh/save/backup/lock operations capture a runtime lifecycle generation and recheck it after asynchronous boundaries; close or lock advances that generation, so a delayed decrypt/refresh cannot repopulate a closed session or revive its key/plaintext state.
- GitHub Pages applications at different paths under the same host share an origin trust boundary. Independent IndexedDB database names do not isolate applications that can execute under that shared origin.
- AES-GCM authentication detects changes to one container, but the browser provides no trusted monotonic counter. An attacker able to replace profile storage can replay an older complete, valid container and roll the workspace back.
- Clearing site data, browser resets, quota eviction, profile corruption, and device loss can destroy local records. Deleting IndexedDB is logical deletion, not verifiable secure erasure; browser sync, backups, filesystem snapshots, and storage media may retain remnants.
- Local paths are references, not access controls or secure file storage.
- The public repository is for source code, public documentation, and synthetic demo data only.

The complete bilingual threat model distinguishes browser isolation, interface locking, encrypted storage, and device compromise: [中文](docs/zh-CN/privacy-model.md) / [English](docs/en/privacy-model.md).

## Backup and migration boundaries

- Ordinary portable workspace JSON is plaintext and may contain every research record and local-path reference entered in that workspace. Treat it according to its most sensitive record.
- An encrypted `.sociologydesk` backup is a separate versioned authenticated-encryption container, not ordinary JSON renamed with a custom extension. Container version and portable payload version are independent.
- A wrong passphrase, authenticated-header change, ciphertext damage, or invalid decrypted workspace produces one generic authentication failure and must create no destination workspace.
- There is no cloud password reset, recovery key, or maintainer bypass. Losing the passphrase and every usable backup may make the plaintext unrecoverable.
- Legacy-singleton migration and standard-to-encrypted conversion retain the old plaintext source until a physically read-back destination has decrypted, validated, and matched the source. Provisioning and migration preflight both reject an already owned, aliased, reserved, or unexplained physical database instead of clearing it.
- Standard-to-encrypted conversion durably reserves its target in the registry before creating the vault. Retrying an existing staged vault authenticates it with the supplied passphrase and verifies its logical workspace identity. Discarding an existing staged vault requires the same authentication and identity proof; only when the reserved vault is confirmed absent may the empty reservation be cleared without a passphrase.
- Plaintext cleanup is a later explicit step. The UI first flushes pending research writes; the manager then requires the current unlocked encrypted session and acquires stable, lexically ordered exclusive locks for the encrypted target and plaintext source using their actual physical database names. While both locks are held, it rereads/authenticates the current vault and verifies the current route, the recorded source's unshared physical locator, and its logical workspace identity before deletion. Failure before or during physical deletion leaves the source recorded as pending; failure after deletion but before registry finalization may leave only a conservative `cleanup-pending` marker until an idempotent retry verifies absence. Neither outcome is a secure-erasure claim.
- Workspace deletion first publishes a durable `deleting` marker, checks physical-name ownership and identity, removes only that storage, and verifies absence before finalizing the registry. Bootstrap attempts idempotent recovery, while an unresolved marker remains visible for explicit retry; it never proves forensic erasure.
- Neither a browser database nor a `.sociologydesk` file is automatically copied elsewhere. Keep and test more than one backup on media allowed by the applicable research and institutional policy.

## Research-data safety

Do not store directly identifying participant information in the application. Do not commit or attach:

- names, phone numbers, government identifiers, exact addresses, signatures, or consent forms;
- interview transcripts or private fieldnotes;
- raw or restricted datasets (`.dta`, `.sav`, CSV research extracts, and similar files);
- API keys, credentials, `.env` files, or `config.local.*`;
- confidential manuscripts, decisions, or reviewer correspondence.

Use institutional storage, encryption, access controls, retention schedules, and de-identification procedures appropriate to the study. See [research ethics](docs/research-workflows/research-ethics.md).

## Dependency and change hygiene

Security-sensitive changes should include tests where feasible and pass lint, type checking, tests, and the production build. Dependency updates must be reviewed for provenance, license compatibility, and changes to network behavior. The core application must not add telemetry, trackers, cloud synchronization, or external AI calls by default.

The repository uses bounded weekly Dependabot checks for npm and GitHub Actions, official GitHub CodeQL analysis for JavaScript/TypeScript, and a release audit that fails on high or critical npm advisories. A registry or service outage is an unavailable gate, not a passing audit. Moderate and low findings are reviewed and recorded but do not automatically block a release unless their concrete impact crosses the release's P0/P1 boundary.
