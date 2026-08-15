# Sociology PhD Desk Zotero plugin

Version `0.1.0` supports Zotero 8 and Zotero 9 through the official `MenuManager` item context-menu API. The release candidate was verified with isolated synthetic profiles on Zotero 8.0.4 and Zotero 9.0.6; no real user library was used.

## Build and test

From the repository root:

```powershell
npm run test:zotero
npm run build:zotero
```

The deterministic build writes the XPI and checksum to `integrations/zotero-plugin/dist/`. The build script creates the archive twice in memory and fails if the bytes differ.

Install the XPI only into an isolated Zotero 8 or Zotero 9 testing profile during development. The `v0.3.0` candidate will publish this file as a Release asset only after its reproducible build, checksum, PR, exact-main, and public-download gates pass; until then the bilingual guides intentionally omit a public asset link.
