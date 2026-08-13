# Repository Instructions for Agents

These rules apply to every Codex agent or automated contributor working in this repository. They protect user data, project continuity, and the truthfulness of the public record.

## Mandatory handoff sequence

1. Read `README.md` first.
2. Then read `PROJECT_STATE.md`.
3. Then read `DECISIONS.md`.
4. Then read `NEXT_TASKS.md`.
5. Check `git status` before modifying anything; preserve unrelated and user-owned changes.
6. Never overwrite user data. Import, migration, reset, and demo actions must not silently replace an existing workspace.
7. Never commit secrets to Git. Also exclude private research data, transcripts, fieldnotes, credentials, API keys, and machine-local configuration.
8. For every feature change, run tests and the production build; the full expected gate is lint, type checking, tests, and build.
9. Record major architecture or data-model changes in `DECISIONS.md`.
10. After completing a task, update `PROJECT_STATE.md` and `NEXT_TASKS.md` to match the verified state.
11. Use clear commit messages that truthfully describe the change.
12. Never fabricate passing tests merely to “complete” a task. Record the exact command and failure when a check cannot pass.
13. Never fabricate Stars, users, downloads, issues, contributors, releases, external mentions, or project adoption.

## Permanent product principles

1. Sociology PhD Desk is a sociology research workstation, not a general-purpose Todo application.
2. Simplified Chinese is the default user language. Every substantial new UI feature must provide both `zh-CN` and `en` in the same change.
3. Primary navigation represents domains of research work.
4. Secondary navigation represents research workflows or smart views within a domain.
5. Secondary navigation is normally a derived view or smart filter and must not be tightly coupled to database enums.
6. Never add a database status merely to implement a menu label.
7. The main sidebar has at most two navigation levels.
8. Do not build an indefinitely nested third- or fourth-level navigation tree.
9. Drill into concrete projects, manuscripts, interviews, regions, and other research objects within the content area rather than the main sidebar.
10. Never translate user-authored research content as a side effect of changing the UI language.
11. A private local workspace is not a network account.
12. The default remains local-first, with no account and no required cloud service.
13. Claim that data is encrypted only when real data encryption is implemented; hiding or locking the UI alone is not encryption.
14. The China Research Map is a deferred candidate, not part of `v0.2.0`; it may become a first-class module only after its source, redistribution, transformation, approval, and completeness gates pass.
15. Geographic research management stops at county level by default and does not descend to township, subdistrict, or village levels.
16. Never upload map notes, fieldwork material, or other user data to GitHub Pages or a map service.
17. Distribute Sociology PhD Desk web-first: the canonical product is a Web application with optional PWA installation, not a platform-specific installer.
18. Browser use is permanently first-class. Installation must never be required to access the complete research workflow.
19. No-account operation remains a product feature; distribution work must not add registration, login, a cloud workspace, analytics, or default synchronization.
20. Cross-device transfer is backup-based. Encrypted `.sociologydesk` backup and restore is the supported private-workspace path unless a future, separately accepted end-to-end synchronization design exists.
21. Optimize the default interface for clarity, not maximum feature exposure. A capability does not require a permanent navigation entry merely because it exists.
22. Keep primary navigation for research domains and secondary navigation for high-frequency workflows; move tertiary status distinctions into URL-addressable page filters.
23. Prefer progressive disclosure for infrequent form fields and technical diagnostics while keeping historical states and research capabilities reachable within one or two actions.
24. Motion explains spatial and state continuity; it does not decorate, delay research work, or make user content difficult to read.
25. Centralize motion durations and easing, prefer transform and opacity, never add `transition: all`, and always keep important behavior independent of animation completion.
26. Respect `prefers-reduced-motion` for every route, view, overlay, drawer, accordion, workspace, and lock transition.

## Operating constraints

- Ask whether a feature solves a sociology-specific research workflow problem before expanding scope.
- Preserve local-first operation. The core workstation must function without an account, server, cloud sync, analytics, tracker, or AI API.
- Treat Simplified Chinese as the default interface language and maintain a complete English alternative. Every substantial new user-interface feature must ship with both languages in the same change.
- Keep persisted research data, schema enums, identifiers, and import/export values locale-neutral. Never persist translated display labels as domain values.
- Never silently translate, rewrite, or normalize user-authored research content when the interface language changes. Language switching affects application chrome and system messages only.
- Use anonymous fieldwork identifiers and keep the warning against directly identifying participant information visible.
- If the deferred China Research Map is revisited, treat it as a first-class sociology research capability rather than a decorative dashboard map. Its administrative hierarchy must stop at county level; never collect, infer, display, or export exact participant locations.
- Do not ship public China map boundaries or geographic datasets until their authoritative source, permitted use, attribution, version, and update path have been verified and documented. Never substitute an arbitrary or merely convenient map dataset.
- Treat import/export schemas as durable public interfaces. Validate before writes and make replacement explicit.
- Keep source evidence visibly distinct from AI-generated suggestions.
- Demo content must be obviously synthetic. Never invent realistic DOI values, quotations, empirical results, interview material, users, or institutions.
- Do not hard-code a contributor's absolute local path. Machine-specific executable paths belong in ignored local configuration.
- Do not replace the original academic visual language with a generic admin-dashboard template.
- Do not create, publish, push, release, or claim external state unless the task authorizes it and the operation can be verified.

## Quality commands

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Run the commands against the final shared revision. If another agent is working concurrently, recheck changed files and rerun relevant verification after their changes land.

## GitHub Release Notes encoding

- Write any Release Notes containing non-ASCII text to an explicit UTF-8 Markdown file before upload.
- Use `gh release create/edit --notes-file <path>`; do not pass a long multilingual body through `--notes` or an encoding-dependent shell pipeline.
- Before upload, run `node scripts/verify-release-notes.mjs --file <path> --sentinel <expected-phrase>` to require strict UTF-8 decoding, byte round-trip, the expected sentinel, and no run of eight or more question marks.
- After upload, run the same guard in `--remote <owner/repo> <tag>` mode so the GitHub API body—not only the local file or CLI exit code—is verified.
- For metadata repairs, also verify the Release ID, tag object, and dereferenced release commit. Never move or recreate a valid tag merely to repair Release text.

## Session closeout

Before handing off:

- inspect `git diff` and `git status`;
- reconcile documentation with actual behavior;
- record checks that truly ran;
- update the current architecture, completed features, known issues, technical debt, GitHub state, release state, and next objective in `PROJECT_STATE.md`;
- remove completed items and add concrete unresolved work in `NEXT_TASKS.md`;
- add an ADR when the session made a durable architectural decision;
- leave no secrets or real research data in the repository.
