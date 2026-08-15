# Zotero integration

Sociology PhD Desk Zotero plugin `0.1.0` supports Zotero 8 and Zotero 9. The published build completed install, restart, send, disable, and uninstall checks with isolated synthetic profiles on Zotero 8.0.4 and Zotero 9.0.6; no real user library was used. Zotero remains responsible for collecting references, PDFs, notes, annotations, and citations. The Desk receives only whitelisted bibliographic metadata from items the user explicitly selects, and the user chooses the project, reading status, priority, and why-read rationale in a preview.

## Install

Download the published [`sociology-phd-desk-zotero-0.1.0.xpi`](https://github.com/Yoesher/sociology-phd-desk/releases/download/v0.3.0/sociology-phd-desk-zotero-0.1.0.xpi) and its [SHA-256 file](https://github.com/Yoesher/sociology-phd-desk/releases/download/v0.3.0/sociology-phd-desk-zotero-0.1.0.sha256) from the formal `v0.3.0` Release. The verified digest is `e940f29bb803774a9311b0b5c8f40776558c9362bfa58f28c01681e5ed7795ee`.

In Zotero, open Tools → Plugins → gear menu → Install Plugin From File, select the downloaded XPI, and restart if prompted. Maintainers can reproduce the same files with `npm ci` and `npm run build:zotero` from exact release SHA `bb0d32fe99348204ba89a16d6469014ae38e0ecf`; a fresh public download was independently hash-verified after publication. Development and compatibility checks must still use isolated synthetic Zotero profiles rather than a real library/account/sync profile.

## Send references

1. Select one or more regular bibliographic items in Zotero 8 or Zotero 9.
2. Right-click and choose Send to Sociology PhD Desk.
3. A small selection opens the Literature import preview directly. A larger selection is saved as a local `.spdzotero` file, which the user selects from Literature → Import from Zotero.
4. Choose the target project, status, and priority, add the why-read rationale, and confirm before the current workspace is changed.

An exact Zotero identity can refresh bibliography, but cannot overwrite project, reading status, priority, why-read rationale, or local notes. DOI, ISBN, and title/year matches are suggestions and never merge automatically.

The plugin does not read or send PDFs, attachment paths, Zotero notes, annotations, full text, or storage paths. It does not perform background sync or write back to Zotero.
