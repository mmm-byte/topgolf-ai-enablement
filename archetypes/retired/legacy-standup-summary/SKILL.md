---
name: legacy-standup-summary
description: RETIRED. Summarise a team standup transcript into action items. Superseded by shift-handover after the 2026-09 usage review. Do not use.
allowed-tools: Read
data-class: internal-personal
connector: ops.readonly
version: 0.3.1
owner: Venue Operations
data-owner: Guest Experience
status: retired
last-reviewed: 2026-09-18
retired-on: 2026-10-05
superseded-by: shift-handover
retirement-reason: >
  Merged into shift-handover after six weeks of usage data showed 71 percent of requests
  were for shift close rather than standup, and that the two archetypes produced
  conflicting output formats for the same incident log. Keeping both meant venue leads
  got two different answers to the same question.
---

# Legacy standup summary (retired)

> **This archetype is retired and must not be used.**
> Superseded by [`shift-handover`](../../shift-handover/SKILL.md) on 2026-10-05.

## Why it was retired

This archetype and `shift-handover` both read the incident log. Office-hours questions
and the usage data showed three problems:

1. **Overlap.** 71% of requests that came to this archetype were shift-close requests,
   which `shift-handover` already handled with a stricter output format.
2. **Conflict.** For the same log, this archetype produced a bulleted action list while
   `shift-handover` produced three lines. Venue leads received two different answers to
   the same question and asked which one was correct.
3. **No second reviewer.** Its format was looser, so a guest name could survive into
   the output without tripping the length check that `shift-handover` applies.

## Evidence

| Measure | Value | Period |
|---|---|---|
| Requests | 212 | 6 weeks to 2026-09-18 |
| Of which shift-close intent | 71% | same |
| Output rewritten by a human | 34% | same |
| Guest-name findings raised | 3 | same |
| Questions in office hours | 22 | same |
| Requests that should have used `shift-handover` | 150 | same |

## What replaces it

`shift-handover` v1.0, released 2026-10-05. The handover format, the strict
three-line bound, and the guest-name prohibition all carried over. The only removed
capability is arbitrary free-text standup transcription, which no team requested once
they understood the incident log was the real input.

## Do not

- Do not resurrect this archetype without a usage review.
- Do not point a new archetype at this directory.
- Do not copy its `SKILL.md` format; it predates the current spec template.
