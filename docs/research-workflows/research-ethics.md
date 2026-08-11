# Research Ethics and Privacy

> **Do not store directly identifying participant information here.**

Sociology PhD Desk helps coordinate research work. It is not an ethics review, consent-management, de-identification, encryption, secure enclave, or institutional repository system.

## Data minimization

Record only what is needed to manage the workflow. Prefer:

- `participant_id`, `case_id`, `interview_id`, and `site_id`;
- participant and site aliases that do not encode real identities;
- broad, non-identifying categories when exact detail is unnecessary;
- references to protected source material rather than copying that material into the application.

Do not enter:

- names, phone numbers, personal email addresses, government identifiers, signatures, or photographs of identity documents;
- exact home addresses or unnecessarily precise location histories;
- complete consent forms or re-identification keys;
- raw interview transcripts or private fieldnotes by default;
- details that become identifying in combination even when each field appears indirect.

Anonymous-looking IDs are not automatically anonymous. Keep the mapping key in a separately controlled, institutionally approved system.

## Field sites, visits, and interviews

- Use a site alias if naming the site could expose people or organizations.
- Use participant aliases only as working labels; do not reuse public nicknames or initials that permit inference.
- Write observations and memos with audience, future sharing, and deductive disclosure in mind.
- Treat relationship maps and event timelines as potentially sensitive even without names.
- Follow the study's approved consent, access, retention, and deletion plan.

## Local-first limits

Browser-local storage reduces routine third-party transfer but does not make data secure by itself:

- anyone with access to the unlocked browser profile may be able to read records;
- browser/site-data clearing can erase records;
- device malware, backups, or shared operating-system accounts can expose records;
- JSON exports contain readable workspace data unless protected outside the application;
- local path fields may reveal folder names, institutions, topics, or participant aliases.

Use device encryption, a protected operating-system account, institutional storage, encrypted backups, and retention practices appropriate to the study.

## Public repository and issue safety

Only source code, public documentation, and clearly synthetic demo data belong in the repository. Never attach real research data to an issue or pull request. Redact screenshots and use synthetic reproduction files.

The `.gitignore` is a guardrail, not proof that a commit is safe. Review staged files manually.

## Import and export

Before export, assume the file contains every field entered in the workspace. Save it to an appropriate protected location and inspect it before sharing.

Before import, verify source, study authorization, schema preview, conflicts, and intended mode. Merge must not silently overwrite existing records; replacement must be explicit.

## AI and external integrations

Do not send research records to an AI model, metadata service, or integration merely because a feature is available. A future integration must disclose:

- what data leaves the device;
- the recipient and purpose;
- retention and training implications when known;
- the user's explicit action or consent;
- a local/offline alternative where the core workflow is concerned.

AI-generated text is a suggestion, not source evidence. It requires human review and an actual source before it can support a claim.

## Researcher responsibility

The researcher remains responsible for ethics approval, consent, lawful basis, data-use agreements, participant expectations, access control, accuracy, retention, deletion, and disclosure decisions. When project policy conflicts with this tool's convenience, follow the stricter policy and do not enter the data.
