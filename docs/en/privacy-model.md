# Privacy and encryption model

Sociology PhD Desk is local-first: its core does not require an account or a cloud service. “Local” describes where the application asks the browser to store data. It does not, by itself, mean encrypted, anonymous, backed up, or institutionally approved.

This page separates four protection levels that are easy to confuse.

Version note: verified public `main` `ca4429f` stores portable/standard v3. The current Theory implementation is a local unmerged candidate that advances portable and standard storage to v4 while encrypted container v1, encrypted-vault database v1, and registry database v1 remain unchanged. Its final release gates remain pending.

## A. Browser isolation

A standard workspace is stored as ordinary structured data in IndexedDB. The browser’s same-origin policy normally separates it from unrelated origins and browser profiles, but every script and service worker allowed to run under the application’s origin is part of the trust boundary. Applications hosted at different paths on one shared origin are not isolated origins.

Browser isolation does not encrypt research content. Someone or something with access to the browser profile, developer tools, a same-origin script, an extension with sufficient permissions, malware, or the underlying device may be able to read it. Clearing site data, storage eviction, a damaged profile, or device loss may destroy the only copy.

## B. Interface lock

An interface lock hides the workspace in the application and asks cooperating tabs to stop writing. For a standard workspace, the underlying IndexedDB remains plaintext. An interface lock must never be described as encryption.

For an encrypted workspace, the tab performing a lock discards its in-memory derived key and atomically advances a lock epoch. A cooperating tab opened before that lock is rejected when it next refreshes, writes, or requests a backup with the stale epoch. Locking does not remotely overwrite plaintext or key references already held in every other tab. This is useful coordination, not a security boundary against hostile code running at the same origin.

Reloading or closing an unlocked encrypted workspace also discards the application’s key reference. JavaScript and the browser do not provide a guarantee that every physical memory copy has been overwritten.

If a registry route changes, a manager closes, standard storage disappears, or an encrypted vault record is missing or fails authentication, the cooperating application closes/poisons that session and clears its cached snapshot. Encrypted asynchronous work carries a lifecycle generation across each storage/cryptography wait; close or lock advances that generation before clearing state, so a delayed refresh cannot publish decrypted data back into or revive the closed runtime. This prevents a stale application handle from recreating storage or continuing from cached plaintext; it is not a defence against hostile code that already copied the plaintext.

## C. Encrypted workspace and encrypted backup

An encrypted local workspace stores one authenticated ciphertext container instead of plaintext research tables. A passphrase is normalized to NFC without trimming or changing case. PBKDF2-HMAC-SHA-256 (600,000 iterations and a fresh 16-byte salt) derives a non-extractable AES-256-GCM key. Every write uses a fresh 12-byte IV and a 128-bit tag. Format metadata is authenticated as AAD.

The encrypted vault record still exposes non-research coordination values: a random binding ID, storage revision, lock epoch, committed key invocation, total encryption-attempt count, algorithm parameters, and ciphertext length. That vault record does not contain the workspace name or a password verifier. Separately, the application keeps an unencrypted routing registry containing logical workspace IDs, canonical display names, storage locators, encryption mode and lifecycle state, revisions, timestamps, auto-lock settings, and migration, cleanup, provisioning, pending-deletion, and interrupted-conversion status. The registry contains no research body and no content-derived hash or password verifier, but its names and activity times may themselves be sensitive. A wrong passphrase and authenticated-data damage intentionally return the same generic failure.

An encrypted `.sociologydesk` backup uses a fresh salt and IV independently of the local workspace and of every other backup. Its protected header has no workspace name, binding ID, or research timestamp, but its decrypted portable payload includes the canonical registry display name copied at export time. Ordinary JSON export makes the same name copy in plaintext. These export-only copies do not rewrite the active research snapshot or advance its workspace-data revision. The operating system and filesystem can still reveal the file name, size, location, and file timestamps. Restoring first authenticates and validates the whole backup and then creates a workspace with a new logical workspace ID and storage revision zero; a failed authentication writes no destination record.

In the local candidate, new vaults and backups contain portable v4. Existing portable-v3 ciphertext is authenticated before any migration. Local-vault upgrade writes and reads back a complete v4 container before publishing the new state; wrong passphrase, tamper, encryption failure, storage failure, or read-back failure leaves the old ciphertext available. Restoring a v3 backup migrates only in memory and writes a new v4 vault only after authentication and complete validation. The container, vault-database, and registry-database version numbers remain 1; they must not be confused with the portable payload version.

New logical IDs, non-bootstrap storage locators and ownership tokens, encrypted binding IDs, salts, and IVs require cryptographically secure browser randomness and fail closed if it is unavailable. Deterministic initial routes only coordinate concurrent first boot and are not secrets.

There is no password reset or recovery key. If the passphrase and every working backup are lost, the project cannot recover the plaintext. Keep more than one tested backup on media appropriate to your institution’s policy. An encrypted backup is not automatically synchronized or backed up merely because it has a file extension.

## D. Device or runtime compromise

Encryption at rest is mainly intended to make offline disclosure from copied IndexedDB ciphertext or an encrypted backup harder. It does not protect an unlocked session from malicious same-origin JavaScript, a compromised dependency or service worker, a powerful browser extension, malware, remote-control software, an administrator, screenshots, clipboard capture, or a compromised operating system. Such an attacker may capture the passphrase or plaintext as it is used.

PBKDF2 slows guessing but cannot compensate for a weak or reused passphrase. Database and backup size can leak approximate volume. AES-GCM authenticates one container but does not prove that it is the newest container: someone able to replace browser-profile storage can replay an older complete, valid encrypted record and roll the workspace back. Browser database deletion is logical deletion, not verifiable secure erase; filesystem snapshots, browser synchronization, backups, and flash storage behaviour may retain remnants.

Do not store direct participant identifiers, re-identification keys, consent documents, or source material here when your ethics approval or institutional policy requires an approved protected system. Anonymous IDs can still be linkable. Application encryption does not itself establish legal compliance, ethics approval, retention compliance, or suitability for classified or highly sensitive data.

## Conversion from a plaintext workspace

Conversion uses two phases. First, the application durably reserves a fresh target locator on the standard route before creating a separate encrypted vault. It reads the actual stored ciphertext back, decrypts it, performs strict whole-workspace validation, checks semantic equality, and rechecks the standard source before publishing the encrypted route. If an interrupted reserved vault exists, retry must authenticate it with the supplied passphrase and verify its logical workspace identity. Discarding an existing staged vault requires the same authentication and identity proof; only a target confirmed absent may have its empty reservation cleared without a passphrase. The plaintext source remains authoritative if this phase fails.

Cleanup is a later, explicitly requested and separately recorded step after the encrypted route has been verified and opened. The application flushes pending research writes first. The manager then requires the current unlocked encrypted session and acquires both the encrypted target and plaintext source by their real physical database names in a stable lexical lock order. While both locks remain held, it rereads/authenticates the current vault and checks that the recorded source name is not shared or aliased and that its stored logical workspace identity matches before deletion. Physical database deletion and registry publication cannot be atomic: failure before or during deletion leaves the source recorded as pending, while failure after physical deletion can also leave a conservative `cleanup-pending` marker until an idempotent retry verifies absence and finalizes it. Neither a “removed” marker nor successful browser deletion is a secure-erasure claim.

## Workspace lifecycle and deletion recovery

Provisioning, migration, conversion, cleanup, and deletion use durable registry/ledger records plus physical database-name ownership checks. They do not clear an unexplained or aliased database. Workspace deletion publishes a `deleting` marker before physical removal and finalizes only after absence is verified. Bootstrap retries unresolved deletion when safe cross-tab coordination is available; otherwise Workspace Center keeps the item visible with an explicit retry action. The marker reports application verification state, not forensic absence of data.

## Technical references

- [W3C Web Cryptography API](https://www.w3.org/TR/webcrypto/)
- [NIST SP 800-38D: GCM and GMAC](https://csrc.nist.gov/pubs/sp/800/38/d/final)
- [NIST SP 800-132: password-based key derivation for storage](https://csrc.nist.gov/pubs/sp/800/132/final)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
