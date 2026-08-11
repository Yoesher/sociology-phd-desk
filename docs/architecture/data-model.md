# Data Model

This document describes the `0.1.x` conceptual model. Types and migrations in the code are authoritative for a particular revision; reconcile this document whenever the stored schema changes.

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

Fields include project ID, title, short title, research question, topic, method, status, start date, target date, and notes.

Methods: Quantitative, Qualitative, Mixed Methods, Theoretical.

Statuses: Idea, Design, Data / Fieldwork, Analysis, Writing, Submission, Revision, Published, Archived.

The project is the primary coordination boundary for tasks, literature, fieldwork, datasets, analysis runs, evidence, logs, manuscripts, and submissions.

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

Fields include evidence ID, project link, claim text or future claim ID, evidence type, source, locator, finding, support level, limitations, and manuscript location.

Evidence types: Literature, Quantitative Result, Interview, Fieldnote, Policy / Document, Other.

Support levels: Strong, Moderate, Weak, Contradictory, Unclear.

A support level is a researcher's documented judgment. It is not an automated truth score. Locator and limitations are essential provenance fields.

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
 ├─ Research Question
 ├─ Literature ─────────────┐
 ├─ Dataset → Analysis Run ─┼→ Evidence → Claim → Manuscript
 ├─ Interview / Field Visit ┘                         ↓
 ├─ Research Log                                  Submission
 └─ Task                                              ↓
                                              Reviewer Comment
                                                       ↓
                                                Revision Task
```

Some nodes are future first-class objects. Until then, free-text fields must not be presented as equivalent to a stable bidirectional relationship.

## Deletion and archiving

Prefer archival states for research history. Before deleting an object, identify incoming links and explain the effect. Cascading deletion of research records is unsafe unless the relationship and recovery behavior are explicit and tested.

## Schema evolution

- Increment the database schema version for stored-structure changes.
- Write migrations that preserve user records.
- Test upgrades from every supported prior schema.
- Update portable format versions independently when export semantics change.
- Record durable changes in `DECISIONS.md` and current limitations in `PROJECT_STATE.md`.
