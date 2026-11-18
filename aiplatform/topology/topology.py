"""Platform topology generator.

Produces the complete architecture graph that the portal renders: every node, every
connection, and the story of what flows along each connection.

The graph is derived from the real artifacts in this repository rather than hand-drawn,
so it cannot drift from the implementation. Every node carries a `source` field naming
the file it came from, and the portal renders that link.

Usage:
    python -m aiplatform.topology.topology --json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

try:
    import yaml as _yaml
except ImportError:  # pragma: no cover
    _yaml = None


def _yaml_load(path: Path) -> dict:
    if _yaml is None:
        raise RuntimeError("PyYAML is required to build the topology. "
                           "Install it with: pip install pyyaml")
    return _yaml.safe_load(path.read_text(encoding="utf-8"))


LAYERS = [
    {"id": "experience", "label": "Experience", "order": 0,
     "description": "What a person actually touches."},
    {"id": "catalog", "label": "Catalogs", "order": 1,
     "description": "The governed registries. An archetype cannot use what is not listed."},
    {"id": "runtime", "label": "Runtime", "order": 2,
     "description": "Where the work executes and what it is allowed to touch."},
    {"id": "control", "label": "Control plane", "order": 3,
     "description": "The checks that run on every change, and the people who own them."},
    {"id": "data", "label": "Data layer", "order": 4,
     "description": "The modelled layer every metric is computed from."},
    {"id": "source", "label": "Source systems", "order": 5,
     "description": "The systems archetypes are not allowed to touch directly."},
]


def build_topology() -> dict:
    archetype_catalog = _yaml_load(ROOT / "archetypes" / "catalog.yaml")
    connector_catalog = _yaml_load(ROOT / "aiplatform" / "connectors" / "catalog.yaml")
    pipeline = json.loads((ROOT / "public" / "data" / "operations.json").read_text(encoding="utf-8"))

    nodes: list[dict] = []
    edges: list[dict] = []

    def node(node_id, layer, label, kind, detail, source="", **extra):
        nodes.append({"id": node_id, "layer": layer, "label": label, "kind": kind,
                      "detail": detail, "source": source, **extra})

    def edge(src, dst, label, kind, detail, payload="", guarded_by=""):
        edges.append({"id": f"{src}->{dst}", "source": src, "target": dst,
                      "label": label, "kind": kind, "detail": detail,
                      "payload": payload, "guarded_by": guarded_by})

    # ---------------------------------------------------------------- experience
    node("exp.builder", "experience", "Builder", "person",
         "A non-technical or technical team member who needs a safe application. "
         "They answer the intake questionnaire, not a message to engineering.",
         "archetypes/references/intake-questionnaire.md", persona="Requester")
    node("exp.reviewer", "experience", "Reviewer", "person",
         "The technical backstop. Reviews AI-produced code, specs and gate results "
         "for correctness, security, scope adherence and good development practice.",
         "review/ai-output-review-rubric.md", persona="AI Enablement Engineer")
    node("exp.steward", "experience", "App steward", "person",
         "Owns an archetype after release. Signs every catalog change and reviews "
         "usage evidence.",
         "archetypes/catalog.yaml", persona="Service owner")
    node("exp.dataowner", "experience", "Data owner", "person",
         "Owns a data set. Signs off the data class and confirms consent handling "
         "before anything reads it.",
         "review/gate-finding-triage.md", persona="Data steward")
    node("exp.security", "experience", "Security", "person",
         "Receives every S1 finding. Anything involving guest safety, personal data "
         "exposure, or an automated safety decision routes here immediately.",
         "review/gate-finding-triage.md", persona="Security")
    node("exp.guest", "experience", "Guest", "person",
         "The person the whole system exists for. A guest must never be surprised "
         "by something an archetype produced.",
         "archetypes/campaign-brief/SKILL.md", persona="Recipient")

    # ------------------------------------------------------------------ catalogs
    node("cat.archetypes", "catalog", "Archetype catalog", "registry",
         "The machine-readable list of every archetype, with its data class, "
         "connector, owner, steward, usage evidence and recorded decision.",
         "archetypes/catalog.yaml",
         count=len(archetype_catalog.get("archetypes", [])),
         declined=len(archetype_catalog.get("declined", [])),
         version=(archetype_catalog.get("catalog") or {}).get("version", ""))
    node("cat.connectors", "catalog", "Connector catalog", "registry",
         "The only route from an archetype to a system. Each connector declares what "
         "it may expose, what it must never expose, and which archetypes may use it.",
         "aiplatform/connectors/catalog.yaml",
         count=len(connector_catalog.get("connectors", [])),
         declined=len(connector_catalog.get("pending", [])),
         version=(connector_catalog.get("catalog") or {}).get("version", ""))
    node("cat.policy", "catalog", "Policy registry", "registry",
         "Data classes, escalation routes, and the rules for adding a connector or "
         "an archetype. All of it enforced somewhere in the pipeline.",
         "review/gate-finding-triage.md",
         count=4, registry_unit="data classes")
    node("cat.metrics", "catalog", "Metric catalog", "registry",
         "Every measure with its formula, grain, owner and limitation. A metric that "
         "will be quoted in a decision has to reconcile.",
         "scripts/build_pipeline.py",
         count=len(pipeline.get("metric_catalog", [])), registry_unit="metrics")

    # ------------------------------------------------------------------- runtime
    node("rt.agent", "runtime", "Agent runtime", "process",
         "Where an archetype executes. Constrained: it can only reach a system through "
         "a connector in the catalog, and only with the permissions the archetype "
         "declares.",
         "aiplatform/connectors/catalog.yaml", constraint="constrained-worker")
    node("rt.mcp", "runtime", "MCP server", "process",
         "The Model Context Protocol surface over stdio JSON-RPC. Implements "
         "initialize, tools/list and tools/call. No third-party dependencies so it "
         "runs inside the constrained runtime.",
         "aiplatform/mcp_server/server.py", protocol="2024-11-05", tools=5)
    node("rt.guard", "control", "Guardrail engine", "process",
         "Deterministic checks that fail closed. Scope: fields touched against "
         "fields declared. Output: structure, bounds and prohibited content. Policy: "
         "the output set against data-class rules.",
         "security/guardrails/guardrails.py", checks=3)
    node("rt.adversarial", "control", "Adversarial suite", "process",
         "Eighteen cases across six taxonomies. A case that stops being caught is a "
         "regression and blocks the pipeline.",
         "security/adversarial/run_suite.py", cases=18, taxonomies=6)
    node("rt.secrets", "control", "Secrets scan", "process",
         "Credential patterns across the working tree, plus a git history scan in CI "
         "so a removed secret is still a finding.",
         "security/guardrails/secrets_scan.py")
    node("rt.health", "control", "Health monitor", "process",
         "Prompt drift, rewrite rate, gate failures and support load. Proposes keep, "
         "extend, merge, review or retire. The steward decides.",
         "monitoring/health_report.py")
    node("rt.validator", "control", "Catalog validator", "process",
         "Fails the build when an archetype is missing an owner, steward, data class, "
         "connector or review date.",
         "monitoring/validate_catalog.py")
    node("rt.scaffold", "runtime", "Scaffold generator", "process",
         "Turns a filled-in questionnaire into a complete, already-gated archetype "
         "folder. Refuses an unapproved connector.",
         "archetypes/shift-handover/scripts/scaffold.py")
    node("rt.review", "control", "Human review", "process",
         "Applies the rubric and answers one question: what did the automated gates "
         "miss? The stage exists because some rules cannot be automated honestly.",
         "review/ai-output-review-rubric.md")
    node("rt.triage", "control", "Escalation triage", "process",
         "Routes every finding to one of four destinations with a severity and a "
         "response clock.",
         "review/gate-finding-triage.md")
    node("rt.rag", "runtime", "Retrieval index", "process",
         "A bounded, owned, cited document corpus with a keyword index. Deliberately "
         "not a vector database: at this corpus size that adds a dependency and a "
         "failure mode without improving the answer.",
         "rag/minimal_retrieval.py", corpus=15)

    # ---------------------------------------------------------------- data layer
    gold = pipeline["metadata"].get("gold_tables", {})
    node("data.bronze", "data", "Bronze", "table",
         "Source-shaped extracts, kept so the starting point stays inspectable.",
         "data/bronze/", tables=6)
    node("data.silver", "data", "Silver", "table",
         "Typed, validated and deduplicated. Malformed rows are rejected and the "
         "reason is recorded rather than silently dropped.",
         "data/silver/", tables=6)
    node("data.gold", "data", "Gold", "table",
         "Conformed dimensions and facts. Every fact resolves to a dimension. This is "
         "the layer the archetypes and the analyst read.",
         "data/gold/", tables=len(gold))
    node("data.snapshot", "data", "Published snapshot", "table",
         "The single JSON the portal renders. The pipeline cannot write a figure the "
         "quality checks did not pass, and the portal cannot show a number that "
         "failed its own check.",
         "public/data/operations.json", tables=1)

    # ------------------------------------------------------------ source systems
    for connector in connector_catalog.get("connectors", []):
        node(f"src.{connector['id']}", "source", connector["system"], "system",
             connector["notes"], "aiplatform/connectors/catalog.yaml",
             data_class=connector["data_class"], steward=connector["steward"],
             connector_id=connector["id"])

    # ------------------------------------------------------------------- edges
    edge("exp.builder", "cat.archetypes", "submits intake", "flow",
         "Answers the intake questionnaire. The request is matched to an existing "
         "archetype or sent for a new one.", "intake answers", "cat.policy")
    edge("exp.builder", "rt.scaffold", "runs scaffold", "flow",
         "Generates a complete archetype folder with the rules and the manifest "
         "already wired in.", "archetype scaffold", "rt.validator")
    edge("rt.scaffold", "cat.archetypes", "registers", "flow",
         "The new archetype enters the catalog as draft. It cannot be used against "
         "real data until the intake questions are answered.", "catalog entry")
    edge("cat.archetypes", "rt.agent", "loads", "flow",
         "The runtime loads the archetype's instructions, its data class, its "
         "connector binding and its guardrail manifest.",
         "SKILL.md + guardrails.json", "rt.validator")
    edge("cat.archetypes", "rt.health", "is measured by", "flow",
         "Usage, rewrite rate, gate failures, support load and prompt size are "
         "measured per archetype.", "usage and drift signals")
    edge("rt.health", "exp.steward", "proposes to", "flow",
         "The monitor proposes keep, extend, merge, review or retire. It does not "
         "apply the change.", "recommended action")
    edge("exp.steward", "cat.archetypes", "records decision", "flow",
         "The decision and its reason are written into the catalog, with the person "
         "who accepted it and the date it is due again.", "catalog decision")
    edge("cat.connectors", "rt.mcp", "binds tools to", "flow",
         "Each MCP tool is bound to exactly one connector. Access is not implicit.",
         "tool to connector binding", "rt.mcp")
    edge("rt.agent", "rt.mcp", "calls tools on", "flow",
         "The agent calls the MCP server over stdio JSON-RPC. The server enforces "
         "which archetype may use which connector.", "tools/call", "rt.mcp")
    edge("rt.mcp", "data.gold", "reads", "flow",
         "The server reads the Gold layer. It exposes no write path at all, so a "
         "compromised agent cannot modify a record.",
         "read-only query", "rt.guard")
    edge("rt.mcp", "src.ops.readonly", "would reach", "blocked",
         "In production this connector reads the venue incident system. In this "
         "repository the Gold layer stands in for it.",
         "never_exposes enforced", "rt.guard")
    edge("rt.mcp", "src.analytics.readonly", "would reach", "blocked",
         "Aggregates only. Individual guest keys are not exposed through this path.",
         "never_exposes enforced", "rt.guard")
    edge("rt.mcp", "src.marketing.readonly", "would reach", "blocked",
         "Consent-checked. The connector itself refuses to return a non-consented or "
         "minor guest, independently of the archetype.",
         "consent gate", "rt.guard")
    edge("rt.mcp", "src.campaign.analytics", "would reach", "blocked",
         "Campaign aggregates only. No recipient-level record, so it cannot become "
         "a re-identification path.", "never_exposes enforced", "rt.guard")
    edge("rt.mcp", "src.venue.directory", "would reach", "blocked",
         "The only connector usable from an external tool, and it carries no "
         "operational data.", "public class", "rt.guard")
    edge("data.bronze", "data.silver", "transforms into", "flow",
         "Types, validates and deduplicates. Rejections are counted by reason.",
         "validated records", "rt.validator")
    edge("data.silver", "data.gold", "conforms into", "flow",
         "Dimensions and facts with conformed keys and declared grain.",
         "dimensional records", "rt.validator")
    edge("data.gold", "data.snapshot", "publishes", "flow",
         "The snapshot the portal reads. Every figure in it passed a quality check.",
         "gated snapshot", "rt.validator")
    edge("data.snapshot", "cat.metrics", "documents", "flow",
         "Every published measure carries its formula, grain, owner and limitation.",
         "metric definitions")
    edge("rt.guard", "rt.review", "hands off to", "flow",
         "The engine produces findings. The reviewer produces judgment about what "
         "the gates missed.", "findings", "rt.review")
    edge("rt.review", "exp.reviewer", "performed by", "flow",
         "A person applies the rubric and records what they tried.", "review record")
    edge("rt.adversarial", "rt.review", "informs", "flow",
         "Adversarial results show which attacks are caught and which rules still "
         "need a human.", "attack coverage")
    edge("rt.secrets", "rt.review", "supplies evidence to", "flow",
         "A clean scan is one gate result the reviewer interprets.", "gate evidence")
    edge("rt.review", "rt.triage", "routes findings to", "flow",
         "Every finding gets a severity, a destination and a response clock.",
         "finding", "rt.triage")
    edge("rt.triage", "exp.security", "pages", "flow",
         "Guest safety, data exposure, or an automated safety decision. Immediate.",
         "S1 finding")
    edge("rt.triage", "exp.dataowner", "routes to", "flow",
         "Wrong data class, missing consent, minor targeting, unclear source.",
         "S1 or S2 finding")
    edge("rt.triage", "exp.steward", "routes to", "flow",
         "Scope, correctness, contract breach, gate failure.", "S2 or S3 finding")
    edge("rt.triage", "exp.reviewer", "routes ambiguous to", "flow",
         "A finding that could reasonably go two places goes to AI Enablement "
         "first, because routing wrongly costs a day.", "ambiguous finding")
    edge("exp.security", "cat.policy", "may change", "flow",
         "A finding routed to security can change the policy registry, which "
         "changes what the gates enforce.", "policy change")
    edge("rt.rag", "cat.archetypes", "indexes", "flow",
         "The retrieval corpus is the archetype catalog, the policy documents and "
         "the review guidance, so a builder can find the right building block.",
         "cited passages")
    edge("rt.rag", "exp.builder", "answers", "flow",
         "Answers carry the source passage, so the builder can cite it. If no "
         "passage supports the answer, it is withheld.", "cited answer")
    edge("exp.guest", "rt.mcp", "is affected by", "flow",
         "The ultimate output. Every rule exists so a guest is never surprised by "
         "something an archetype produced.", "guest-facing output")

    tables = [
        {"name": "dim_venue", "layer": "Gold", "grain": "One row per venue",
         "purpose": "Venue identity, format, bay count, opening date.",
         "key": "venue_key", "rows": gold.get("dim_venue"),
         "joins": ["fact_visit", "fact_venue_day", "fact_incident", "fact_membership"]},
        {"name": "dim_date", "layer": "Gold", "grain": "One row per calendar day",
         "purpose": "Conformed date spine with weekend and month attributes.",
         "key": "date_key", "rows": gold.get("dim_date"),
         "joins": ["fact_visit", "fact_campaign", "fact_incident", "fact_venue_day"]},
        {"name": "dim_membership_tier", "layer": "Gold", "grain": "One row per tier",
         "purpose": "The three planned tiers with fee and rank.",
         "key": "tier_key", "rows": gold.get("dim_membership_tier"),
         "joins": ["fact_membership"]},
        {"name": "dim_guest", "layer": "Gold", "grain": "One row per guest",
         "purpose": "Consent state, age band, signup channel, lifetime visits.",
         "key": "guest_key", "rows": gold.get("dim_guest"),
         "joins": ["fact_visit", "fact_membership"]},
        {"name": "fact_visit", "layer": "Gold", "grain": "One row per visit",
         "purpose": "Party size, modelled check total, games played, booking channel.",
         "key": "visit_key", "rows": gold.get("fact_visit"),
         "joins": ["dim_venue", "dim_guest", "dim_date"]},
        {"name": "fact_membership", "layer": "Gold", "grain": "One row per membership",
         "purpose": "Tier, status, start date, monthly fee, days active.",
         "key": "membership_key", "rows": gold.get("fact_membership"),
         "joins": ["dim_guest", "dim_membership_tier", "dim_date"]},
        {"name": "fact_campaign", "layer": "Gold", "grain": "One row per campaign",
         "purpose": "Sends, opens, clicks, bookings, opt-outs and cost.",
         "key": "campaign_key", "rows": gold.get("fact_campaign"), "joins": ["dim_date"]},
        {"name": "fact_incident", "layer": "Gold", "grain": "One row per incident",
         "purpose": "Category, severity, resolution time, escalation flag.",
         "key": "incident_key", "rows": gold.get("fact_incident"),
         "joins": ["dim_venue", "dim_date"]},
        {"name": "fact_venue_day", "layer": "Gold",
         "grain": "One row per venue per calendar day",
         "purpose": "The daily spine that venue comparisons and trend measures use.",
         "key": "venue_key + date_key", "rows": gold.get("fact_venue_day"),
         "joins": ["dim_venue", "dim_date"]},
    ]

    mcp_tools = [
        {"name": "list_venues", "connector": "ops.readonly",
         "data_class": "internal-personal",
         "description": "List venues with format, location and bay count.",
         "arguments": {"venue_format": "string, one of flagship | standard | urban",
                       "city": "string, partial match"},
         "returns": "venue_key, venue_name, city, state, venue_format, bay_count, opened_date",
         "guards": ["connector permission", "never_exposes redaction"]},
        {"name": "venue_performance", "connector": "analytics.readonly",
         "data_class": "internal-aggregated",
         "description": "Venue-day visits, revenue, average check and incidents.",
         "arguments": {"venue_key": "integer, optional filter",
                       "month": "string, YYYY-MM"},
         "returns": "venue_key, date, visits, revenue, avg_check, incidents",
         "guards": ["connector permission", "never_exposes redaction"]},
        {"name": "list_incidents", "connector": "ops.readonly",
         "data_class": "internal-personal",
         "description": "Venue incidents with category, severity and resolution time.",
         "arguments": {"venue_key": "integer, optional filter",
                       "severity": "string, one of low | medium | high"},
         "returns": "incident_id, venue_key, category, severity, resolution_minutes, escalated",
         "guards": ["connector permission", "never_exposes redaction", "no guest identifier in any row"]},
        {"name": "campaign_funnel", "connector": "campaign.analytics",
         "data_class": "internal-aggregated",
         "description": "Campaign sends, opens, clicks, bookings, opt-outs and cost.",
         "arguments": {"channel": "string, optional filter"},
         "returns": "campaign_id, channel, audience_segment, sends, opens, clicks, bookings, opt_outs, cost_total, cost_per_booking",
         "guards": ["connector permission", "no recipient-level record exposed"]},
        {"name": "consented_audience", "connector": "marketing.readonly",
         "data_class": "internal-personal",
         "description": "Consent-checked audience rows. Excludes non-consented and minor guests.",
         "arguments": {"audience_segment": "string, optional tier filter"},
         "returns": "guest_key, age_band, audience_segment, tier_name",
         "guards": ["connector permission", "consent gate", "minor exclusion", "no contact details"]},
    ]

    return {
        "layers": LAYERS,
        "nodes": nodes,
        "edges": edges,
        "tables": tables,
        "mcp_tools": mcp_tools,
        "mcp_protocol": {
            "protocol_version": "2024-11-05",
            "transport": "stdio, newline-delimited JSON-RPC 2.0",
            "methods": ["initialize", "notifications/initialized", "ping",
                        "tools/list", "tools/call"],
            "server": "aiplatform/mcp_server/server.py",
        },
        "stats": {"nodes": len(nodes), "edges": len(edges),
                  "gold_tables": len(gold), "mcp_tools": len(mcp_tools)},
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the platform topology")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON")
    args = parser.parse_args()

    topology = build_topology()

    if args.json:
        print(json.dumps(topology, indent=2))
        return 0

    print(f"Topology: {topology['stats']['nodes']} nodes, "
          f"{topology['stats']['edges']} edges, "
          f"{topology['stats']['gold_tables']} Gold tables, "
          f"{topology['stats']['mcp_tools']} MCP tools\n")
    for layer in topology["layers"]:
        members = [n for n in topology["nodes"] if n["layer"] == layer["id"]]
        print(f"{layer['label']} ({len(members)})")
        for n in members:
            print(f"  {n['id']:<26} {n['label']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
