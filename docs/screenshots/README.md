# Screenshot Register

These captures document the `0.1.0` application interface. They are screenshots of the running application, not design mockups, and their privacy review was repeated before public release.

## Capture rules

- Use only the explicitly synthetic demo workspace.
- Verify that every visible record is marked or unmistakably identified as demo.
- Do not show names, email addresses, local user paths, browser profile details, credentials, notifications, or real research material.
- Capture the actual release candidate and record the privacy review here.

## Registered captures

- Application version: `0.1.0`
- Release reference: [`v0.1.0`](https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.1.0), commit `e9eadf2c2810c9a18a9f3a31ccdf659bd268c994`
- Capture date: 2026-08-11
- Browser review width: 1280 CSS pixels

| File | View | Theme | Privacy review |
| --- | --- | --- | --- |
| [`today-light.jpg`](today-light.jpg) | Today dashboard and synthetic research plan | Light | PASS — bundled demo only |
| [`evidence-dark.jpg`](evidence-dark.jpg) | Evidence ledger, provenance fields, and DEMO warnings | Dark | PASS — no real citation, result, or source material |
| [`workspace-data-light.jpg`](workspace-data-light.jpg) | Backup/import controls and explicit demo-reset entry point | Light | PASS — no exported content, path, or notification shown |

## Browser checks recorded with the captures

- All nine routes opened and rendered their expected page heading.
- Light/dark theme state persisted across a reload.
- A synthetic QA project persisted through reload and was then deleted through the protected confirmation flow.
- JSON export produced the application success status with a versioned filename.
- Demo reset opened a separate destructive confirmation and was cancelled.
- The Workspace modal was verified after being portalled to the document body; its backdrop covered the full 1280 × 720 viewport.
- The application console contained no warning or error entries after the final browser pass.

After these captures, a nested-modal stack added top-layer-only Escape handling, persistent scroll lock, and layer-by-layer focus restoration. A dedicated Testing Library regression test passes for that lifecycle.

The deployed application at `https://yoesher.github.io/sociology-phd-desk/` received a fresh browser smoke on 2026-08-11 after that change. All nine hash routes rendered their route-specific controls; light/dark switching worked; a clearly synthetic task survived reload; the demo workspace was restored through its destructive confirmation; and the application console contained no errors. The JSON export control was exercised, but the in-app browser did not expose a download event, so the downloaded file itself was not re-inspected in that deployment pass. Automated export round-trip coverage remained green.

Responsive behavior at 390 × 844 was also reviewed during implementation. Automated multi-viewport browser coverage remains a next-phase task.
