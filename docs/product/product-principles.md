# Product Principles

## Positioning

Sociology PhD Desk is a local-first ResearchOps workstation built specifically for sociology doctoral researchers. It is not a general todo app, knowledge manager, or generic “PhD productivity” product.

Its contribution is to connect dispersed research objects and decisions into a continuous, traceable workflow.

## 1. Sociology remains the product identity

Primary users include quantitative, qualitative, mixed-methods, and theoretical sociology researchers. Population, labour, family, organizational, youth, and other empirical sociology domains should be legible in the model. Adjacent disciplines may benefit, but feature choices must not genericize the product.

The prioritization question is: **does this solve a distinctive sociology research-workflow problem?**

## 2. Research objects before generic notes and tasks

Model projects, questions, propositions, literature, claims, evidence, datasets, variables, models, analysis runs, interviews, field visits, codes, memos, manuscripts, journals, submissions, reviewer comments, and revision tasks. Notes and tasks are useful only when they connect to this research lifecycle.

## 3. Provenance before polish

A manuscript claim should eventually be traceable backward to literature, fieldnotes, interviews, policy documents, or model output and forward to its manuscript location. A polished summary without a source locator and limitations is weaker than an unfinished but auditable record.

## 4. Orchestrate specialist tools

Zotero manages references. Stata, R, and Python run analysis. NVivo and MAXQDA support qualitative work. Word, Markdown, and Quarto support writing. Sociology PhD Desk should connect the objects and decisions these tools produce, not reproduce every specialist capability.

## 5. Local-first by default

The core works without accounts, servers, default cloud sync, trackers, analytics, or AI APIs. Any networked feature must state what leaves the device and require an appropriate user action.

## 6. Ethics and privacy at the data-model boundary

Do not merely hide risky fields in documentation. Avoid soliciting direct participant identifiers in the schema and interface. Use aliases and anonymous IDs; keep re-identification keys and protected source materials in approved external systems.

## 7. Reproducibility means process metadata

The product should record the dataset, sample, script, software, model, outcome, predictor, output, robustness checks, timestamp, and code version. It should not claim to replace statistical software or certify an analysis as correct.

## 8. Qualitative traceability without surveillance

Support the path from interview and field visit to code, memo, claim, and manuscript while minimizing identifying context. More captured detail is not automatically better; ethical minimization is a product feature.

## 9. Data movement must be reversible and explicit

Validate imports before writing. Default to non-destructive merge and visible conflict handling. Whole-workspace replacement requires a separate explicit choice. Portable exports need format versions and clear sensitivity warnings.

## 10. AI suggestions are not evidence

AI may later assist triage, decomposition, explanation, and maintenance, but it remains optional. Generated content must be labeled, reviewable, and distinct from source evidence.

Theory prompts follow the same boundary even when no AI is involved: a structured question may guide reflection in the interface, but it must never auto-populate or rewrite the researcher's memo content. Conceptual claims remain authored research judgments.

## 11. Demonstrate truthfully

Demo data must be obviously synthetic. Product metrics, users, adoption, issues, tests, and releases must be verifiable. The project should earn an open-source history rather than manufacture one.

## 12. Maintainability is a feature

Modular code, tests, migrations, ADRs, state records, prioritized tasks, release notes, issue triage, and clear contribution paths allow the project to outlive a single development session.
