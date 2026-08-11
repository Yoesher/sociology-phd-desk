# Security Policy

Sociology PhD Desk is local-first research workflow software. Its threat model deserves extra caution because even metadata can expose participants, field sites, unpublished findings, or career-sensitive peer review.

## Supported versions

No production release is currently declared. Security fixes are developed against the latest maintained branch. Once releases exist, this section will list supported versions explicitly.

## Report a vulnerability

Do **not** open a public issue with exploit details, private research data, credentials, or screenshots that expose sensitive records.

After the public repository enables private vulnerability reporting, use GitHub's **Security → Report a vulnerability** flow for `Yoesher/sociology-phd-desk`. If that channel is unavailable, open a public issue containing only a request for a private maintainer contact—no vulnerability details—and retain the details until a private channel is established.

Include, when safe:

- affected revision or version;
- browser and operating system;
- minimal reproduction using synthetic data;
- security impact and likely attack preconditions;
- whether export files, browser storage, or external links are involved;
- suggested mitigation, if known.

The maintainers will acknowledge and triage reports on a best-effort basis. No response or remediation time is promised during this early public-release stage. Coordinated disclosure timing will be agreed with the reporter when possible.

## Security boundaries

- The application stores core records in the browser's IndexedDB. It does not make the device, browser profile, or exported files encrypted by itself.
- Anyone with access to an unlocked browser profile may be able to read local application data.
- Clearing site data, browser resets, profile corruption, and device loss can destroy local records.
- JSON exports may contain everything entered in the workspace. Treat them according to the most sensitive contained record.
- Local paths are references, not access controls or secure file storage.
- The public repository is for source code, public documentation, and synthetic demo data only.

## Research-data safety

Do not store directly identifying participant information in the application. Do not commit or attach:

- names, phone numbers, government identifiers, exact addresses, signatures, or consent forms;
- interview transcripts or private fieldnotes;
- raw or restricted datasets (`.dta`, `.sav`, CSV research extracts, and similar files);
- API keys, credentials, `.env` files, or `config.local.*`;
- confidential manuscripts, decisions, or reviewer correspondence.

Use institutional storage, encryption, access controls, retention schedules, and de-identification procedures appropriate to the study. See [research ethics](docs/research-workflows/research-ethics.md).

## Dependency and change hygiene

Security-sensitive changes should include tests where feasible and pass lint, type checking, tests, and the production build. Dependency updates must be reviewed for provenance, license compatibility, and changes to network behavior. The core application must not add telemetry, trackers, cloud synchronization, or external AI calls by default.
