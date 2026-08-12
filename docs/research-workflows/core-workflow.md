# Core Sociology Research Workflow

This document explains the research lifecycle the product is intended to coordinate. It does not prescribe a single method or linear research practice. Verified public `main` `1cbedd2` includes the merged Theory Research, hierarchical navigation, and integrated Manuscripts & Publishing work; the `release/0.2.0` branch packages it as a `0.2.0` release candidate, while the latest formal GitHub Release remains `v0.1.0`.

## Lifecycle map

```text
Project and research question
          ↓
Literature relevance and theoretical judgment
          ↓
Theory memo: concept / mechanism / dialogue / boundary
          ↓
Research design
   ↙ qualitative        quantitative ↘
Field site / interview   dataset / variable / model
   ↓                     ↓
Code / memo              analysis run / output
   ↘                     ↙
       Evidence and limitations
                  ↓
          Claim and manuscript
                  ↓
        Submission and decision
                  ↓
 Reviewer comment, response, revision action
```

The flow can loop. A reviewer comment can change a model, a field memo can change a research question, and contradictory evidence can restructure a manuscript.

## Project and question

A project supplies scope, method, status, dates, and the organizing question. Tasks, literature, fieldwork, analysis, evidence, logs, manuscripts, and submissions should retain a project link where applicable.

The question is not just a title. First-class questions allow several questions per project and explicit links to claims. The merged Theory implementation also lets a project-scoped memo reference same-project questions, claims, and literature without turning text into a foreign key.

## Literature

The literature workflow records:

- why a source should be read;
- which project or question it informs;
- what theoretical or empirical judgment follows;
- whether that judgment enters an argument.

Bibliographic completeness and citation insertion remain Zotero's responsibility. A DOI field is metadata, not proof that the source or citation has been verified.

## Theory Research

Theory work is organized around explicit project-scoped memos for concepts, mechanisms, theoretical dialogue, counterarguments, boundary conditions, and synthesis. A memo may link to existing ResearchQuestion, Claim, and Literature records by stable ID; theoretical writing continues in Manuscript.

The workflow supports defining a concept, specifying a mechanism, comparing authors or traditions, testing an alternative explanation, stating scope conditions, and synthesizing an argument. Structured prompt questions are interface guidance only. They never insert or generate stored prose, and migration never turns logs, notes, claims, or reading annotations into theory memos.

All linked endpoints must belong to the memo's project. Missing, duplicate, or cross-project links are invalid. Remove a relationship explicitly before deleting its endpoint; deleting a memo preserves every linked research object. The synthetic demo is explanatory only and makes no claim about real sources, findings, or theoretical validity.

## Fieldwork and interviews

Field sites, visits, and interviews use aliases and anonymous IDs. The workflow records status, references to externally protected source material, coding/memo progress, observations that have been ethically minimized, and follow-up work.

The workstation must not invite direct identifiers or become the default store for transcripts and consent documents.

## Quantitative analysis

The quantitative registry records how an analysis was produced: dataset reference, wave, source, script path, software, sample, model, outcome, predictor, result summary, and output path. Later versions should make variables, specifications, restrictions, robustness checks, timestamps, and code versions first-class.

The registry coordinates analysis; it does not execute, reproduce, or certify Stata/R/Python output automatically.

## Evidence ledger

An evidence item connects a claim or emerging judgment with:

- evidence type;
- exact source and locator;
- finding;
- assessed support level;
- limitations;
- manuscript destination.

Contradictory and unclear evidence are legitimate states, not errors to hide. Future bidirectional links should make it possible to audit a manuscript claim back to its sources.

## Research log

The log answers:

- What changed in the research today?
- What decision was made?
- Why was it made?
- What problem remains?
- What is the next step?

It is a decision audit trail, not a personal diary or automated activity feed.

## Manuscript, submission, and revision

The merged Manuscripts & Publishing presentation tracks manuscript writing status, target journal, word count, next action, and deadline alongside submission and reviewer workflows while retaining separate underlying entities and histories. A submission records the exact version and editorial state. Reviewer comments are decomposed into a response and revision action with a transparent state, including `Rejected with Rationale` when the author does not adopt a suggestion.

The long-term goal is a reviewer-response matrix connected to manuscript locations, evidence, and revised analysis runs.

## Today

Today is a cross-cutting view, not a generic todo product. It should surface the current project, up to three meaningful research goals, overdue work, category-specific tasks—including the current raw category `Theory / Conceptual Work`—today's research log, and completed work. Every task should link to a project whenever one exists.
