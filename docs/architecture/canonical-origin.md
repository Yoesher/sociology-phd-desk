# Canonical origin and browser-storage migration

## Current v0.2.1 decision

The release candidate retains `https://yoesher.github.io/sociology-phd-desk/` and presents the existing shared-origin warning. This is option C below. It avoids an origin migration during the first PWA release, but it is an explicitly accepted risk rather than a claim of isolation by repository path.

An origin is determined by scheme, host, and port. `/sociology-phd-desk/` is a path, not a storage-security boundary. IndexedDB databases use opaque project-specific names for organization, but any script executing under the same `https://yoesher.github.io` origin belongs to the same browser trust boundary.

## Options considered

### A. Dedicated custom domain

Use a project-owned custom domain as the permanent canonical origin. This provides a clearer application identity and separates storage from unrelated `yoesher.github.io` project paths. Before enabling a PWA there, the project must freeze DNS/hosting ownership, HTTPS, redirect/canonical behavior, service-worker scope, rollback, old-site notice duration, and encrypted-backup transfer instructions.

### B. Dedicated GitHub Pages origin

Host the repository from a dedicated GitHub account or organization whose `*.github.io` origin serves no unrelated applications. This also changes the origin and needs the same explicit transfer and old-site plan. A repository rename or path move under the same host is not equivalent to a dedicated origin.

### C. Retain the current origin with explicit risk

Continue using the existing URL and warn that repository paths do not isolate IndexedDB. This minimizes immediate migration risk and is the chosen v0.2.1 path, but every script deployed anywhere on the same origin remains in the browser trust boundary.

## Non-negotiable migration boundary

A new custom or dedicated origin cannot automatically read IndexedDB from `yoesher.github.io`. Browser same-origin protections are the reason. The project must never claim or implement a silent cross-origin database migration.

If the canonical origin changes later:

1. keep the old site available long enough to show a migration/export notice;
2. ask users to open each important old-origin workspace and generate an encrypted `.sociologydesk` backup;
3. restore that backup as a new isolated workspace on the new origin;
4. verify the restored workspace before the user removes old-origin data;
5. keep service-worker scope and caches origin-specific, and do not use cross-origin frames, messages, or redirects to bypass storage isolation.

Ordinary plaintext JSON remains an inspectable portability path, but encrypted backup is the recommended cross-device and cross-origin transfer for encrypted workspaces.
