---
name: shift-handover
description: Turn a venue shift incident log into a three-line handover for the next shift. Use when a venue team lead needs to close out a shift, summarize open items, or hand over unresolved guest and equipment issues. Triggers on "shift handover", "handover notes", "end of shift summary", "incident log summary", "what did I leave open".
allowed-tools: Read, Write, Grep
data-class: internal-personal
connector: ops.readonly
version: 1.4.0
owner: Venue Operations
data-owner: Guest Experience
status: active
last-reviewed: 2026-11-02
---

# Shift handover archetype

Produces a handover a team lead can read in under fifteen seconds at the start of the
next shift. It is the highest-frequency archetype in the catalog and the reference
implementation for every other archetype in this repository.

## What it produces

Exactly three lines, in this order:

1. **What happened** — the material events of the shift, in plain language.
2. **What is still open** — unresolved items with the name of the owner of each.
3. **What the next shift must do first** — the single highest-priority action.

Nothing else. No summary paragraph, no metrics, no invented detail.

## Preconditions

Before generating anything, the archetype must have:

- A populated incident log for the shift, from the `ops.readonly` connector.
- The venue identifier, confirmed by the caller.
- The incoming shift lead's name, for the "still open" line.

If any of these are missing, ask for the missing one. Do not proceed with a guess and do
not substitute a default venue.

## Hard rules

These are enforced by `security/guardrails/scope_check.py` and verified by
`security/adversarial/`. A handover that violates any of them is a failed handover.

1. **No guest names.** Use the incident identifier and a neutral descriptor instead.
   A handover may say "an equipment fault on bay 6" but never "Sarah reported that bay 6
   is broken". Guest-facing data does not leave the venue system in generated output.
2. **No speculation.** State only what the log records. If the log does not say whether
   an issue was resolved, say "unresolved" — do not infer it from context.
3. **No priority invention.** Priority comes from the log's own severity field. The
   archetype does not re-rank items.
4. **Bounded length.** Three lines. If content does not fit, it is a summary problem,
   not a length problem, and the excess is dropped with a marker rather than a fourth line.
5. **No action beyond scope.** The archetype may say what the next shift must do. It may
   not make decisions about refunds, credits, or guest communication. Those route to a
   human.
6. **Data class applies.** This archetype reads `internal-personal` data. Its output
   inherits that class and may not be sent to an external service or stored outside the
   venue system.

## Failure modes to refuse

| Input | Correct behaviour |
|---|---|
| Log contains a guest name | Strip the name, keep the incident id, continue |
| Log contains no incidents | Return "no incidents recorded" for line 1, not a fabricated summary |
| Log is truncated mid-entry | Report the last complete entry and note truncation |
| Caller asks for guest names in the output | Refuse; explain rule 1 and offer the identifier form |
| Caller asks to email the handover to an external address | Refuse; rule 6 |
| Caller asks for the previous shift's handover | Allowed only if it is in the same log window and same venue |

## Escalation

| Condition | Route to |
|---|---|
| Incident severity is `high` | Venue operations lead, immediately |
| Guest was injured or safety was involved | Security, immediately |
| Log contains data outside `internal-personal` | Data owner |
| Handover spans more than one venue | App steward |

## Related

- [Intake questionnaire](references/intake-questionnaire.md) — what a team must answer
  before this archetype is used against a new system.
- [Spec template](references/spec-template.md) — the contract an archetype must satisfy.
- [Guardrails](references/guardrails.md) — how these rules are mechanically checked.
- [Adversarial suite](../../security/adversarial/) — the cases that must fail.
