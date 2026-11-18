# Intake questionnaire

Every archetype is attached to a new system, venue, or team only after this
questionnaire is answered. The questionnaire is the artifact that lets a non-technical
builder start inside the pipeline instead of routing the idea to engineering.

Answers are recorded in the archetype's `spec.md`. An archetype with unanswered intake
questions is `draft` and cannot be used against real data.

---

## 1. The request

**1.1 What is the outcome, in one sentence, written from the user's side?**
_Example: "At the start of my shift I want to know what the last shift left open."_

**1.2 Who is the person this is for?**
Name the role, not a team. "Venue team lead on the Friday evening shift" is usable.
"Operations" is not.

**1.3 How often will they use it?**
Daily / weekly / monthly / one-off. This sets the review cadence later.

**1.4 What do they do today, without this?**
This is the baseline. If the current process takes longer than the tool, the archetype
has no value.

## 2. The data

**2.1 Which data class does the input fall into?**

| Class | Meaning | Examples |
|---|---|---|
| `public` | Published and approved for external use | Venue hours, published offers, public FAQ |
| `internal-aggregated` | Totals and aggregates, no individual | Visits per venue per day, spend by band, campaign funnel totals |
| `internal-personal` | Identifies or relates to a guest or employee | Guest names, booking details, incident narratives |
| `restricted` | Minors, payments, safety records, credentials | Anything involving a minor, card data, incident investigations |

**When in doubt, take the higher class until the data owner confirms otherwise.**

**2.2 Which specific fields are read?**
List them. Field-level, not table-level. "Read the incident log" is not an answer;
"`incident_id`, `category`, `severity`, `resolution_minutes`, `escalated`" is.

**2.3 Who owns that data?**
A named data owner, not a department.

**2.4 Are there fields that must never be read, even though they are available?**
Usually yes. Name them explicitly. This list becomes a scope-check assertion.

## 3. The output

**3.1 What exactly is produced?**
A format, not a topic. "Three lines: what happened, what is still open, what to do
first" is a format. "A handover" is not.

**3.2 Where does the output go?**
Who reads it, in what system, and does it leave company-controlled storage?

**3.3 What must the output never contain?**
Guest names. Unsupported claims. Speculation. This list becomes a guardrail rule.

**3.4 What decisions does a human still make?**
Anything involving safety, money, refunds, credits, or guest communication is a human
decision. Name them.

## 4. The contract

**4.1 Which connector provides the data?**
Must be in the [connector catalog](../../aiplatform/connectors/). If the connector does not
exist, that is a platform request, not an archetype request.

**4.2 What is the runtime constraint?**
Which constrained runtime will host this? (See platform engineering for the current
list.) An archetype that needs a runtime not on that list is blocked.

**4.3 What is the escalation path?**
For each of: a security finding, a data-class finding, a quality finding. Who is paged?

**4.4 What is the release gate?**
Which checks must pass before this ships? Default is the standard set: unit tests,
output schema, secrets scan, scope check, adversarial suite, human review, one week in
staging.

**4.5 Who owns this archetype after launch?**
An app steward. An archetype without a steward does not ship.

## 5. Success

**5.1 How will we know it worked?**
A measure that can move: time to produce a handover, requests routed to engineering per
week, share of output that a human had to rewrite.

**5.2 What would make us retire or merge this?**
Low usage, repeated questions in office hours, or another archetype covering the same
ground. This feeds the [archetype health monitor](../../monitoring/).

---

## Approval

| Role | Name | Date | Decision |
|---|---|---|---|
| Requester | | | |
| App steward | | | |
| Data owner | | | |
| Platform engineering | | | |
| Security (if `internal-personal` or above) | | | |
