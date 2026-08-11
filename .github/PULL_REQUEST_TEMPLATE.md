## Problem

Which sociology research workflow, defect, documentation gap, or maintenance need does this address?

## Change

Summarize the implementation and its user-visible behavior.

## Data and migration impact

Describe IndexedDB schema, import/export, ID, relationship, deletion, or replacement effects. Write “None” only after checking.

## Research ethics and privacy

- [ ] No secrets, credentials, direct participant identifiers, real transcripts/fieldnotes, restricted data, or confidential research material are included.
- [ ] Demo and test records are clearly synthetic.
- [ ] Network or AI behavior, if changed, is disclosed and remains optional for the core workflow.

## Verification

Record exact commands and results for the final revision:

- [ ] `npm ci`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Manual workflow review, if applicable

Do not check a command that did not actually pass. Paste concise failure details when blocked.

## Visual evidence

For UI changes, add sanitized screenshots from synthetic data in light/dark and relevant viewport states. Otherwise write “Not applicable.”

## Documentation and handoff

- [ ] User documentation matches the behavior.
- [ ] `DECISIONS.md` is updated for a durable architecture choice, or not applicable.
- [ ] `PROJECT_STATE.md` and `NEXT_TASKS.md` reflect the verified post-change state.

## Bilingual and data boundary

- [ ] New or changed user-facing behavior is complete in both `zh-CN` and `en`.
- [ ] Persisted enums, identifiers, research records, and portable JSON remain locale-neutral.
- [ ] User-authored research content is unchanged by language switching.
- [ ] Fresh Chinese, English switching, reload persistence, and relevant mobile states were manually checked, or the omission is explained.

## Linked issue

Closes #
