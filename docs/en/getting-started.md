# Getting started with Sociology PhD Desk

## Use it directly in a browser

Open <https://yoesher.github.io/sociology-phd-desk/>. No GitHub account, registration, login, or cloud database is required. A current browser with IndexedDB support on Windows, macOS, or Linux can use it directly; browser mode and installed mode provide the same research features.

The first open creates an empty personal workspace and an explicitly synthetic Demo. Research data stays by default in IndexedDB for this device, browser profile, and web origin. It is not synchronized to another device by default.

## Install the PWA

A compatible browser may show an install control in its address bar or menu. You can also open Workspace & settings → Application & storage and choose Install when the browser exposes an installation prompt. As verified from official documentation on 2026-08-13: Chrome/Edge expose installation through supported address-bar or menu surfaces; Firefox standalone web apps are currently a Windows feature with version/install-source limits; Safari on macOS Sonoma 14 or later uses File → Add to Dock; Safari on iOS/iPadOS uses Share → Add to Home Screen → Open as Web App. On Linux, keep using the full browser version with a bookmark or pinned tab when the browser offers no install surface. Supporting Chromium browsers on Android usually install from the browser menu. Capabilities change, so the browser's current UI and official guidance remain authoritative.

Official references: [Chrome desktop web apps](https://support.google.com/chrome/answer/9658361?hl=en), [Chrome Android home-screen shortcuts](https://support.google.com/chrome/answer/15085120?hl=en), [Microsoft Edge PWAs](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/ux), [Safari web apps on Mac](https://support.apple.com/en-us/104996), [Safari web apps on iPhone](https://support.apple.com/en-us/guide/iphone/iphea86e5236/ios), and [Firefox web apps on Windows](https://support.mozilla.org/en-US/kb/web-apps-firefox-windows).

Installation is not account registration and does not upload existing data. The installed app and an ordinary browser tab still use local storage under the same browser origin.

## Offline use and updates

After one successful online load, the service worker stores static application build files for offline startup. It has no research-data upload, proxy, or runtime-cache route; workspace research content remains managed by IndexedDB. Offline startup may be unavailable before the initial cache completes or after the browser clears site data.

The app checks for updates at startup and, after the window regains focus, no more than once per hour. A waiting version produces a notice but never forces a refresh; choosing Later does not reload. When you choose Update now, the waiting service worker first enumerates and notifies other windows in this app scope; if another tab remains open, the update fails closed. The app then flushes pending workspace writes and re-reads the latest committed snapshot. An unlocked encrypted workspace must pass the same verification. A failed verification does not activate the new version. After success, the page reloads and the existing migration chain safely handles supported older schemas.

## Restore an encrypted backup on a new device

1. On the old device, generate a `.sociologydesk` backup for the encrypted workspace and store the file in a trusted location.
2. Open Sociology PhD Desk on the new device and go to Workspace & settings → Backup & restore.
3. Choose Import encrypted backup, enter the backup passphrase, and set a passphrase for the new local workspace.
4. The app authenticates and fully validates the backup before creating an isolated workspace. A wrong passphrase or damaged file writes no target workspace.

The project cannot recover a lost passphrase. Ordinary JSON is readable plaintext and is not an encrypted transfer file.

## Persistent storage and backup reminders

Application & storage shows the persistent-storage state reported by the browser. `navigator.storage.persist()` is called only after your explicit action; the browser may grant or refuse the request. A grant reduces automatic-eviction risk, but does not prevent manual clearing, browser reset, device loss, or same-origin code access.

The local reminder applies only to personal workspaces and can be Off, 7, 14, or 30 days; the default is 14 days and Demo is excluded. It uses the registry timestamp for the last successfully generated export; a workspace with no export uses its creation time. The browser can confirm that the app generated an export and initiated a download, not that the file still exists where you intended. This setting and timestamp are local metadata and are not uploaded.

## Risk of clearing browser data

Clearing site data for `yoesher.github.io`, resetting a browser profile, or removing an installed app while choosing to delete site data may remove IndexedDB, settings, and offline static caches. A PWA icon is not a backup. Generate and actually test encrypted backups regularly.

The current host uses the shared `yoesher.github.io` origin. Browsers isolate IndexedDB by scheme, host, and port—not by repository path. See the [origin strategy and migration boundary](../architecture/origin-strategy.md) for the complete risk and future options.
