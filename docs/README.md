# Documentation

This directory contains durable product, architecture, workflow, release, and project-integrity documentation.

Current status boundary: public `main`/Pages are verified through `ca4429f` and contain no Theory implementation or map feature. Theory/v4 documentation describes the current local unmerged candidate. Its latest exact-tree audit recorded P0 = 0 / P1 = 0, but final full-suite, build, browser, PR/CI, merge, and Pages gates remain pending. See [`../PROJECT_STATE.md`](../PROJECT_STATE.md).

## Architecture

- [Architecture overview](architecture/overview.md)
- [Data model](architecture/data-model.md)
- [Data portability](data-portability.md)
- Privacy and encryption model: [简体中文](zh-CN/privacy-model.md) / [English](en/privacy-model.md)
- China Research Map source and compliance gate: [简体中文](zh-CN/map-data-sources.md) / [English](en/map-data-sources.md)
- Durable architecture decisions: [`../DECISIONS.md`](../DECISIONS.md)

## Product and research workflows

- [Product principles](product/product-principles.md)
- [Core research workflow](research-workflows/core-workflow.md)
- [Research ethics and privacy](research-workflows/research-ethics.md)
- Visual and interaction direction: [`../DESIGN.md`](../DESIGN.md)

## Maintenance and release

- [Release checklist](release-checklist.md)
- [Screenshot register](screenshots/README.md)
- [Open-source evidence register](codex-for-oss.md)
- Current state: [`../PROJECT_STATE.md`](../PROJECT_STATE.md)
- Prioritized work: [`../NEXT_TASKS.md`](../NEXT_TASKS.md)

Documentation must distinguish verified current behavior from decisions, targets, and future plans. Update links and state files when structure or behavior changes.
