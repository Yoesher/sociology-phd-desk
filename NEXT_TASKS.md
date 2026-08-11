# Next Tasks

> Candidate handoff queue for the 2026-08-11 bootstrap session. The final maintainer must reconcile this file with the actual shared tree before ending the session. Completed work should be removed or checked only after verification.

## P0 — release and data-integrity blockers

- [ ] Exercise every primary route with the final application build and record exact results in `PROJECT_STATE.md`.
- [ ] Verify IndexedDB persistence across reloads for representative project, fieldwork, evidence, and manuscript records.
- [ ] Verify JSON export round-trip, malformed-input rejection, default merge behavior, visible collision handling, and explicit replacement safeguards.
- [ ] Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` on the final shared revision; record failures honestly.
- [ ] Review the repository for secrets, machine-specific paths, raw research data, transcripts, fieldnotes, and unintended non-synthetic CSV files.
- [ ] Run the app locally and check desktop, narrow viewport, light theme, dark theme, empty states, demo state, and keyboard focus.
- [ ] Capture sanitized release screenshots from the verified build and add them under `docs/screenshots/`; update both READMEs.
- [ ] Reconcile README feature claims, `CHANGELOG.md`, and `PROJECT_STATE.md` with observed behavior.
- [ ] Initialize or confirm Git history, remote, and `main` branch without rewriting unrelated user work.
- [ ] When authenticated GitHub access exists, confirm whether `Yoesher/sociology-phd-desk` already exists before creating anything; create only a public repository, then push and verify the remote commit.
- [ ] Publish `v0.1.0` only after every release gate passes; include purpose, supported workflows, known limitations, privacy model, and roadmap in the release notes.

## P1 — strengthen the research workflow

- [ ] Promote Research Question and Claim to first-class objects with stable links to projects.
- [ ] Add bidirectional Claim ↔ Evidence ↔ Manuscript-location navigation.
- [ ] Add evidence contradiction and limitation review without collapsing uncertainty into a score.
- [ ] Add variable, model, sample-restriction, robustness-check, code-version, and output metadata to analysis runs.
- [ ] Deepen Interview → transcript reference → code → memo → claim traceability while retaining privacy warnings.
- [ ] Add schema migration tests and a human-readable import preview/conflict report.
- [ ] Add browser-level tests for persistence, import/export, and destructive confirmation paths.
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
