# Next Tasks

> Verified handoff queue after the public [`v0.1.0`](https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.1.0) release. Checked items have independent evidence; unchecked items remain future work.

## P0 — first authenticated publication (complete)

- [x] Install the official GitHub CLI and verify the authenticated account as `Yoesher` without placing a token in project files, shell history, or documentation.
- [x] Confirm the target did not exist, then create exactly one public repository: [Yoesher/sociology-phd-desk](https://github.com/Yoesher/sociology-phd-desk).
- [x] Add the verified repository as `origin`, push local `main`, and match the release SHA through local Git, Git transport, and the GitHub API.
- [x] Confirm [remote CI](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31483003952) passes `npm ci`, lint, typecheck, 25 tests, and build on the release SHA.
- [x] Enable GitHub Pages through Actions, verify the [release deployment run](https://github.com/Yoesher/sociology-phd-desk/actions/runs/31483003953), and smoke-test the [deployed demo](https://yoesher.github.io/sociology-phd-desk/).
- [x] Re-run the public secret/data review and verify the README plus all three screenshot URLs through GitHub's rendering and Contents APIs.
- [x] Publish [`v0.1.0`](https://github.com/Yoesher/sociology-phd-desk/releases/tag/v0.1.0) only after remote CI passes; include supported workflows, narrower CRUD scope, privacy/backup model, known limitations, and roadmap in the release notes.
- [x] Update `PROJECT_STATE.md` and `docs/codex-for-oss.md` with source-backed repository, commit, CI, tag, release, Pages, Issues, and real metric evidence.

## P1 — strengthen the research workflow

- [ ] Promote Research Question and Claim to first-class objects with stable links to projects ([#1](https://github.com/Yoesher/sociology-phd-desk/issues/1)).
- [ ] Add bidirectional Claim ↔ Evidence ↔ Manuscript-location navigation and contradiction/limitation review without collapsing uncertainty into a score ([#2](https://github.com/Yoesher/sociology-phd-desk/issues/2)).
- [ ] Add variable, model, sample-restriction, robustness-check, code-version, and output metadata to analysis runs ([#3](https://github.com/Yoesher/sociology-phd-desk/issues/3)).
- [ ] Deepen Interview → transcript reference → code → memo → claim traceability while retaining privacy warnings ([#4](https://github.com/Yoesher/sociology-phd-desk/issues/4)).
- [ ] Retain fixture-based database and portable JSON migration coverage for every supported prior version; add human-readable import preflight, deterministic conflict reporting, and large-workspace guards ([#5](https://github.com/Yoesher/sociology-phd-desk/issues/5)).
- [ ] Add browser-level tests for route rendering, persistence, import/export, cross-tab conflicts, modal layering, and destructive confirmation paths at desktop and mobile viewports ([#6](https://github.com/Yoesher/sociology-phd-desk/issues/6)).
- [ ] Complete accessibility and cross-browser audits.
- [ ] Gather real, consented feedback from sociology researchers through issues or documented testing; do not infer adoption from page views or informal interest.

## P2 — ecosystem work after a stable core

- [ ] Evaluate Zotero integration against its official API and license while preserving the product boundary.
- [ ] Evaluate Crossref, OpenAlex, and ORCID metadata workflows with explicit network/privacy behavior.
- [ ] Design configurable Stata, R, and Python run references without committing local executable paths.
- [ ] Evaluate Word/DOCX, Markdown, and Quarto export/linking.
- [ ] Investigate NVivo/MAXQDA imports only if formats and licenses permit.
- [ ] Add optional AI-assisted workflows only with clear consent, provenance, and separation between source evidence and generated suggestion.
- [x] Configure GitHub Pages for a synthetic, browser-local demo: `https://yoesher.github.io/sociology-phd-desk/`.
- [ ] Maintain real repository metrics and external mentions in `docs/codex-for-oss.md` from verifiable sources.

## Explicitly out of scope

Do not prioritize social networking, chat, a research community, a Zotero replacement, a full Markdown editor, a large AI chatbot, payments, accounts, a cloud backend, complex permissions, or a native mobile app.
