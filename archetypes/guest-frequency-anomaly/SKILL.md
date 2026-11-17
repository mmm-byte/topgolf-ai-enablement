---
name: guest-frequency-anomaly
description: Detect guests whose visit frequency has dropped against their own segment baseline and propose a win-back path within the frequency cap. Use when a marketing or engagement team asks who has stopped visiting, why frequency dropped, or what a win-back offer should be. Triggers on "frequency drop", "who has not visited", "win-back list", "lapsed guests", "visit frequency anomaly".
allowed-tools: Read, Grep
data-class: internal-aggregated
connector: analytics.readonly
version: 1.1.0
owner: Guest Engagement
data-owner: Guest Experience
status: active
last-reviewed: 2026-11-05
---

# Guest frequency anomaly archetype

Finds guests whose visit frequency has fallen below their own segment baseline, and
proposes a path back. It is a **read and recommend** archetype: it never contacts
anyone and never changes a member's tier or status.

## What it produces

1. **The anomaly set** — guests whose visit frequency dropped, with the size of the
   drop and the segment baseline used.
2. **The segment baseline** — explicitly stated, so the reviewer can check the
   comparison is fair.
3. **A proposed path** — per segment, a suggested action and the expected effect, with
   the caveat that it is a hypothesis to test, not a forecast.
4. **The cap check** — how many messages each guest in the set has already received
   this week, and whether the proposed path stays inside the cap.

## Preconditions

- A segment definition with at least one full historical period of visit data.
- The frequency cap value, from the sending platform, not from a human's memory.
- A consent check for any guest who may be contacted.

## Hard rules

1. **The cap is a hard limit.** A guest who has already received two messages this
   week is not contacted this week, regardless of how strong the anomaly looks. The
   archetype reports that they are *excluded by cap*, rather than silently dropping
   them.
2. **No safety decisions.** If a guest appears in a safety incident, the archetype
   excludes them from any outreach set and reports the exclusion. It does not decide
   anything about the incident.
3. **The baseline is per segment, not global.** Comparing a Premier member against a
   Classic member is not a fair anomaly signal. The baseline used is always stated.
4. **No individual outreach content.** The archetype produces a segment-level proposal.
   It does not write a message to a specific guest.
5. **No promises.** It does not forecast revenue, predict a conversion, or state that a
   win-back "will" work. It states the size of the change and proposes an action to
   test.
6. **Non-consented and minor guests are excluded** and counted separately, so the
   reviewer can see how many were excluded rather than assuming zero.

## Output structure

```markdown
# Frequency anomaly report

**Segment:** <segment>
**Baseline period:** <dates>
**Comparison period:** <dates>
**Baseline:** <visits per member per month for this segment>

## Anomaly set
| Guest group | Guests | Baseline | Current | Change |
|---|---|---|---|---|
| <grouping> | <n> | <x> | <y> | <z> |

## Exclusions
- Excluded by frequency cap: <n>
- Excluded, no marketing consent: <n>
- Excluded, safety-related: <n>

## Proposed path
| Segment | Proposed action | Expected effect | Caveat |
|---|---|---|---|---|
| <segment> | <action> | <hypothesis> | <what would falsify it> |
```

## Failure modes to refuse

| Input | Correct behaviour |
|---|---|
| Request to contact a guest already at the cap | Refuse; report the exclusion |
| Request to raise the cap | Refuse; the cap is a system setting, escalate to the app steward |
| Request to include minors | Exclude and count |
| Request to include non-consented guests | Exclude and count |
| Request to auto-send win-back offers | Refuse; a human approves and sends |
| Request to predict revenue from the anomaly set | Refuse; report the change, not a forecast |
| Insufficient history for a fair baseline | Say the baseline is not defensible and widen it |

## Escalation

| Condition | Route to |
|---|---|
| Cap change requested | App steward |
| Guest appears in a safety incident | Security |
| Consent data looks wrong at scale | Data owner |
| Anomaly set is unexpectedly large | Marketing operations lead |

## Related

- [Intake questionnaire](../../references/intake-questionnaire.md)
- [Spec template](../../references/spec-template.md)
- [Guardrails](../../references/guardrails.md)
