# Product and Interface Design

This document defines the durable design direction for Sociology PhD Desk. It is a product contract, not a claim that every detail is already implemented.

## Design thesis

The application should feel like a well-organized research desk: academic, calm, professional, information-dense, and readable. It should not resemble a generic admin panel, startup analytics dashboard, or decorative student project.

The visual hierarchy must make the research object and its next meaningful action obvious without stripping away context.

## Audience and context

- Primary: sociology doctoral researchers using desktop and laptop computers for sustained reading, fieldwork planning, analysis, writing, submission, and revision.
- Secondary: adjacent empirical researchers, without diluting the sociology identity.
- Typical use: long sessions, many linked objects, sensitive metadata, mixed qualitative and quantitative methods, and recurring deadlines.

Desktop is the primary composition. Narrow layouts must remain usable, but mobile parity must not force an oversimplified desktop experience.

## Visual language

- Use a restrained, original, editorial visual system: paper-like surfaces, quiet neutrals, deliberate rules, and one scholarly accent family.
- Prefer subtle depth and clear grouping over floating cards everywhere.
- Let typography, alignment, spacing, and rules establish hierarchy before color.
- Use icons sparingly and consistently. Do not use emoji as navigation or status language.
- Avoid the visual clichés of low-cost Bootstrap dashboards: saturated sidebar blocks, excessive pills, identical statistic cards, and decorative charts without research meaning.
- Provide light and dark themes that preserve semantic contrast, not merely inverted colors.

## Information hierarchy

Each primary page should answer, in order:

1. Where am I in the research lifecycle?
2. Which project or research object is in scope?
3. What changed, what needs attention, and what is the next action?
4. What evidence, source, or related object supports this state?

Dense tables and registries are appropriate when they support comparison. They need readable columns, clear row focus, useful empty states, and a narrow-layout fallback.

## Navigation

The stable top-level vocabulary is:

- Today
- Projects
- Literature
- Fieldwork
- Quantitative
- Evidence
- Research Log
- Manuscripts
- Submissions

Settings, import/export, theme, and demo controls are utilities, not competing research modules.

## Research status and semantics

- Status colors must always be paired with text; color alone cannot convey state.
- Evidence support levels—Strong, Moderate, Weak, Contradictory, Unclear—describe a researcher's assessment, not a machine-certified truth score.
- Destructive and replacement actions require explicit labels, consequences, and confirmation.
- Demo content must be visually and semantically marked `DEMO`.
- AI-generated suggestions, if introduced, require a distinct label and surface from source evidence.

## Privacy in the interface

Fieldwork and interview forms must show: **Do not store directly identifying participant information here.**

Prefer labels such as participant alias, `participant_id`, `case_id`, and `interview_id`. Avoid interface prompts that invite names, phone numbers, government identifiers, exact addresses, signatures, or complete consent documents.

Export and import surfaces must warn that a JSON file can contain sensitive research metadata. Never imply that browser-local means encrypted or backed up.

## Interaction principles

- Preserve context after save; do not unexpectedly navigate away from the research object.
- Use validation messages that explain how to recover.
- Never silently discard, merge over, or replace user records.
- Make keyboard focus visible and keep ordinary tasks usable without a pointing device.
- Prefer direct labels over hidden icon-only actions.
- Use progressive disclosure for advanced metadata; do not flatten every field into the first view.

## Content voice

Use precise, calm, non-promotional language. Prefer “record an analysis run” to “unlock insights.” Distinguish facts, plans, suggestions, and unknowns. Do not claim scientific validity, security, adoption, or automation beyond what the software can demonstrate.

English is the primary repository language; the complete Chinese README must remain substantively aligned. Interface localization is a future design decision, not implied by bilingual documentation alone.

## Accessibility baseline

- Meet WCAG 2.2 AA contrast targets where practical.
- Preserve visible focus and logical tab order.
- Associate every form control with an accessible label and error description.
- Use semantic headings, landmarks, tables, and buttons.
- Respect reduced-motion preferences.
- Test zoom, long labels, and narrow layouts without clipped actions.

## Design review checklist

- Does the screen foreground a sociology research object or transition?
- Is the next research action clear?
- Can a user trace the relevant project, source, or evidence?
- Are privacy and destructive consequences visible at the decision point?
- Does the screen remain readable when the data is dense?
- Is the visual treatment original and coherent with the rest of the product?
- Does it work in both themes, at narrow width, with keyboard navigation, and with demo labels visible?
