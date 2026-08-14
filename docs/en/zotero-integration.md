# Zotero integration

Sociology PhD Desk Zotero plugin `0.1.0` supports Zotero 8 and Zotero 9. The release candidate completed install, restart, send, disable, and uninstall checks with isolated synthetic profiles on Zotero 8.0.4 and Zotero 9.0.6; no real user library was used. Zotero remains responsible for collecting references, PDFs, notes, annotations, and citations. The Desk receives only whitelisted bibliographic metadata from items the user explicitly selects, and the user chooses the project, reading status, priority, and why-read rationale in a preview.

## Install

1. Download `sociology-phd-desk-zotero-0.1.0.xpi` and its `.sha256` file from the Sociology PhD Desk `v0.3.0` GitHub Release.
2. Verify that the XPI SHA-256 matches the checksum file.
3. In Zotero 8 or Zotero 9, open Tools → Plugins.
4. Open the gear menu, choose Install Plugin From File, and select the XPI.
5. Restart Zotero if prompted.

## Send references

1. Select one or more regular bibliographic items in Zotero 8 or Zotero 9.
2. Right-click and choose Send to Sociology PhD Desk.
3. A small selection opens the Literature import preview directly. A larger selection is saved as a local `.spdzotero` file, which the user selects from Literature → Import from Zotero.
4. Choose the target project, status, and priority, add the why-read rationale, and confirm before the current workspace is changed.

An exact Zotero identity can refresh bibliography, but cannot overwrite project, reading status, priority, why-read rationale, or local notes. DOI, ISBN, and title/year matches are suggestions and never merge automatically.

The plugin does not read or send PDFs, attachment paths, Zotero notes, annotations, full text, or storage paths. It does not perform background sync or write back to Zotero.
