# Maintainer release checklist

This checklist is the reusable release gate for Sociology PhD Desk. A release is blocked while any applicable P0/P1 remains open, any mandatory test is unverified, or the China map gates are not all PASS for a release that includes public national-map content. The separate ADR-026 user-supplied local-image tool does not satisfy or bypass those national gates.

## 1. Scope and repository truth

- [ ] Confirm the release Issue/milestone scope and freeze new features.
- [ ] Confirm a clean release branch, reviewed diff, no unrelated user changes, and an exact candidate SHA/tree.
- [ ] Confirm `package.json`, lockfile, PWA version/build metadata, `CHANGELOG.md`, READMEs, `PROJECT_STATE.md`, and `NEXT_TASKS.md` agree.
- [ ] Confirm no real research data, Zotero library data, account material, credentials, API keys, machine-private paths, or generated test profiles are tracked.

## 2. Local automated gate

Run against the final candidate:

```powershell
npm ci --registry=https://registry.npmjs.org
npm run audit:release
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run test:zotero
```

- [ ] High/Critical npm audit result is zero; registry/network failure is recorded as NOT RUN, never PASS.
- [ ] Browser E2E uses only synthetic fixtures and failure artifacts contain no research content or secrets.
- [ ] Production PWA build verification passes with only intended static application assets cached.

## 3. Data and migration gate

- [ ] Fresh current-schema standard and encrypted workspaces open, write, lock/unlock, export, and restore.
- [ ] Portable migrations v1 → v2 → v3 → v4 → v5 → v6 → v7 and direct v5 → v6 / v6 → v7 pass; v6 → v7 initializes empty field-map collections for legacy inputs, without inferred positions.
- [ ] Standard IndexedDB migrations through v7 and direct v5 → v6 / v6 → v7 preserve existing records, PDFs and Zotero provenance.
- [ ] Existing authenticated encrypted local payloads and encrypted backups v3/v4/v5/v6 → v7 pass without writing on wrong passphrase, tamper, or failed migration; container/vault/registry remain v1.
- [ ] Optional local PDFs survive standard/encrypted persistence and portable/encrypted backups; size/content guards reject invalid or oversized attachments before writes.
- [ ] Local images/same-project markers survive standard/encrypted storage and complete backups; invalid/dangling/cross-project maps and protected endpoint changes produce no writes.
- [ ] Project-scoped edits preserve the full workspace, including all other projects, records, PDFs, images and markers.
- [ ] Current-schema portable/encrypted round trips preserve stable IDs and user-authored content.
- [ ] Import preflight remains write-free and all size/count/string guards pass.

## 4. PWA, offline, and update gate

- [ ] Browser and installed-PWA modes work in zh-CN and English at desktop and mobile widths.
- [ ] Fresh online startup, cached offline startup, and online recovery pass.
- [ ] Update available/accepted/later flows pass for standard open, encrypted open, and locked workspaces.
- [ ] User-approved update flushes pending writes, verifies the encrypted runtime when applicable, activates the waiting worker, reloads once, and safely runs schema migration.
- [ ] Service worker caches only static application assets and never uploads, caches, or proxies research data.

## 5. Zotero integration gate

- [ ] `npm run build:zotero` produces the documented plugin version from committed source.
- [ ] `npm run test:zotero` passes handoff allowlist, notes/annotations/attachments exclusion, URL-size fallback, and reproducible-build checks.
- [ ] For an explicitly authorized plugin release, generate its versioned XPI/checksum and recompute SHA-256. For retained plugin0.1.0, verify original v0.3.0 download/checksum/update hash; never commit a generated hash for an unchanged published file or republish its asset.
- [ ] Install and test in isolated synthetic Zotero profiles only—never the maintainer's real library/account/sync profile.
- [ ] Manual smoke covers Zotero 8 and the locally installed Zotero 9 where available: install, restart if required, one article, one book, Chinese/English titles, multiple creators, DOI/no DOI, multi-select, duplicate resend, large-batch fallback, disable, uninstall, and restart.
- [ ] Release claims name only the Zotero versions actually verified.

## 6. China map inclusion or deferral gate

- [ ] If a release includes public national-map content, require `MAP_SOURCE_VERIFIED`, `MAP_LICENSE_VERIFIED`, `MAP_APPROVAL_METADATA`, and `NATIONAL_MAP_COMPLETENESS` to be PASS for the exact deployed output.
- [ ] If a release defers the national map, preserve bilingual source/compliance evidence and exclude bundled national geometry/catalogs, external map calls, unverified geographic-region persistence and national-completion claims.
- [ ] The ADR-026 local-image tool requires entitled static PNG/JPEG and coarse/anonymous settings, no participant homes/exact locations/identifiers, and no bundled national content/GPS/online service/public image export. State raw EXIF/GPS retention and that normalized positions do not guarantee anonymity; keep all national gates BLOCKED unless separately verified.
- [ ] Confirm participant GPS and precise-location fields are absent in either path.
- [ ] For `v0.3.0`, record the map as DEFERRED and excluded; its BLOCKED gates do not become PASS and do not block the verified non-map release.

## 7. Privacy, security, accessibility, and diagnostics

- [ ] Zotero handoff contains bibliographic allowlisted metadata only; no notes, annotations, attachment paths/binaries, full text, or account tokens.
- [ ] URL-fragment handoff is size-limited and removed from the address bar immediately after parsing.
- [ ] Malformed/oversized/XSS-like imported strings are rejected or rendered as text, never executed.
- [ ] Diagnostic export contains only the documented allowlist and record counts; no names, IDs, titles, aliases, content, Zotero metadata, passphrases, or keys.
- [ ] Keyboard, focus, screen-reader names, reduced motion, 320/390 mobile layout, and no-horizontal-overflow gates pass.
- [ ] CodeQL, Dependabot configuration, npm audit, CSP, and secret/private-path scans pass.

## 8. Pull request and exact-main verification

- [ ] Feature/release PR body records exact scope, migrations, privacy boundaries, tests, manual evidence, limitations, and `Closes #…` only for completed work.
- [ ] Exact-head push CI, pull-request CI, CodeQL, and maintainer self-review finish with P0 = 0 and P1 = 0.
- [ ] Merge only the reviewed tree; verify local `main`, `origin/main`, and GitHub API main SHA are identical.
- [ ] Exact-main CI, CodeQL, Pages build/deploy, and deployment SHA all pass.
- [ ] Public desktop/mobile smoke checks the release workflows, PWA/offline/update behavior, console/CSP, and synthetic-data cleanup.

## 9. Tag, release, and UTF-8 verification

These artifact-publication checks apply only when a formal GitHub Release/tag is in scope. A website-only update retains existing Release/tag and plugin assets unless a separate publication is explicitly authorized.

- [ ] Create an annotated tag only after all mandatory gates pass; never move an existing tag.
- [ ] Write multilingual release notes to an explicit UTF-8 Markdown file.
- [ ] Run `node scripts/verify-release-notes.mjs --file … --sentinel …` before upload.
- [ ] Create a non-draft, non-prerelease GitHub Release with `--notes-file`; attach the Zotero XPI and checksum when applicable.
- [ ] Verify the remote Release body with the same UTF-8 guard and confirm tag object → exact release commit → reviewed tree.
- [ ] Update current-state docs and dated public metrics without fabricating users, testers, contributors, downloads, or adoption.

## Historical completed evidence — v0.3.0

The reusable boxes above remain intentionally unchecked for future releases. For `v0.3.0`, [PR #53](https://github.com/Yoesher/sociology-phd-desk/pull/53) passed exact-head push/PR CI, CodeQL, and P0 = 0 / P1 = 0 self-review before squash merge as exact release SHA `bb0d32fe99348204ba89a16d6469014ae38e0ecf`. Exact-main CI, CodeQL, Pages/deployment, annotated tag, UTF-8 Release, public XPI/checksum assets, and a fresh public-download hash verification passed. Public interaction was a LIMITED PASS because the browser bridge timed out before the English/mobile public checks; the complete local browser and automated gates remain separately recorded in `PROJECT_STATE.md`.

## `0.3.1` website-update publication evidence (S1) — 2026-10-03

[PR #55](https://github.com/Yoesher/sociology-phd-desk/pull/55) published application `0.3.1` as exact main SHA [`7f50ecd`](https://github.com/Yoesher/sociology-phd-desk/commit/7f50ecd209b1a9deac3b9bc38653f798020a5817) after the scoped review and exact-head gates. Exact-main CI, CodeQL, and Pages build/deploy passed; public version/build identity matched, and fresh independent desktop and phone browser contexts passed the synthetic public workflow smoke. The formal `v0.3.0` Release/tag and existing Zotero assets remain unchanged. Operating-system-installed PWA and cross-device manual restore remain NOT RUN; the actual S1 → S2 update requires separate verification, without relabeling the earlier failed trial. Exact runs, tested scope, final documentation-commit gates, and remaining limitations are recorded in [PROJECT_STATE.md](../../PROJECT_STATE.md). Reusable boxes above remain unchecked for future revisions.
