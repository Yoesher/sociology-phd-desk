# Screenshot Register

These captures document the locally verified `0.1.0` pre-release candidate. They are screenshots of the running application, not design mockups.

## Capture rules

- Use only the explicitly synthetic demo workspace.
- Verify that every visible record is marked or unmistakably identified as demo.
- Do not show names, email addresses, local user paths, browser profile details, credentials, notifications, or real research material.
- Capture the actual release candidate and record the privacy review here.

## Registered captures

- Application version: `0.1.0`
- Capture date: 2026-08-11
- Browser review width: 1280 CSS pixels

| File | View | Theme | Privacy review |
| --- | --- | --- | --- |
| [`today-light.png`](today-light.png) | Today dashboard and synthetic research plan | Light | PASS — bundled demo only |
| [`evidence-dark.png`](evidence-dark.png) | Evidence ledger, provenance fields, and DEMO warnings | Dark | PASS — no real citation, result, or source material |
| [`workspace-data-light.png`](workspace-data-light.png) | Backup/import controls and explicit demo-reset entry point | Light | PASS — no exported content, path, or notification shown |

## Browser checks recorded with the captures

- All nine routes opened and rendered their expected page heading.
- Light/dark theme state persisted across a reload.
- A synthetic QA project persisted through reload and was then deleted through the protected confirmation flow.
- JSON export produced the application success status with a versioned filename.
- Demo reset opened a separate destructive confirmation and was cancelled.
- The Workspace modal was verified after being portalled to the document body; its backdrop covered the full 1280 × 720 viewport.
- The application console contained no warning or error entries after the final browser pass.

After these captures, a nested-modal stack added top-layer-only Escape handling, persistent scroll lock, and layer-by-layer focus restoration. A dedicated Testing Library regression test passes for that lifecycle. A fresh connector-driven browser smoke was attempted but not claimed because the desktop browser service reported no available browser instance.

Responsive behavior at 390 × 844 was also reviewed during implementation. Automated multi-viewport browser coverage remains a next-phase task.
