# Contributing to Sociology PhD Desk

Thank you for helping build a durable, sociology-specific research workstation. Contributions may be code, tests, documentation, accessibility work, design, translations, or carefully described research-workflow needs.

## Before you contribute

1. Read [README.md](README.md), [PROJECT_STATE.md](PROJECT_STATE.md), [DECISIONS.md](DECISIONS.md), and [NEXT_TASKS.md](NEXT_TASKS.md).
2. Search existing issues before opening a new one.
3. Use the issue form that matches the work: bug, feature, or research workflow.
4. For a substantial architecture or data-model change, open an issue before investing in a full implementation.

Never submit real participant data, identifiable metadata, interview transcripts, private fieldnotes, credentials, API keys, unpublished proprietary datasets, or confidential reviewer correspondence. Use the explicitly synthetic demo conventions described below.

## Development setup

The verified local environment for the initial build is Node.js 24 and npm 11.

```bash
git clone https://github.com/Yoesher/sociology-phd-desk.git
cd sociology-phd-desk
npm ci
npm run dev
```

Create a focused branch and keep unrelated changes separate. The conventional `codex/` prefix is used for Codex-created branches; human contributors may use a short descriptive branch name.

## Product test for a proposal

Every proposal should explain:

- Which sociology research object or lifecycle transition is affected?
- What is impossible, unsafe, or unnecessarily fragmented today?
- Why is this not better solved by Zotero, Word, Stata/R/Python, NVivo/MAXQDA, or a general task manager?
- What privacy, ethics, reproducibility, and migration risks does it introduce?

Generic productivity features are intentionally a lower priority than traceability across projects, questions, evidence, analysis, manuscripts, submissions, and revisions.

## Implementation expectations

- Keep domain and persistence logic out of page components when practical.
- Preserve local-first operation; the core application must not require an account, server, or AI API.
- Treat schema and import behavior as compatibility surfaces. Validate external data before writing it.
- Never silently overwrite an existing workspace. Import conflicts must be visible; replacement must be explicit.
- Keep source evidence distinct from AI-generated suggestions.
- Use anonymous fieldwork identifiers and retain the participant-privacy warning.
- Follow the existing visual language instead of importing a generic dashboard template.
- Add or update tests for changed behavior.
- Update user documentation and long-term handoff files when behavior or status changes.

## Synthetic demo data

Demo records must be visibly marked `DEMO` or `synthetic`. Do not invent plausible DOI values, quotations, effect sizes, interview passages, or institutional claims. A safe fixture uses obviously fictional titles, aliases such as `INT-001`, and neutral placeholder findings.

## Required checks

Run all checks on the exact revision you intend to submit:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

If a check cannot run, describe the exact command and failure in the pull request. Never report a check as passing based on expectation or an earlier revision.

## Commit and pull-request guidance

- Write clear, imperative commit messages that match the actual change, for example `feat: add evidence conflict review` or `docs: clarify import safety`.
- Avoid artificial commit volume and avoid combining unrelated work into one unreviewable commit.
- In the pull request, describe the problem, approach, user-visible change, data migration impact, tests run, and screenshots for visual work.
- Confirm that no secret or research data is included.
- Link the relevant issue when one exists.

A maintainer may ask for a smaller scope, an ADR entry in [DECISIONS.md](DECISIONS.md), migration documentation, or additional tests before merging.

## Documentation-only changes

Documentation must distinguish current verified behavior from planned work. Do not invent repository metrics, users, contributors, releases, institutional adoption, or external mentions. Update [docs/codex-for-oss.md](docs/codex-for-oss.md) only from verifiable sources and date every metric snapshot.

## Reporting security problems

Do not open a public issue for a vulnerability or disclose sensitive sample data. Follow [SECURITY.md](SECURITY.md).

## Community standards

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). By contributing, you agree that your contribution is licensed under the repository's [MIT License](LICENSE).
