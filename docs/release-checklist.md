# Release Checklist

Use this checklist for every release. A checked item means it was verified against the exact release revision.

## Product and data

- [ ] Core routes open and their primary interactions work.
- [ ] IndexedDB records persist after reload in a supported browser.
- [ ] JSON export validates and round-trips.
- [ ] Invalid import produces no writes.
- [ ] Merge collisions are visible and non-destructive.
- [ ] Replacement is separate, explicit, confirmed, and transactional.
- [ ] Demo records are synthetic and clearly marked.
- [ ] Fieldwork surfaces retain the direct-identifier warning.

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
- [ ] Metrics in `docs/codex-for-oss.md` are refreshed from verifiable sources and dated.

Do not publish when a required check fails. Record the blocker in `PROJECT_STATE.md` and `NEXT_TASKS.md` instead.
