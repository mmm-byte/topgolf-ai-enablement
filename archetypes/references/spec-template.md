# Archetype spec template

Every archetype carries a `spec.md` in this shape. It is the contract between the
person who built the archetype, the reviewer who gates it, and the platform engineer
who has to host it.

A spec that does not answer every required section is `draft`. It cannot be reviewed.

---

```markdown
# Spec: <archetype name>

## 1. Outcome
<One sentence, written from the user's side. Not a topic.>

## 2. User
- **Role:** <specific job role>
- **Frequency:** <daily | weekly | monthly | one-off>
- **Current process:** <what they do today, and roughly how long it takes>
- **Without this archetype they:** <would email, would ask, would not bother>

## 3. Inputs
| Source | Connector | Fields read | Data class | Must never read |
|---|---|---|---|---|
| <system> | <connector id> | <field, field, field> | <class> | <field> |

**Preconditions:** <what must be present before the archetype runs>
**Missing precondition behaviour:** <ask, refuse, or degrade — never guess>

## 4. Output contract
**Format:** <exact structure the output must take>
**Length:** <bound>
**Must never contain:** <list>
**Human decisions retained:** <list>

## 5. Rules
<Numbered, testable rules. Each rule maps to at least one adversarial case and,
where possible, one guardrail assertion.>

## 6. Failure handling
| Condition | Behaviour |
|---|---|
| <condition> | <refuse / degrade / escalate> |

## 7. Escalation
| Finding type | Severity | Route to | Response time |
|---|---|---|---|
| <security / data class / quality / scope> | <s1-s4> | <role> | <time> |

## 8. Release gate
- [ ] Unit tests pass
- [ ] Output schema validation passes
- [ ] Secrets scan clean
- [ ] Scope check: reads only the declared fields
- [ ] Adversarial suite passes
- [ ] Human review complete
- [ ] One week in staging with logged output
- [ ] App steward assigned
- [ ] Review date set

## 9. Success measures
| Measure | Baseline | Target | How measured |
|---|---|---|---|
| <metric> | <value> | <value> | <source> |

## 10. Retirement criteria
<What usage or escalation pattern means this archetype should be extended, merged into
another, or retired.>

## 11. Sign-off
| Role | Name | Date |
|---|---|---|
| Author | | |
| Reviewer | | |
| App steward | | |
| Data owner | | |
| Security (internal-personal and above) | | |
```

---

## Severity scale

Used in the escalation table and shared with the [triage rules](../../review/gate-finding-triage.md).

| Severity | Meaning | Example |
|---|---|---|
| **S1** | Guest safety, data exposure, or a decision made without a human | Guest injury caused by automated advice; personal data sent externally |
| **S2** | Output is wrong in a way that affects a business decision, but no safety impact | Wrong metric in a briefing; a claim in a campaign brief with no source |
| **S3** | Output is wrong but caught before use, or degrades quality | Handover line missing an open item; a spec section left vague |
| **S4** | Cosmetic, documentation, or experience issue | Wording, formatting, ordering |

**S1 and S2 block release.** S3 is fixed before the next release. S4 goes into the backlog.

## Rules that make a spec reviewable

1. Every rule in section 5 is falsifiable. "Be helpful" is not a rule. "Line 1 contains
   no more than 40 words" is.
2. Every rule maps to a case in `security/adversarial/cases.json`.
3. Every input field in section 3 appears in the scope-check allowlist.
4. Every field in the "must never read" column appears in the scope-check denylist.
5. Section 9 has a baseline, not a target alone. You cannot improve on nothing.
