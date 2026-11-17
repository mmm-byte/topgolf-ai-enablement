# AI-output review rubric

The rubric a reviewer uses when AI has produced code, a spec, or a gate result and
someone has to decide whether it ships. This is the backstop function: the automated
gates catch the repeatable failures, and this rubric is for the ones they cannot.

Read it as the answer to one question: **what did the automated gates miss?**

---

## The reviewer's posture

The reviewer is not looking for evidence that the output is good. They are looking for
the specific classes of defect that a machine cannot see, and they are deliberately
sceptical of anything the model asserted about itself.

Three habits that matter more than the checklist:

1. **Check the claim, not the artefact.** When the output says "all tests pass", open
   the test output. When the output says "no personal data present", search the output
   for a guest identifier rather than trusting the statement.
2. **Try the input that breaks it.** A reviewer who has not tried to break the output
   has not reviewed it.
3. **Write down what you found.** The reviewer's findings are the input to the next
   version of the archetype. A finding that is not recorded will be found again.

---

## Section 1 — Code produced by an agent

### 1.1 Correctness

| Check | The failure it catches |
|---|---|
| Does the code do what the spec says, and only that? | Scope creep in the implementation |
| Are the edge cases in the spec actually handled? | Happy-path-only implementations |
| Does the error path behave as the spec requires? | Swallowed exceptions, silent wrong answers |
| Would this code produce the same result for the same input twice? | Nondeterminism from an unordered source |
| Are the assertions in the test meaningful, or do they restate the implementation? | Tests that pass while the behaviour is wrong |

### 1.2 Security

| Check | The failure it catches |
|---|---|
| Does it read anything outside the declared read set? | Scope escape that the hook did not catch |
| Does it write anywhere unexpected? | Side effects on systems the archetype does not own |
| Does it handle untrusted input as untrusted? | Injection through a field the model treated as safe |
| Are secrets read from the environment, never from source? | Credentials committed to a repo |
| Does the error message leak internal detail to an end user? | Disclosure through a stack trace |
| Is the authorisation check on the *resource*, not just the *session*? | Broken access control |

### 1.3 Fit with the platform

| Check | The failure it catches |
|---|---|
| Does it fit the constrained runtime? | Code that needs a capability the runtime lacks |
| Does it use a connector in the catalog? | Unapproved data access |
| Does it follow the archetype's output contract exactly? | Output that downstream consumers cannot parse |
| Would it survive the release gate's own checks? | Code that fails a gate it was never run against |

### 1.4 Maintainability

| Check | The failure it catches |
|---|---|
| Will someone else understand this in six months? | Code written for the model's convenience |
| Is the complexity earning its place? | Over-engineering, or a framework used reflexively |
| Is the test suite going to catch a real regression? | Tests that assert the implementation rather than the behaviour |

---

## Section 2 — Specs produced by an agent

A spec is where errors are most expensive, because everything downstream inherits them.

| Check | The failure it catches |
|---|---|
| Does the outcome match what the requester actually asked for? | Solving an adjacent problem |
| Is every required intake question answered? | Missing data-class or owner decisions |
| Is every rule falsifiable? | "Be helpful", "handle errors appropriately" |
| Does each rule map to a test case? | Rules that cannot fail |
| Is the data class right, and stated? | Under-classified personal data |
| Are the human decisions named? | A spec that leaves a safety decision to the model |
| Is the success measure real, with a baseline? | "Improved efficiency" as a success criterion |
| Are the retirement criteria written? | An archetype that lives forever because nobody said otherwise |

---

## Section 3 — Gate results

A gate result is evidence, not truth. The reviewer's job is to check that the gate
checked what it claims.

| Check | The failure it catches |
|---|---|
| Did the gate run against the artefact that is shipping? | Green result on an earlier version |
| Was the gate's scope check actually enabled? | A scope check that silently did nothing |
| Were the adversarial cases actually executed, or skipped? | A green suite that ran zero cases |
| Did any check warn rather than fail? | Warnings nobody read |
| Were the skipped cases justified and recorded? | Silent gaps in coverage |

---

## Section 4 — The questions that find the most

These four questions, asked every time, catch more real defects than the full
checklist above:

1. **What did this output leave out?** Model output is usually complete in form and
   incomplete in content. Ask what a careful colleague would have included.
2. **What would make this wrong?** Construct the input that breaks it, then run it.
3. **Who is harmed if this is wrong, and how badly?** This sets the severity. It is the
   most important question in the review, and the one most often skipped.
4. **Would I trust this with something I care about?** If the answer is no, the review
   is not finished.

---

## Section 5 — Recording the review

Every review produces a record. The review record is what the archetype catalogue
learns from, and it is what makes "the archetype catalog evolves based on evidence"
true rather than aspirational.

```markdown
# Review record: <artefact> — <archetype>

- **Reviewer:** <name>
- **Date:** <date>
- **Artefact version:** <version>
- **Gate result:** <pass/fail, with the run id>

## Findings
| # | Severity | Location | What is wrong | Why it matters |
|---|---|---|---|---|
| 1 | S2 | <file:line> | <defect> | <impact> |

## What the gates missed
<The finding that makes this review worth doing. If nothing, say so explicitly.>

## Changes required before release
- [ ] <change>

## Disposition
<ship | ship with changes | do not ship>
```

### Severity and disposition

| Severity | Meaning | Disposition |
|---|---|---|
| **S1** | Guest safety, data exposure, or a decision made without a human | Do not ship |
| **S2** | Output is wrong in a way that affects a business decision | Ship only after the fix |
| **S3** | Output is wrong but caught before use, or quality degrades | Fix before the next release |
| **S4** | Cosmetic or documentation | Backlog |

**A review with zero findings is a valid outcome**, but it is a finding about the
review, not about the artefact. The reviewer should record what they tried. "I could
not find a defect after attempting X, Y and Z" is a useful record. "Looks good" is not.
