# AI Enablement Engineering — archetypes, governed connectors, and drift monitoring

**A working implementation of the Topgolf AI Enablement Engineer role (JR2023-23049).**

The role is named after **archetypes**: reusable building blocks that let business teams
build safe, working applications inside a gated AI-SDLC pipeline. This repository contains
those building blocks, the governance that keeps them safe, and the tooling that retires
them when they stop earning their place.

> **Independence and data notice.** This is an independent portfolio project built for a
> job application. It is not affiliated with, endorsed by, or connected to Topgolf
> Entertainment Group or Callaway Brands. It has no access to any internal system. Every
> venue, guest, membership, campaign and incident record here is synthetic.

---

## Start here

1. **Architecture** — an interactive diagram of every component and every connection.
   Click any node to see what it is, which file implements it, and what flows through it.
2. **Request traces** — follow one request end to end: who acts, what moves, which guard
   checks it, and what the outcome was.
3. **Pipeline & gates** — the seven-stage path to production, data classes, and triage.
4. **Archetypes** — four real `SKILL.md` files, one retired and merged on usage evidence.
5. **Connectors & MCP** — the governed connector catalog.
6. **MCP inspector** — the exact tool contract: arguments, return payload, and guards.
7. **Data model** — every table, its grain, its key, and what it joins to.
8. **Guardrails** — the deterministic engine, the 18-case adversarial suite, the secrets scan.
9. **Health & drift** — the weekly monitor that proposes keep, extend, merge, review, retire.
10. **Enablement** — the readiness check, role paths, and office-hours formats.
11. **Evidence map** — every responsibility in the role description, and what answers it.
12. **Data & metrics** — the fixture, the metric catalog, and the executed quality checks.
13. **Platform map** — the six domains of the platform, the question each one answers, and
    the files that implement it.

---

## What is actually executable

Nothing in this repository is a mock. Every claim below is produced by a command you can run.

| Artifact | Command | Result |
|---|---|---|
| Data pipeline | `python3 scripts/build_pipeline.py` | 4 dimensions, 5 facts, **17/17 quality checks pass** |
| Guardrail engine | `python3 -m security.guardrails.guardrails --self-test` | **11/11 self-tests pass** |
| Adversarial suite | `python3 -m security.adversarial.run_suite` | **18/18 cases caught**, 17 by two independent layers |
| Secrets scan | `python3 -m security.guardrails.secrets_scan` | clean across the working tree; CI also scans git history |
| Catalog validator | `python3 -m monitoring.validate_catalog` | 4 archetypes, 3 declined, 0 errors |
| Health monitor | `python3 -m monitoring.health_report` | flags prompt drift in `shift-handover` (+17.3%) |
| MCP server | `python3 -m aiplatform.mcp_server.server` | stdio JSON-RPC, refuses unauthorised connector use |
| Topology generator | `python3 -m aiplatform.topology.topology` | 30 nodes, 32 connections, 9 tables, 5 tools |
| Test suite | `python3 -m pytest tests -q` | **61 tests pass** |
| Portal | `npm run build` then `npm start` | production build, 44.5 kB route |

---

## Platform architecture

The diagram in the portal is generated from the repository, not drawn by hand. The
generator reads the archetype catalog, the connector catalog and the pipeline output,
then emits a graph of **30 components and 32 connections** across six layers.

| Layer | What lives there | Why it is separate |
|---|---|---|
| Experience | Builder, reviewer, app steward, data owner, security, guest | Every point where a person has to decide something |
| Catalogs | Archetype, connector, policy and metric registries | An archetype cannot use what is not listed |
| Runtime | Agent runtime, MCP server, scaffold generator, retrieval index | Where the work executes and what it may touch |
| Control plane | Guardrail engine, adversarial suite, secrets scan, health monitor, catalog validator, human review, escalation triage | The checks that run on every change, and who owns them |
| Data layer | Bronze, Silver, Gold, published snapshot | The modelled layer every metric is computed from |
| Source systems | Venue incident log, governed analytics, consent-checked audience, campaign aggregates, venue directory | The systems archetypes are not allowed to touch directly |

**Every connection carries a payload and a named guard.** A connection without a guard
is a place the platform can be bypassed, so the generator refuses to emit one. The
portal renders the full inventory, and the dashed red connections are the paths that
are blocked by design.

```bash
python3 -m aiplatform.topology.topology          # readable summary
python3 -m aiplatform.topology.topology --json   # the graph the portal renders
```

### The MCP contract

The server implements the Model Context Protocol JSON-RPC surface over stdio by hand, so
it has no third-party dependencies and can run inside a constrained runtime. It speaks
`initialize`, `notifications/initialized`, `ping`, `tools/list` and `tools/call`.

Five tools are exposed, each bound to exactly one approved connector:

| Tool | Connector | Data class | What it returns |
|---|---|---|---|
| `list_venues` | `ops.readonly` | internal-personal | Venue identity, format, bay count |
| `venue_performance` | `analytics.readonly` | internal-aggregated | Venue-day visits, revenue, check, incidents |
| `list_incidents` | `ops.readonly` | internal-personal | Incident category, severity, resolution time |
| `campaign_funnel` | `campaign.analytics` | internal-aggregated | Sends, opens, clicks, bookings, opt-outs, cost |
| `consented_audience` | `marketing.readonly` | internal-personal | Consent-checked audience rows only |

Three things make it governed rather than merely functional:

1. **Access is not implicit.** A call naming an archetype that may not use the connector
   is refused, with the permitted set in the error message.
2. **`never_exposes` is enforced on every row**, not just documented.
3. **There is no write path.** The server exposes reads only, so a compromised agent
   cannot modify a record.

### The data model

Four dimensions and five facts, with declared grain on every table:

| Table | Grain | Key |
|---|---|---|
| `dim_venue` | One row per venue | `venue_key` |
| `dim_date` | One row per calendar day | `date_key` |
| `dim_membership_tier` | One row per tier | `tier_key` |
| `dim_guest` | One row per guest | `guest_key` |
| `fact_visit` | One row per visit | `visit_key` |
| `fact_membership` | One row per membership | `membership_key` |
| `fact_campaign` | One row per campaign | `campaign_key` |
| `fact_incident` | One row per incident | `incident_key` |
| `fact_venue_day` | One row per venue per calendar day | `venue_key + date_key` |

A fact table with an ambiguous grain cannot be aggregated safely, which is why the
grain is declared in the model and checked in the pipeline rather than left to whoever
writes the query.

---

## The archetype catalog

An archetype is the reusable unit. It packages engineering standards, governance and
intake so a non-technical builder can start inside the pipeline instead of routing the
idea to engineering.

```
archetypes/
  catalog.yaml                       # machine-readable source of truth
  shift-handover/SKILL.md            # the reference implementation
  shift-handover/guardrails.json     # executable rule manifest
  shift-handover/scripts/scaffold.py # generates a new archetype
  campaign-brief/SKILL.md
  guest-frequency-anomaly/SKILL.md
  retired/legacy-standup-summary/    # retired and merged, kept for provenance
  references/
    intake-questionnaire.md          # what a team must answer before building
    spec-template.md                 # the contract every archetype satisfies
    guardrails.md                    # how rules become executable checks
```

**Lifecycle:** `draft → pilot → active → deprecated → retired`

**The catalog records decisions, not just state.** Every archetype carries a usage
period, request volume, human rewrite rate, gate failure rate, support-question count,
prompt size against a baseline, a steward, a review date, and a recorded decision with
the reason and the person who accepted it.

**One archetype was retired and merged** (`legacy-standup-summary` → `shift-handover`)
because usage showed 71% of its requests were shift-close intent, and the two archetypes
produced conflicting output formats for the same incident log. Keeping both meant two
answers to one question.

**Three requests were declined on purpose**, each with a reason and a route, so they are
not re-proposed every quarter: personalized pricing, automated safety triage, and an
unsupervised guest-message autoresponder.

### Scaffolding a new archetype

```bash
python3 archetypes/shift-handover/scripts/scaffold.py \
    --name my-archetype \
    --title "My archetype" \
    --data-class internal-aggregated \
    --connector analytics.readonly
```

The scaffold refuses an invalid name, an invalid data class, and any connector that is
not in the approved catalog.

---

## Governed connectors and MCP

A connector is the only way an archetype reaches a data system. If it is not in the
catalog, the archetype cannot use that system and the scope check fails.

Each connector declares its data class, steward, data owner, authentication, runtime
constraint, the fields it may expose, the fields it must **never** expose, and the
archetypes permitted to use it.

The MCP server implements the JSON-RPC 2.0 tool surface over stdio with no third-party
dependencies, so it can run inside a constrained runtime. Three things make it governed
rather than merely functional:

1. **Access is not implicit.** A call naming an archetype that may not use the connector
   is refused with the permitted set in the error.
2. **`never_exposes` is enforced on every row**, not just documented.
3. **There is no write path.** The server exposes reads only.

Two connector requests are **blocked** with a stated reason: `crm.full` (no consent
mapping the guardrail engine can verify) and `pos.legacy` (no row-level authorisation,
returns revenue mixed with guest identifiers).

---

## Guardrails

| Class | What it checks | Implementation |
|---|---|---|
| Scope | Fields touched vs. fields declared, checked in both directions | `security/guardrails/guardrails.py` |
| Output | Structure, length bounds, prohibited content | `security/guardrails/guardrails.py` |
| Policy | The output *set* against data-class policy, independent of the text | `security/guardrails/guardrails.py` |
| Secrets | Credential patterns in the working tree | `security/guardrails/secrets_scan.py` |

The engine fails closed. When it cannot prove an output is safe, it reports a finding
rather than passing it. S1 and S2 findings block release; S3 is reported and fixed before
the next release; S4 goes to the backlog.

### What the gates do not prove

A green gate means the output is **structurally safe**. It does not mean the output is
**right**. Rules that need judgment about operational usefulness, tone, legal approval,
or business intent stay human — which is why the pipeline keeps a human review stage
instead of pretending the machine covers it.

### The adversarial suite

18 cases across six taxonomies: prompt injection, data exfiltration, jailbreak, policy
violation, scope escape, and output manipulation. Each case names the rule it attacks,
the severity if missed, and the expected behaviour.

**What it honestly is:** a regression suite. Its value is that removing a rule flips the
matching case to `MISSED` and CI fails. **What it is not:** proof that no attack exists.
It does not use a live language model. The policy layer matches structured request
patterns; the content layer exercises the real guardrail engine against the output a
compliant-but-wrong implementation would have produced.

---

## The pipeline

Seven stages, three of them human:

1. **Intake** — the builder answers the questionnaire. Data class is set here, before any code exists.
2. **Build** — from the archetype's scaffold. Standards and guardrails are wired in, not added later.
3. **Automated gates** — unit tests, output schema, secrets scan, scope check.
4. **Adversarial tests** — any case that gets through blocks release.
5. **Human review** — the reviewer answers one question: what did the automated gates miss?
6. **Staging** — one full week against recorded or synthetic data, with output logged.
7. **Release and monitor** — released with a steward and a review date; a drop triggers review.

### Data classes

| Class | Examples | AI tools allowed | Required before release |
|---|---|---|---|
| Public | Venue hours, published offers, public FAQ | Approved assistants | Marketing review |
| Internal, aggregated | Totals by venue, campaign funnel totals | Approved assistants, governed connectors | Standard gates and human review |
| Internal, personal | Guest names, bookings, incident narratives | Only tools that keep data in the company environment | Standard gates, second reviewer, data owner sign-off |
| Restricted | Minors, payments, safety records | None without written approval | Legal, security and the data owner |

When in doubt, the app takes the higher class until a data owner confirms otherwise.

### Finding triage

Every finding routes to exactly one destination: **Security** (guest safety, data
exposure, an automated safety decision — immediate), **Data owner** (class, consent,
minor targeting, unclear source — same business day), **App steward** (scope,
correctness, contract breach, gate failure — next working day), or **AI Enablement**
(ambiguous or spanning — same business day, then routed).

An S1 is a release blocker even if the output was never sent, because the capability
exists and will be used.

---

## Health and drift monitoring

The monitor answers one question every week: which archetypes are still worth keeping?

It measures prompt size against a recorded baseline, human rewrite rate, gate failure
rate, support-question load, request volume, and adversarial pass rate. It then proposes
**keep, extend, merge, review, or retire**.

**The monitor proposes. A human decides.** Where the proposal and the recorded steward
decision disagree, the report says so explicitly rather than diverging silently. That is
currently the case for `shift-handover`: the monitor flags 17.3% prompt growth, and the
steward has already recorded a decision to extend it.

Prompt bloat is tracked separately because it is how an archetype quietly degrades — every
rule added makes the prompt longer, and past a threshold the model starts skipping rules
rather than following all of them.

---

## The fixture

The archetypes, connectors, guardrails and MCP server need something real-shaped to run
against. That something is a deterministic synthetic fixture: **48,000 visits across 64
venues, 4,200 guests, 2,600 memberships, 900 campaigns and 1,400 incidents over 331 days**,
generated from seed `1847` and rebuilt byte-identically on every run.

It is a fixture, not a claim about Topgolf's business. It exists so every governance
control can be demonstrated against a real dataset with real grain, real referential
integrity, and real violations to catch — including the minors-consent policy, which is
enforced as a data-level check rather than a comment.

### Metric definitions

| Metric | Formula | Important limitation |
|---|---|---|
| Visits per member per month | Member visits ÷ active members ÷ months | Counts all visits in the period, not only visits at the member's home venue |
| Average check | Σ check total ÷ count of visits | Modelled checkout totals, not audited revenue |
| Cost per booked visit | Σ campaign cost ÷ Σ bookings | Blended across channels; does not model incrementality |
| Marketing opt-out rate | Σ opt-outs ÷ Σ sends | Recorded at send time; later suppressions not modelled |
| Membership lapse rate | Count lapsed ÷ count of memberships | Does not distinguish voluntary from involuntary lapse |
| Average incident resolution | Average resolution minutes | Report-to-close handling time only; not a safety outcome measure |

---

## Retrieval: when to use it and when not to

[`rag/when-to-use-retrieval.md`](rag/when-to-use-retrieval.md) is a decision document,
not a build. The rule: **retrieval is for finding text, a query is for finding rows, a
script is for finding a known computation.**

It explains the three failure modes of reaching for retrieval by default — summing
numbers over chunks that does not reconcile, retrieving structured files as free text
and losing the fields the enforcement depended on, and retrieving over a corpus nobody
owns — and the three conditions a retrieval path must satisfy before it is allowed
inside the pipeline.

[`rag/minimal_retrieval.py`](rag/minimal_retrieval.py) implements the one case where
retrieval is genuinely right in this repository: searching the bounded, owned, cited
documentation corpus. It is a keyword index, not a vector database, and the upgrade
trigger is documented.

---

## Setup

Requires Python 3.10+ and Node.js 20+.

```bash
# Python side
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python3 scripts/build_pipeline.py
python3 -m scripts.build_portal_snapshot
python3 -m pytest tests -q

# Web side
npm install
npm run dev
```

Open http://localhost:3000.

### Individual checks

```bash
python3 -m security.guardrails.guardrails --self-test   # guardrail engine
python3 -m security.adversarial.run_suite               # adversarial suite
python3 -m security.guardrails.secrets_scan             # secrets scan
python3 -m monitoring.validate_catalog                   # catalog integrity
python3 -m monitoring.health_report                     # health and drift
python3 -m aiplatform.topology.topology                   # architecture graph
python3 -m rag.minimal_retrieval "how do I retire an archetype"
```

---

## Technical implementation boundary

**Implemented and executable in this repository:** deterministic Python pipeline with a
Bronze / Silver / Gold model; 17 executed quality checks; four archetype `SKILL.md`
files with executable guardrail manifests; a scaffold generator; a catalog validator
that fails the build on a missing owner, steward, class, connector or review date; a
governed connector catalog; a working MCP stdio server with enforced connector
governance and field redaction; a deterministic guardrail engine with scope, output and
policy checks; an 18-case adversarial suite across six taxonomies; a secrets scanner; a
health and drift monitor that reconciles proposals against recorded decisions; a review
rubric and triage policy; a retrieval judgment document; a platform topology generator
that produces the 30-node architecture graph from the repository itself; a Next.js
portal with an interactive architecture diagram, end-to-end request traces, an MCP tool
inspector and a data-model explorer; 61 tests; and a CI workflow that runs all of it on
every pull request.

**Documented design, not deployed:** the constrained runtime, connector authentication
and identity model, and the release mechanics are described rather than built. The review
rubric and triage rules are guidance for a human, not enforcement in code. The
adversarial suite is a regression suite over a fixture, not a live red-team of a
deployed archetype.

**Synthetic:** all archetype usage figures, champion counts, and request volumes. They
exist to demonstrate the lifecycle logic — retire, merge, extend, decline — and are
labelled as synthetic everywhere they appear.

**Not claimed:** no Topgolf internal system access, no live operational data, no
production identity or security, no deployed MCP host, no published semantic model, and
no LLM-backed analyst.

---

## A five-minute walkthrough

1. **Open the architecture diagram.** Click the MCP server node. Show that every
   connection carries a payload and a named guard, and that the dashed red paths are
   blocked by design. This is the fastest way to show the whole system.
2. **Follow a request trace.** Walk the shift-handover trace hop by hop. Nine steps,
   each with an actor, a payload, a guard and an outcome.
3. **Open the MCP inspector.** Show the input schema, the return payload and the
   guards applied to every call. Then run a call as an archetype that is not permitted
   to use its connector, and show the refusal.
4. **Lead with an archetype.** Open one `SKILL.md` and read the hard rules aloud. That is
   the artefact the role is named after.
5. **Show the catalog lifecycle.** Four shipped, one retired and merged, three declined
   with a route.
6. **Run the adversarial suite.** Show that removing a rule breaks the build.
7. **Open the health report.** Show the drift flag and the reconciliation against the
   recorded steward decision.
8. **Finish on the evidence map.** Nine responsibilities, and for each one: what is
   built, and where the honest limit is.

Keep the synthetic-data notice visible. The project illustrates a working platform; it
is not a live Topgolf system.
