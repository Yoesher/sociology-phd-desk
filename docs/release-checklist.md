# Release Checklist

Use this checklist for every release. A checked item means it was verified against the exact release revision.

## `v0.2.0` candidate checkpoint — 2026-08-12

This checkpoint records only completed candidate work. It does not replace the reusable checklist below and does not claim that the release PR, final `main`, annotated tag, or GitHub Release exists.

- [x] `FEATURE FREEZE FOR v0.2.0` is active on `release/0.2.0`.
- [x] Package and lockfile version are `0.2.0`; portable/standard v4, encrypted container v1, encrypted-vault database v1, and registry database v1 remain independently documented axes.
- [x] Navigation PR #20 merged as exact `main` `1cbedd2f045c99e40f71bbec434c5c14cae7bb58`; exact-head CI, P0 = 0 / P1 = 0 self-review, exact-main CI, and Pages passed.
- [x] Candidate local gates passed: `npm ci`; lint 0; typecheck; 28 files / 269 tests in 24.96 s; Vite 1,962-module build in 481 ms.
- [x] Eight JPEG candidate screenshots were captured from a 1280 × 720 real-application viewport using only the explicitly synthetic Demo; each registered image records its exact 1265 × 712 or 1280 × 720 dimensions and passed privacy review.
- [x] China Research Map remains deferred and excluded; all four map gates remain `BLOCKED` / `NOT TESTABLE`, and no map implementation or asset shipped.
- [x] Complete exact-candidate browser checks: standard create/project/question/Theory Memo/Theory task/reload; encrypted create/Theory Memo/lock/wrong-passphrase clear/correct unlock/persistence/encrypted-backup generation; English primary routes; 390 × 844 mobile More; zero console warnings/errors; and deletion of both synthetic QA workspaces. The browser invoked plaintext export but did not expose its downloaded file for inspection; encrypted-backup import/restore was NOT RUN manually and remains automated-test evidence. Publishing state mappings, legacy routes, keyboard behavior, and accessible names remain supported by the final automated suite and the unchanged application-source navigation smoke rather than a newly repeated full manual matrix.
- [x] Complete final diff, Markdown-link, secret/private-data, dependency, screenshot-truth, and release-candidate review: P0 = 0, P1 = 0.
- [ ] Open and pass the release PR, then verify exact-main CI/Pages and public behavior.
- [ ] Create the annotated `v0.2.0` tag and non-draft/non-prerelease GitHub Release. Do not move `v0.1.0`.

## Product and data

- [ ] Core routes open and their primary interactions work.
- [ ] IndexedDB records persist after reload in a supported browser.
- [ ] JSON export validates and round-trips.
- [ ] Invalid import produces no writes.
- [ ] Merge collisions are visible and non-destructive.
- [ ] Replacement is separate, explicit, confirmed, and transactional.
- [ ] Demo records are synthetic and clearly marked.
- [ ] Fieldwork surfaces retain the direct-identifier warning.
- [ ] A fresh browser profile opens in Simplified Chinese; switching to English is immediate and survives reload.
- [ ] Both languages cover every current route, validation message, dialog, empty state, accessible name, and responsive table label.
- [ ] Language switching does not alter workspace revision, demo markers, user-authored content, enum values, or portable JSON semantics.
- [ ] Theory Memo create/read/update/delete, project/type/date filters, all bilingual views, same-project question/claim/literature links, deletion protection, UI-only prompts, and theoretical-manuscript reuse work on the exact release revision.
- [ ] `Theory / Conceptual Work` remains a locale-neutral raw task category while its display label and filters follow the selected language.
- [ ] Fresh personal data remains empty; the demo's Theory records are minimal, explicitly synthetic, and make no real citation, finding, or theoretical-conclusion claim.
- [ ] Portable and standard v4 round-trip; v1 → v2 → v3 → v4 migration adds no inferred theory; ambiguous, duplicate, dangling, and cross-project Theory relationships produce zero writes.
- [ ] Container v1, encrypted-vault database v1, and registry database v1 remain distinct from portable/standard v4; authenticated legacy portable-v3 vaults/backups migrate safely and every failure retains old ciphertext or creates no target.

## Quality gates

- [ ] `npm ci`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Manual desktop and narrow-layout review
- [ ] Light and dark theme review
- [ ] Keyboard focus and basic accessibility review
- [ ] Supported-browser smoke test
- [ ] Theory desktop/mobile smoke covers create/edit/view/link/unlink/protected delete, filters, UI-only prompts, task category, reload persistence, empty state, both languages, keyboard/focus, ARIA names, and no horizontal overflow or application console errors.

Attach or record exact outputs; do not infer success from an earlier revision.

## Repository safety

- [ ] Inspect `git status`, staged files, and diff.
- [ ] Scan for credentials, API keys, `.env`, and machine-local configuration.
- [ ] Scan for real datasets, CSV extracts, transcripts, fieldnotes, local paths, or participant information.
- [ ] Review dependency changes and licenses.
- [ ] CI passes on the release commit.

## Documentation

- [ ] README feature claims match observed behavior.
- [ ] English and Chinese READMEs remain substantively aligned.
- [ ] `README.md` remains the Chinese-default entry and links directly to the complete `README.en.md`.
- [ ] Sanitized screenshots come from the release candidate.
- [ ] `CHANGELOG.md` describes user-visible changes.
- [ ] `PROJECT_STATE.md` records architecture, checks, known issues, GitHub state, release, and next target.
- [ ] `NEXT_TASKS.md` contains only unresolved work.
- [ ] `DECISIONS.md` includes durable new choices.
- [ ] Security and research-ethics limitations remain prominent.

## GitHub and release

- [ ] Remote repository and visibility are independently verified.
- [ ] The release commit exists on `main`.
- [ ] Version, tag, and release title match.
- [ ] Release notes explain purpose, supported workflows, known limitations, privacy model, and roadmap.
- [ ] GitHub Pages, if enabled, contains only synthetic/browser-local demo data.
- [ ] The deployed Pages build opens in Chinese on a fresh profile, switches immediately to English, and retains the chosen language after reload.
- [ ] Both deployed languages retain the current route, theme, workspace data, and privacy warnings at desktop and narrow widths.
- [ ] Metrics in `docs/codex-for-oss.md` are refreshed from verifiable sources and dated.

Do not publish when a required check fails. Record the blocker in `PROJECT_STATE.md` and `NEXT_TASKS.md` instead.
