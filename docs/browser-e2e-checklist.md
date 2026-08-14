# Browser E2E and manual accessibility checklist

This checklist complements the automated Playwright suite. It does not turn visual judgment, assistive-technology behavior, OS-level PWA installation, or a real service-worker version transition into an automated PASS.

All test records must be synthetic. Do not use a real Zotero profile, a real research library, participant data, private field notes, or account automation.

## Automated release gate

- Run `npm run test:e2e` against a production build, not the Vite development tree.
- Cover desktop Chromium at 1280 × 720 and narrow Chromium at 390 × 844.
- Verify zh-CN startup, English switching, stable deep links, nine primary modules, mobile drawer Escape/focus restoration, and no horizontal overflow.
- Exercise project, evidence, and field-site create/edit/delete flows with synthetic records.
- Verify reload persistence, plaintext export, write-free import preflight, and isolated import-as-new.
- Verify nested dialogs close only from the top, retain body scroll lock, and restore focus to the logical trigger.
- Verify a stale tab cannot overwrite a newer commit: the stale tab must fail closed, lock, and reopen on the winning snapshot.
- Verify encrypted workspace create, committed write, lock, reload-locked, unlock, and readback.
- Verify the production manifest, active service-worker control, offline app-shell startup, and online network recovery.
- Retain trace, video, and screenshot only on failure; CI uploads them as short-lived artifacts.

## Manual release gate / 人工发布门禁

Run each item in both zh-CN and English, using browser mode and installed PWA mode where the platform supports installation.

- Desktop: 1280 × 720 and 1440 × 900. Mobile: 390 × 844.
- Install from Chrome or Edge on Windows; confirm ordinary browser use remains fully available when installation is declined.
- Launch the installed PWA, close it, reopen it, and confirm the same origin-scoped local workspace is available.
- Load once online, disconnect networking, cold-start the installed/browser app, then reconnect and confirm recovery without any claim of cloud synchronization.
- Stage an actual service-worker update. Test “Later” and user-triggered “Update” with a standard workspace open, an encrypted workspace open, and an encrypted workspace locked.
- Before accepting an update, make a pending edit. Confirm the update waits for the write/readback gate; on failure it must not activate or reload.
- After activation, confirm reload and any supported schema migration finish before research routes are shown.
- Use keyboard only: traverse top bar, primary/secondary navigation, mobile drawer, dialogs, confirmation actions, and return focus. Confirm a visible focus indicator.
- Check nested dialogs with Tab, Shift+Tab, and Escape. Only the top dialog may receive focus or close.
- Check headings, landmarks, accessible names, live status messages, selected/expanded states, and destructive confirmation wording with a screen reader.
- Check 200% and 400% zoom, reduced motion, light/dark themes, contrast, and 320 px minimum-width resilience.
- Confirm browser console has no application errors, CSP violations, raw research content, passphrases, storage locators, or imported metadata in logs.
- Confirm no test artifact, screenshot, trace, diagnostic export, or CI artifact contains real research data.

Record browser/OS versions, exact commit SHA, production asset names, PASS/FAIL/NOT RUN, and the reason for every NOT RUN result in `PROJECT_STATE.md` before release.
