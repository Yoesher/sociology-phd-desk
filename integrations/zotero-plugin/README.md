# Sociology PhD Desk Zotero plugin

Version `0.1.0` supports Zotero 8 through the official `MenuManager` item context-menu API.

## Build and test

From the repository root:

```powershell
npm run test:zotero
npm run build:zotero
```

The deterministic build writes the XPI and checksum to `integrations/zotero-plugin/dist/`. The build script creates the archive twice in memory and fails if the bytes differ.

Install the XPI only into an isolated Zotero 8 testing profile during development. Production installation steps are documented in the bilingual Zotero integration guides.
