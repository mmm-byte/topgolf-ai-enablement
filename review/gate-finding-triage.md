# Gate finding triage and escalation

How a finding becomes an action with an owner and a clock. A finding without a route
is a note in a log, and notes in logs do not prevent the next incident.

## The route

Every finding routes to exactly one of four destinations. The destination depends on
**what kind of thing is wrong**, not on who is available.

| Finding type | Route to | Response time |
|---|---|---|
| Security, data exposure, guest safety, or an automated safety decision | **Security** | Immediate, page |
| Data class wrong, consent missing, minor targeted, source data unclear | **Data owner** | Same business day |
| Scope, correctness, contract breach, or gate failure inside an archetype | **App steward** | Next working day |
| Ambiguous, or spans more than one destination | **AI Enablement** (triage and route) | Same business day |

If a finding could reasonably go to two places, it goes to AI Enablement first. Routing
to the wrong owner costs a day; AI Enablement exists to prevent that.

## Severity

| Severity | Definition | Examples |
|---|---|---|
| **S1** | Guest safety, data exposure, or a decision made without a human | Guest name in output sent externally; a safety incident marked resolved by an archetype; a minor included in a campaign audience; a credential embedded in a scaffold |
| **S2** | Wrong in a way that affects a business decision | A metric in a briefing that does not reconcile; an uncited claim in a campaign brief; a handover missing an open item; an archetype reading outside its declared scope at `internal-aggregated` class |
| **S3** | Wrong but caught before use, or quality degrades | The output is the right shape but the wrong length; a spec section left vague; an archetype prompt grown past its baseline |
| **S4** | Cosmetic, documentation, or experience | Wording, ordering, formatting |

### The severity that is not about impact

An S1 is a *release blocker* even if the output was never sent, because the capability
exists and will be used. "It did not reach a guest" reduces the impact of a single
incident, not the severity of the finding that let it through.

The exception is a finding that is demonstrably unreachable. If the path cannot be
executed, it is a S3 with a note explaining why it is unreachable, and the note is
checked.

## The triage decision

```
Finding raised
    |
    +-- Does it involve guest safety, personal data exposure, or an automated
    |   safety decision?
    |       YES --> S1 --> Security, immediate
    |       NO  --> continue
    |
    +-- Does it involve data class, consent, age band, or source ownership?
    |       YES --> S1 or S2 --> Data owner, same business day
    |       NO  --> continue
    |
    +-- Is it inside an archetype's scope, contract, or gate?
    |       YES --> S2 or S3 --> App steward, next working day
    |       NO  --> continue
    |
    +-- Is it ambiguous or does it span destinations?
            YES --> AI Enablement, same business day
```

## What the route includes

A routed finding carries this, every time. A finding without these is a complaint.

```markdown
- **Finding:** <what is wrong, stated as an observation>
- **Severity:** <S1-S4>
- **Artefact:** <archetype, version, file and line where relevant>
- **Observed:** <what happened, with the exact output or command>
- **Expected:** <what the rule or spec requires>
- **Impact if not fixed:** <who is affected and how>
- **Route:** <destination>
- **Owner:** <named role>
- **Response due:** <time>
```

## Recurring findings

A finding that recurs is not an incident. It is a gap in the archetype, the connector,
or the gate. Recurring findings are triaged into one of three actions:

| Recurrence | Action |
|---|---|
| The same rule is broken twice | Tighten the guardrail, not the archetype |
| The same question reaches office hours three times | Add it to the archetype's reference docs, or extend the archetype |
| The same finding appears across archetypes | Raise a platform issue against the gate or connector |

This is the mechanism that makes the catalog evolve on evidence rather than on
preference. The usage and escalation patterns are the input; the catalog change is the
output.

## Escalation when a route does not respond

| Elapsed | Action |
|---|---|
| Response window missed | AI Enablement chases the named owner directly |
| Two response windows missed | Raise to the owner's manager, copy the app steward |
| Three response windows missed, or an S1 | Platform engineering, as a pipeline gap, not a team gap |

An S1 that is not routed to Security within the response window is itself an S1
finding against the pipeline. The route failing is a failure of the control.
