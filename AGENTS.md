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

## Operating constraints

- Ask whether a feature solves a sociology-specific research workflow problem before expanding scope.
- Preserve local-first operation. The core workstation must function without an account, server, cloud sync, analytics, tracker, or AI API.
- Use anonymous fieldwork identifiers and keep the warning against directly identifying participant information visible.
- Treat import/export schemas as durable public interfaces. Validate before writes and make replacement explicit.
- Keep source evidence visibly distinct from AI-generated suggestions.
- Demo content must be obviously synthetic. Never invent realistic DOI values, quotations, empirical results, interview material, users, or institutions.
- Do not hard-code a contributor's absolute local path. Machine-specific executable paths belong in ignored local configuration.
- Do not replace the original academic visual language with a generic admin-dashboard template.
- Do not create, publish, push, release, or claim external state unless the task authorizes it and the operation can be verified.

## Quality commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Run the commands against the final shared revision. If another agent is working concurrently, recheck changed files and rerun relevant verification after their changes land.

## Session closeout

Before handing off:

- inspect `git diff` and `git status`;
- reconcile documentation with actual behavior;
- record checks that truly ran;
- update the current architecture, completed features, known issues, technical debt, GitHub state, release state, and next objective in `PROJECT_STATE.md`;
- remove completed items and add concrete unresolved work in `NEXT_TASKS.md`;
- add an ADR when the session made a durable architectural decision;
- leave no secrets or real research data in the repository.
