# Data Model

This document describes the Phase 3B conceptual model merged into `main`, including portable workspace v3. Types and migrations in the code are authoritative for a particular revision; reconcile this document whenever the stored schema changes. Phase 3B remains unreleased: the latest formal release is still v0.1.0 until the complete v0.2.0 release gate passes.

## Shared conventions

- Every durable object has a stable opaque ID.
- Relationships use IDs, not display titles.
- Dates use an unambiguous ISO representation where practical.
- Optional human-facing labels do not replace stable IDs.
- Demo objects carry an explicit synthetic/demo marker.
- Fieldwork identifiers must not encode names or other direct identifiers.
- Local file paths are references only; the application does not ingest or secure the files they point to.

## Core objects

### Research Project

Fields include project ID, title, short title, topic, method, status, start date, target date, and notes. In portable v3, research questions are separate objects rather than a `Project.researchQuestion` string.

Methods: Quantitative, Qualitative, Mixed Methods, Theoretical.

Statuses: Idea, Design, Data / Fieldwork, Analysis, Writing, Submission, Revision, Published, Archived.

The project is the primary coordination boundary for tasks, literature, fieldwork, datasets, analysis runs, evidence, logs, manuscripts, and submissions.

### Research question

Fields include stable question ID, project ID, text, status, notes, creation time, update time, and the shared synthetic/demo marker.

Persisted statuses: `draft`, `active`, `addressed`, `retired`.

A question's ID remains stable when its wording, notes, or status changes. Text is authored research content, not a key and not a locale resource. Every question belongs to exactly one project.

### Analytical claim

Fields include stable claim ID, project ID, text, status, notes, creation time, update time, and the shared synthetic/demo marker.

Persisted statuses: `draft`, `active`, `superseded`, `retired`.

An analytical claim is a judgment formed and revised during research. Its status does not mean that the claim has been proven, nor does it represent statistical significance. A claim's ID remains stable as the analysis changes, and every claim belongs to exactly one project.

The interface explains this boundary as: “分析主张是研究过程中形成和修订的分析判断。其状态不代表该主张已经被证实，也不代表统计显著性。” / “Analytical claims are interpretive judgments formed and revised during the research process. Their status does not indicate that they have been substantiated, nor does it indicate statistical significance.”

### Claim–question link

`ClaimQuestionLink` represents the explicit many-to-many relationship between claims and research questions. It contains stable entity metadata plus `projectId`, `researchQuestionId`, and `claimId`.

Both endpoints must exist and must share the link's project. Cross-project links, missing endpoints, and duplicate claim–question pairs are invalid. The relationship uses stable IDs rather than text, and no relationship is inferred from matching or similar prose.

### Task and Today planning

A research task records title, date/deadline, completion state, category, priority, and a required project link. Categories distinguish reading, writing, analysis, fieldwork/interview, submission, and other research work. Today's goals are a short prioritized focus, not a second unbounded task database.

### Literature item

Fields include title, authors, year, journal, DOI, URL, project link, status, priority, why-read, and notes.

Statuses: Inbox, To Read, Reading, Read, Cited, Archived.

The object captures research relevance and argumentative use. It is not a complete citation-library record and must not manufacture DOI verification.

### Field site

Fields include site ID, site name or alias, project link, status, and notes. Use an alias when a real place would increase disclosure risk.

### Interview

Fields include interview ID, participant alias, project link, field-site link, interview date, status, transcript status, coding status, memo status, and notes.

The participant alias is not permission to enter a direct identifier. Source transcripts remain outside the application unless a future ethically reviewed design explicitly changes that boundary.

### Field visit

Fields include visit ID, date, site link, purpose, observations, follow-up, and memo. Observations must be written with disclosure risk in mind.

### Dataset

Fields include dataset ID, name, wave, source, local-path reference, project link, and notes. It is a registry record, not the dataset itself.

### Analysis run

Fields include run ID, project link, date, software, script-path reference, dataset link, sample, model, outcome, key predictor, status, result summary, and output-path reference.

Software: Stata, R, Python, Other.

Future versions should add model specification, robustness checks, sample restrictions, timestamps, and code versions without pretending to execute or validate the analysis automatically.

### Evidence item

Fields include evidence ID, project link, legacy/source-context claim text, evidence type, source, locator, finding, support level, limitations, and manuscript location.

Evidence types: Literature, Quantitative Result, Interview, Fieldnote, Policy / Document, Other.

Support levels: Strong, Moderate, Weak, Contradictory, Unclear.

A support level is a researcher's documented judgment. It is not an automated truth score. Locator and limitations are essential provenance fields.

Portable v3 retains the existing `Evidence.claim` text so migration cannot discard or rewrite source context. Phase 3B does not add an evidence `claimId` or an Evidence↔Claim relationship; that remains separate Issue #2 work. Claim–question links must never be inferred from evidence text.

### Research log entry

Fields include date, project link, what changed, decision, problem, and next step. This is a research decision trail, not a general diary.

### Manuscript

Fields include title, project link, target journal, status, word count, next action, and deadline.

Statuses: Idea, Outline, Drafting, Internal Review, Ready to Submit, Submitted, Under Review, Revision, Accepted, Published, Rejected, Reworking.

### Submission

Fields include manuscript/project link, journal, submission date, manuscript version, status, editorial status, decision date, decision, and notes.

### Reviewer comment

Fields include submission link, reviewer label, comment ID, comment, severity, response, revision action, and status.

Statuses: Open, Addressing, Resolved, Rejected with Rationale.

Reviewer labels should avoid unnecessary identifying speculation.

## Relationship direction

The target graph is:

```text
Project
 ├─ Research Question ← ClaimQuestionLink → Claim
 ├─ Literature
 ├─ Dataset → Analysis Run → Evidence
 ├─ Interview / Field Visit
 ├─ Research Log
 ├─ Task
 └─ Manuscript → Submission → Reviewer Comment → Revision Task
```

Research questions, claims, and their explicit many-to-many links are first-class Phase 3B objects. Evidence↔Claim remains a future explicit relationship; the retained `Evidence.claim` string must not be presented as equivalent to one.

## Deletion and archiving

Prefer archival states for research history. Before deleting an object, identify incoming links and explain the effect. Cascading deletion of research records is unsafe unless the relationship and recovery behavior are explicit and tested.

Research questions and claims use protected deletion: a record with an incoming `ClaimQuestionLink` cannot be deleted until the user explicitly removes that link. Deleting a project is blocked while its questions, claims, or claim–question links remain; these records are not silently cascade-deleted.

## Schema evolution

- Increment the database schema version for stored-structure changes.
- Write migrations that preserve user records.
- Test upgrades from every supported prior schema.
- Update portable format versions independently when export semantics change.
- Record durable changes in `DECISIONS.md` and current limitations in `PROJECT_STATE.md`.

### Portable workspace v3 migration

- Compose supported upgrades deterministically as v1 → v2 → v3 rather than skipping version-specific semantics.
- Migrate each non-empty legacy `Project.researchQuestion` into a first-class `ResearchQuestion` under the same project, then omit the legacy project field from v3.
- Preserve every legacy `Evidence.claim` string as source-context text in v3.
- Create first-class claims from non-empty legacy evidence claim text deterministically within each project. Grouping is allowed only for byte-for-byte equal values after trimming; do not perform semantic or fuzzy merging and do not rewrite the text.
- Do not infer that any migrated claim answers any research question. Legacy migration produces no `ClaimQuestionLink` records.
- Validate all migrated endpoint and project invariants before writing.
