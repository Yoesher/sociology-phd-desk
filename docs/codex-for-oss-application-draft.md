# Codex for Open Source — application draft

**Status:** DRAFT ONLY — DO NOT SUBMIT AUTOMATICALLY

**Prepared:** 2026-08-15
**Internal readiness:** `MODERATE — strong maintenance evidence, limited external adoption evidence`

This document follows the current [official Codex for Open Source form](https://openai.com/form/codex-for-oss/) and its published selection signals: active open-source maintenance, meaningful usage or broad adoption, or clear importance to the software ecosystem. The form is reviewed on a rolling basis and currently offers selected maintainers six months of ChatGPT Pro with Codex, conditional Codex Security access, and API credits for core OSS work. This repository will not submit the form automatically.

## Identity fields — maintainer must complete

| Current form field | Draft value |
| --- | --- |
| First name | **REQUIRED — maintainer enters privately** |
| Last name | **REQUIRED — maintainer enters privately** |
| Email associated with ChatGPT | **REQUIRED — maintainer enters privately; do not commit** |
| GitHub username | `Yoesher` |
| GitHub repository URL | `https://github.com/Yoesher/sociology-phd-desk` |
| Role | Primary maintainer |
| Interested in | Codex Security; API credits for my project |
| OpenAI Organization ID | **REQUIRED — maintainer enters privately; do not commit** |

## Why does this repository qualify? — maximum 500 characters

**Draft (463 characters):**

> Sociology PhD Desk is an MIT-licensed, local-first ResearchOps workstation built for privacy-sensitive sociology. It connects theory, qualitative and quantitative work, evidence, literature, fieldwork, and publishing without accounts or required cloud storage. The project has 4 releases, CI, browser E2E, CodeQL, guarded migrations, PWA delivery, and an open-source Zotero integration. Adoption is early: 3 stars and 0 verified external testers as of 2026-08-15.

## How will you use API credits? — maximum 500 characters

**Draft (427 characters):**

> We would use API credits only for maintaining the public project: pull-request review, issue triage, regression-test maintenance, release automation, bilingual documentation, security remediation, migration auditing, and Zotero integration maintenance. Credits would not process private research workspaces, write a maintainer's dissertation, run user surveillance, or add a required AI service to this local-first application.

## Anything else we should know? — maximum 500 characters

**Draft (469 characters):**

> The repository records zero verified external testers and does not convert stars into user claims. It addresses an underserved gap: privacy-respecting research orchestration for sociologists across bibliographic, theoretical, qualitative, quantitative, and publication workflows. Priorities are safe releases, synthetic-data testing, real researcher feedback, and transparent limitations; no account, analytics, cloud sync, or private Zotero-library access is required.

## Evidence snapshot

As of 2026-08-15: 3 Stars, 0 Forks, 5 open Issues, 15 closed Issues, 3 open Pull Requests (automated Dependabot updates), 26 merged Pull Requests, 4 Releases, 0 verified external testers, and 0 verified external human contributors in project records. The current published release is `v0.2.2`; `v0.3.0` is under active milestone development and is not yet released.

Maintenance evidence includes reproducible local and CI gates, exact-head self-review, exact-main CI/Pages verification, CodeQL, weekly Dependabot, high/critical npm audit gating, browser E2E with synthetic fixtures, encrypted-workspace migration tests, and a reproducible Zotero plugin tested only with isolated synthetic Zotero 8 and Zotero 9 profiles.

## Readiness judgment

`APPLICATION_READINESS = MODERATE`

The project shows unusually strong maintenance, privacy, migration, security, and release evidence for its age, and it addresses a clear sociology ResearchOps gap. It does not yet show meaningful external adoption: known external testers and verified external human contributors remain zero. The honest recommendation is to finish `v0.3.0`, recruit consented real researcher testing, record issues/feedback, and then reassess whether to apply.

No application should be submitted until the maintainer personally supplies the private identity, ChatGPT email, and Organization ID fields and approves the final text.
