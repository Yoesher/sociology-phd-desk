# Screenshot Register

These captures document the running application rather than design mockups. The `v0.2.0` set was captured from the actual release candidate; the earlier `0.1.0` set remains available as historical release evidence.

## Capture rules

- Use only the explicitly synthetic demo workspace.
- Verify that every visible record is marked or unmistakably identified as demo.
- Do not show names, email addresses, local user paths, browser profile details, credentials, notifications, or real research material.
- Capture the actual release candidate and record the privacy review here.

## Registered captures

### `v0.2.2` final local candidate

- Application/package version: captures are from the feature candidate at `0.2.1`; `release/0.2.2` now sets package/lock to `0.2.2` without changing the rendered interface
- Candidate branches: `feat/simplicity-motion` → `release/0.2.2`
- Capture date: 2026-08-13
- Capture boundary: final local production preview after the 33-file / 300-test gate; publication is not claimed here

| File | View | Privacy review |
| --- | --- | --- |
| [`v0.2.2/01-after-desktop.png`](v0.2.2/01-after-desktop.png) | English light-theme Today at 1440-class desktop width | 1425 × 847; PASS — bundled synthetic Demo only |
| [`v0.2.2/02-after-theory.png`](v0.2.2/02-after-theory.png) | Chinese dark-theme Theory memo workspace | 1440 × 856; PASS — empty filtered view, no private theory content |
| [`v0.2.2/03-after-publishing.png`](v0.2.2/03-after-publishing.png) | Chinese dark-theme Publishing revision workflow | 1440 × 856; PASS — honest empty derived view, no manuscript content |
| [`v0.2.2/04-after-mobile.png`](v0.2.2/04-after-mobile.png) | Chinese dark-theme Fieldwork processing at 390-class width | 375 × 797; PASS — bundled synthetic counts only, no participant data |

The desktop captures document the simplified two-level hierarchy, compact top bar, consolidated filters, and restrained visual system. The mobile capture documents a single sticky secondary navigation plus four-item bottom navigation. All four files are genuine PNG captures of the running production preview; no browser chrome, local path, credential, notification, passphrase, or real research record is visible.

### `v0.2.0` release candidate

- Application/package version: `0.2.0`
- Candidate branch: `release/0.2.0`
- Navigation base: merged PR #20, exact `main` `1cbedd2f045c99e40f71bbec434c5c14cae7bb58`
- Capture date: 2026-08-12
- Browser review width: 1280 CSS pixels
- Capture boundary: these files were recorded before publication from the candidate; the resulting [`v0.2.0` Release](https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.2.0) is published at exact release SHA `eb399f7da0a1f3142f7c8361492fa86b08db77db`

| File | View | Privacy review |
| --- | --- | --- |
| [`v0.2.0/01-today-zh.jpg`](v0.2.0/01-today-zh.jpg) | Chinese Today research desk | 1265 × 712; PASS — bundled synthetic Demo only |
| [`v0.2.0/02-navigation-expanded-zh.jpg`](v0.2.0/02-navigation-expanded-zh.jpg) | Expanded Chinese two-level navigation | 1265 × 712; PASS — no personal workspace or research material |
| [`v0.2.0/03-theory-overview-zh.jpg`](v0.2.0/03-theory-overview-zh.jpg) | Chinese Theory Research overview | 1265 × 712; PASS — minimal synthetic theory records only |
| [`v0.2.0/04-theory-concepts-zh.jpg`](v0.2.0/04-theory-concepts-zh.jpg) | Chinese Theory core-concepts view | 1265 × 712; PASS — no real citation, finding, or theory claim |
| [`v0.2.0/05-research-graph-zh.jpg`](v0.2.0/05-research-graph-zh.jpg) | Chinese Research Question–Claim graph | 1280 × 720; PASS — bundled synthetic graph only |
| [`v0.2.0/06-publishing-revision-zh.jpg`](v0.2.0/06-publishing-revision-zh.jpg) | Chinese Publishing revision Smart View in its honest empty state | 1265 × 712; PASS — no manuscript, submission, or review content exposed |
| [`v0.2.0/07-privacy-lock-zh.jpg`](v0.2.0/07-privacy-lock-zh.jpg) | Chinese Privacy Center explaining standard-workspace and lock boundaries | 1280 × 720; PASS — no passphrase, locator, export, or private research content |
| [`v0.2.0/08-interface-en.jpg`](v0.2.0/08-interface-en.jpg) | Complete English interface | 1265 × 712; PASS — bundled synthetic Demo only |

All eight files are JPEG captures taken from a 1280 × 720 release-candidate viewport. The application content image is 1265 × 712 where the browser reserves scrollbar space and 1280 × 720 for the modal captures. They contain no browser chrome, local machine paths, credentials, notifications, real participant information, or real research data. The empty Revision view is retained because it truthfully demonstrates a derived workflow view without fabricating a submission; the privacy capture documents the standard-workspace boundary rather than implying encrypted storage.

### `0.1.0` historical release

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
