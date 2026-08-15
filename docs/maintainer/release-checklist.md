# Maintainer release checklist

This checklist is the reusable release gate for Sociology PhD Desk. A release is blocked while any applicable P0/P1 remains open, any mandatory test is unverified, or the China map gates are not all PASS for a release that includes the map.

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
- [ ] Portable migrations v1 → v2 → v3 → v4 → v5 and direct v4 → v5 pass.
- [ ] Standard IndexedDB migrations v1 → v2 → v3 → v4 → v5 and direct v4 → v5 pass.
- [ ] Existing authenticated encrypted local payload v4 → v5 and encrypted backup v4 → v5 pass without writing on wrong passphrase, tamper, or failed migration.
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
- [ ] Generate `sociology-phd-desk-zotero-0.1.0.xpi` and matching `.sha256`; independently recompute and compare SHA-256.
- [ ] Install and test in isolated synthetic Zotero profiles only—never the maintainer's real library/account/sync profile.
- [ ] Manual smoke covers Zotero 8 and the locally installed Zotero 9 where available: install, restart if required, one article, one book, Chinese/English titles, multiple creators, DOI/no DOI, multi-select, duplicate resend, large-batch fallback, disable, uninstall, and restart.
- [ ] Release claims name only the Zotero versions actually verified.

## 6. China map inclusion or deferral gate

- [ ] If a release includes the map, require `MAP_SOURCE_VERIFIED`, `MAP_LICENSE_VERIFIED`, `MAP_APPROVAL_METADATA`, and `NATIONAL_MAP_COMPLETENESS` to be PASS for the exact deployed output.
- [ ] If a release defers the map, preserve the bilingual source/compliance evidence and explicitly exclude map code, geometry, administrative catalogs, external map calls, region persistence, and completion claims.
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

- [ ] Create an annotated tag only after all mandatory gates pass; never move an existing tag.
- [ ] Write multilingual release notes to an explicit UTF-8 Markdown file.
- [ ] Run `node scripts/verify-release-notes.mjs --file … --sentinel …` before upload.
- [ ] Create a non-draft, non-prerelease GitHub Release with `--notes-file`; attach the Zotero XPI and checksum when applicable.
- [ ] Verify the remote Release body with the same UTF-8 guard and confirm tag object → exact release commit → reviewed tree.
- [ ] Update current-state docs and dated public metrics without fabricating users, testers, contributors, downloads, or adoption.

## Latest completed evidence — v0.3.0

The reusable boxes above remain intentionally unchecked for future releases. For `v0.3.0`, [PR #53](https://github.com/Yoesher/sociology-phd-desk/pull/53) passed exact-head push/PR CI, CodeQL, and P0 = 0 / P1 = 0 self-review before squash merge as exact release SHA `bb0d32fe99348204ba89a16d6469014ae38e0ecf`. Exact-main CI, CodeQL, Pages/deployment, annotated tag, UTF-8 Release, public XPI/checksum assets, and a fresh public-download hash verification passed. Public interaction was a LIMITED PASS because the browser bridge timed out before the English/mobile public checks; the complete local browser and automated gates remain separately recorded in `PROJECT_STATE.md`.
