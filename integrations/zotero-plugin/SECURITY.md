# Zotero plugin security boundary

The Sociology PhD Desk Zotero plugin has the same high local privileges as other Zotero desktop plugins. Install it only from the project's signed GitHub Release asset and verify the published SHA-256 checksum.

Version 0.1.0 reads only bibliographic metadata from items the user explicitly selects and invokes from the item context menu. It does not read or transfer Zotero notes, annotations, attachment binaries, attachment paths, PDF text, full text, or storage paths. It does not upload a library, write back to Zotero, perform cloud sync, collect analytics, or make background network requests.

Small handoffs are placed in the URL fragment of the public Sociology PhD Desk app, so the bibliographic payload is not sent in the GitHub Pages HTTP request. The app immediately removes that fragment after parsing. Larger handoffs use a local `.spdzotero` file chosen by the user. The Desk always shows a preview before writing to a workspace.

Report plugin security issues through the repository's private security advisory route described in the root `SECURITY.md`. Do not attach a real Zotero library or research material to a public issue.
