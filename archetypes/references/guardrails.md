# Guardrails: how archetype rules become executable checks

A rule in a `SKILL.md` that nobody can check is a wish. This document defines how each
class of rule is turned into a mechanical assertion, and states honestly which rules
remain human-only.

The implementations live in `security/guardrails/`:

| File | What it does |
|---|---|
| `scope_check.py` | Compares declared readable fields against fields actually touched |
| `output_check.py` | Validates output structure, length bound, and prohibited content |
| `secrets_scan.py` | Scans repository and generated artifacts for credential patterns |

## Rule classes

### Class 1 — Scope rules → `scope_check.py`

**Rule shape:** "This archetype reads only fields X, Y, Z."

**How it is checked:** the archetype declares an allowlist of readable fields in its
frontmatter (`allowed-fields`). The scope check reads the connector manifest for the
declared connector and compares it against the archetype's allowlist. Any field the
connector can expose but the archetype does not declare is a **scope leak**.

Scope is checked in both directions:

- **Allowlist direction** — the archetype declared a field it cannot actually read.
  Fails as `declared-but-unavailable`. Usually a typo, but it means the spec is wrong.
- **Denylist direction** — the connector exposes a field marked `never_read` and the
  archetype's declared read set touches it. Fails as `scope-violation`. This is the one
  that blocks release.

**Severity:** S1 when the field is `internal-personal` or above. S2 otherwise.

### Class 2 — Output rules → `output_check.py`

**Rule shape:** "The output is exactly three lines and contains no guest names."

**How it is checked:** the output is validated against a declared schema:

```yaml
output:
  type: lines
  count: 3
  max_words_per_line: 40
  prohibited_patterns:
    - guest_name           # name-shaped token against the guest name list
    - email_address
    - phone_number
    - credit_card
    - external_url
  requires: [line1, line2, line3]
```

Prohibited patterns run against the source data's own identifier list, not a generic
regex alone. A guest name is detected because it is *in the guest dimension*, not
because it looks like a name.

**Severity:** S1 for `guest_name` in an `internal-personal` archetype. S2 otherwise.

### Class 3 — Policy rules → `policy_check.py`

**Rule shape:** "No guest in the 13-17 band is ever a marketing target."

**How it is checked:** the rule is expressed as a query over the data class rather than
over the text. The check runs against the Gold tables and fails if the *output set*
would include a record the policy forbids — regardless of whether the model mentioned
it.

This is the class that matters most, because a policy violation is often invisible in
the output text. The output says "12 guests matched" and the problem is that two of
them were minors.

**Severity:** S1. Always.

### Class 4 — Structure rules → `output_check.py`

**Rule shape:** "Every answer cites a source, or is withheld."

**How it is checked:** each claim in the output must carry a resolvable reference into
the source record. Uncited claims fail. Claims citing a record outside the archetype's
declared read set fail as scope violations.

### Class 5 — Rules that stay human

Some rules cannot be mechanicalised honestly. These are marked in the spec as
`human-review` and are the reason the pipeline has a human stage at all.

| Rule | Why it stays human |
|---|---|
| "The handover is useful to a team lead" | Judgment about operational usefulness |
| "The tone is appropriate for a guest reply" | Judgment about voice and empathy |
| "This campaign brief would be approved by legal" | Legal judgment, not a pattern |
| "The spec covers what the business actually meant" | Requires knowing the business |
| "The priority ordering matches operational reality" | Requires operational context |

**The honest position:** a green automated gate means the output is *structurally safe*.
It does not mean the output is *right*. The human reviewer exists because the second
claim cannot be automated without pretending the first one covers it.

## What the release gate actually proves

| Gate | Proves | Does not prove |
|---|---|---|
| Unit tests | The code does what it says | That it is the right code |
| Output schema | The shape is correct | That the content is accurate |
| Secrets scan | No credential in the repo | That no credential leaked at runtime |
| Scope check | Only declared fields were read | That the declared fields were appropriate |
| Adversarial suite | Known attack classes are refused | That no attack exists |
| Policy check | The output set respects policy | That the policy is correct |
| Human review | A person approved it | That the person was right |
| Staging week | It behaves under real volume | That it stays healthy |

A reviewer should read that table the same way a risk owner reads it. Each gate closes a
specific class of failure and leaves the rest open. The pipeline is honest because it
does not pretend otherwise.
