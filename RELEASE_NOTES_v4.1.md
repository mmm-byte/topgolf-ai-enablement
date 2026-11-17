# FIELDIQ 4.1 — Product experience update

## What changed

- Added **Operations Playbook**, a guided team-huddle workspace for service queue, parts fulfillment, and fleet deployment workflows.
- Each playbook surfaces record-level evidence from the currently selected branch scope.
- Added practical questions to bring to a service, parts, or fleet discussion.
- Added a checkable team-action list with visible completion progress.
- Added a copyable huddle brief with scope, evidence, suggested checks, and data limitations.
- Added direct navigation from the overview and reviewer tour to the playbook.
- Kept the existing Decision Studio, Operations Explorer, metric catalog, quality checks, lineage, analyst prototype, and engineering documentation.
- Updated the visible product version and project documentation to 4.1.

## Design principles

- Evidence is descriptive, not causal. A low parts fill rate is not presented as proof that a service work order was delayed by parts.
- Playbook questions prompt validation with operational teams; they do not issue automated work instructions.
- Fleet utilization retains the modeled available-asset-day assumption and does not claim to model maintenance downtime or true availability.
- All data remains synthetic and is not HOLT operational data.

## Verification performed

- Python pipeline regenerated successfully: 480 work orders, 90 assets, 250 rental contracts, and 320 parts orders.
- Pipeline quality checks: 10/10 passed.
- Python tests: 6/6 passed.
- TypeScript/TSX parser: no syntax diagnostics.
- TypeScript semantic check using temporary ambient stubs: passed.
- Full Next.js production build: not verified because npm dependency installation timed out in this environment.
