# Next Tasks

> Verified handoff queue after the locally complete `0.1.0` Phase 1 candidate. Completed bootstrap work has been removed; unchecked items remain future work.

## P0 — first authenticated publication

- [ ] Install or otherwise provide an authenticated GitHub write path; do not place a token in project files, shell history, or documentation.
- [ ] Recheck whether `Yoesher/sociology-phd-desk` exists before creating anything; if absent, create exactly one **public** repository under `Yoesher`.
- [ ] Add the verified repository as `origin`, push local `main`, and compare the remote commit SHA with the intended local revision.
- [ ] Confirm the GitHub Actions workflow passes `npm ci`, lint, typecheck, 22 tests, and build on the pushed revision.
- [ ] Re-run the public secret/data review and verify README image rendering from GitHub.
- [ ] Publish `v0.1.0` only after remote CI passes; include supported workflows, narrower CRUD scope, privacy/backup model, known limitations, and roadmap in the release notes.
- [ ] Update `PROJECT_STATE.md` and `docs/codex-for-oss.md` with source-backed repository, commit, CI, tag, and release URLs.

## P1 — strengthen the research workflow

- [ ] Promote Research Question and Claim to first-class objects with stable links to projects.
- [ ] Add bidirectional Claim ↔ Evidence ↔ Manuscript-location navigation.
- [ ] Add evidence contradiction and limitation review without collapsing uncertainty into a score.
- [ ] Add variable, model, sample-restriction, robustness-check, code-version, and output metadata to analysis runs.
- [ ] Deepen Interview → transcript reference → code → memo → claim traceability while retaining privacy warnings.
- [ ] Add schema migration tests and a human-readable import preview/conflict report.
- [ ] Add browser-level tests for route rendering, persistence, import/export, cross-tab conflicts, modal layering, and destructive confirmation paths at desktop and mobile viewports.
- [ ] Complete accessibility and cross-browser audits.
- [ ] Gather real, consented feedback from sociology researchers through issues or documented testing; do not infer adoption from page views or informal interest.

## P2 — ecosystem work after a stable core

- [ ] Evaluate Zotero integration against its official API and license while preserving the product boundary.
- [ ] Evaluate Crossref, OpenAlex, and ORCID metadata workflows with explicit network/privacy behavior.
- [ ] Design configurable Stata, R, and Python run references without committing local executable paths.
- [ ] Evaluate Word/DOCX, Markdown, and Quarto export/linking.
- [ ] Investigate NVivo/MAXQDA imports only if formats and licenses permit.
- [ ] Add optional AI-assisted workflows only with clear consent, provenance, and separation between source evidence and generated suggestion.
- [ ] Configure GitHub Pages for a synthetic, browser-local demo after the `0.1.x` application is stable.
- [ ] Maintain real repository metrics and external mentions in `docs/codex-for-oss.md` from verifiable sources.

## Explicitly out of scope

Do not prioritize social networking, chat, a research community, a Zotero replacement, a full Markdown editor, a large AI chatbot, payments, accounts, a cloud backend, complex permissions, or a native mobile app.
