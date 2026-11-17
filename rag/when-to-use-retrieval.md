# When to use retrieval, and when not to

This document exists because retrieval-augmented generation is the default answer for
"make the model know our documents", and it is frequently the wrong answer. A
governed platform needs a rule for picking the tool, not a preference for the newest
one.

The rule: **retrieval is for finding text. A query is for finding rows. A script is for
finding a known computation.** If you cannot say which of the three you need, do not
build the pipeline yet.

## The decision

```
What does the question need?
    |
    +-- A specific number, count, sum, average, rate, or date range
    |   over structured records?
    |       YES --> Query the governed metric layer. No retrieval.
    |       NO  --> continue
    |
    +-- A known computation with a known formula over known fields?
    |       YES --> Run the metric. No retrieval.
    |       NO  --> continue
    |
    +-- Text that is not in a table: policy wording, a published FAQ answer,
    |   a long document, a spec, a guide?
    |       YES --> Retrieval, scoped to a documented corpus.
    |       NO  --> continue
    |
    +-- A question that depends on the user's own recent work: "what did I
    |   ask last week", "summarise my drafts"?
    |       YES --> Search the user's own records, with their data class applied.
    |       NO  --> continue
    |
    +-- Does the answer need to be current to the second?
            YES --> A live query, not retrieval. Retrieval returns stale text.
            NO  --> Stop. You do not need retrieval either.
```

## The three failure modes of using retrieval anyway

### 1. Retrieval over numbers

Retrieving a chunk of a CSV and asking the model to sum it is worse than a query, for
reasons that are not subtle:

- The chunk boundary decides which rows the model sees.
- The model may sum a subset and present it as the total.
- The result is not reproducible. The same question twice can give two answers.
- The answer cannot be traced to a grain and a filter.

**A metric that will be quoted in a decision has to reconcile.** In this repository that
is enforced: the pipeline runs a revenue reconciliation check between Silver and Gold
and the portal only renders figures from the snapshot that passed it. Retrieval has no
equivalent, which is why the analyst in the portal maps a question to a documented
metric and computes it, rather than retrieving and letting the model add.

### 2. Retrieval over documents that are already structured

If the policy is in a table with a `data_class` column, retrieving it as free text
throws away the field you needed. The connector catalog in this repository is exactly
this case: a YAML file with structured `never_exposes` lists. The MCP server reads it
as structure and enforces the lists. If it had been retrieved as text and re-summarised
by a model, the `never_exposes` enforcement would become advisory.

**Rule:** if the enforcement depends on reading the data correctly, the data must be
parsed, not retrieved.

### 3. Retrieval where the corpus is not trustworthy

Retrieval over documents that have not been reviewed propagates whatever is in them,
including instructions aimed at the model. Documents that can contain prompt injection
must be sanitised and scoped, or not used as a retrieval corpus at all. That is why
this repository's archetypes read from governed connectors with explicit field
allowlists, and why the adversarial suite includes an injection-in-source-data case.

## Where retrieval is genuinely the right tool

| Situation | Why retrieval wins |
|---|---|
| A guest asks a question answered by a published FAQ paragraph | The answer is prose. It must be quoted, cited, and bounded by the paragraph it came from. |
| A team member asks "what does the escalation policy say about minors" | The policy is prose with edge cases. A precise match is worse than a relevant passage. |
| A builder asks "which archetype covers hosting a tournament" | The catalogue is descriptive and the answer may span several entries. |
| Drafting a reply from an approved response library | The library entries are the constraint. Retrieval finds the entry; the model does the drafting. |

The pattern: **retrieval when the answer is prose and must be sourced; query when the
answer is a number and must reconcile; script when the answer is a computation and must
be reproducible.**

## The three conditions a retrieval use must satisfy

Before a retrieval path is added to the pipeline, all three must hold. If any fails,
the simpler tool wins.

1. **The corpus is bounded and owned.** A named set of documents with a named owner who
   can approve changes to them. If nobody owns the corpus, nobody can fix a bad
   document, and retrieval will surface it.
2. **Every answer cites its source.** Not "the model says", but the specific passage,
   with the ability to withhold the answer when no passage supports it. A guest-facing
   answer without a citation is a guess with a confident tone.
3. **The corpus cannot inject.** Documents are treated as data. Any instruction found
   inside a retrieved chunk is content to be reported, not obeyed.

## What this looks like in the pipeline

The governed analyst in the portal implements the query branch:

- A question is matched against a small, documented metric vocabulary.
- The metric is computed from the same snapshot that passes the quality checks.
- The answer is returned with its definition, formula, scope and caveat.
- No LLM is involved. There is no arbitrary SQL generation and no free-text answer
  generation.

This is deliberately not retrieval. The metrics are structured, they must reconcile,
and a free-form answer over them could not be trusted to.

The AI Analyst section of the portal says so in plain language rather than implying a
sophisticated system it is not. The honest statement is: *this is the query branch of
the decision tree, chosen deliberately, and here is why.*

## A note on RAG for metrics documentation

There is one place a small retrieval index is genuinely useful in this repository:
searching the metric catalog, the archetype catalogue, and the policy docs so a
builder can find the right archetype or the right definition. That corpus is small,
bounded, owned, and cited. `rag/minimal_retrieval.py` implements it with a dependency-
free keyword index rather than a vector database, because at this corpus size a vector
store adds a dependency and a failure mode without improving the answer.

If the corpus grows to the point where keyword search stops being good enough, the
upgrade path is a real embedding index with the same three conditions attached. That
is the trigger to migrate, and it should be a decision made from measurements rather
than from fashion.
