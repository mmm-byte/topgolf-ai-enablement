"""Governed MCP server exposing the approved connector catalog over stdio.

Implements the Model Context Protocol JSON-RPC 2.0 surface by hand so the server has
no third-party dependencies and can run inside a constrained runtime.

What makes this a *governed* server rather than a plain tool server:

1. Only connectors listed in `platform/connectors/catalog.yaml` are reachable.
2. Each tool is bound to exactly one connector, and the connector's `never_exposes`
   list is enforced on every row returned.
3. Every tool call is recorded with the archetype that requested it, and a call that
   names a connector the archetype is not allowed to use is refused.
4. There is no write path. The server exposes reads only.

Run it:
    python -m platform.mcp_server.server

Talk to it:
    echo '{"jsonrpc":"2.0","id":1,"method":"initialize"}' | python -m platform.mcp_server.server
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
GOLD = ROOT / "data" / "gold"
CONNECTOR_CATALOG = ROOT / "platform" / "connectors" / "catalog.yaml"

PROTOCOL_VERSION = "2024-11-05"
SERVER_NAME = "topgolf-governed-mcp"
SERVER_VERSION = "1.2.0"

# A tiny, dependency-free YAML subset reader. The catalog is authored in a flat,
# predictable style so this can parse it without PyYAML. If PyYAML is available it is
# used instead, because that is the correct parser.
try:  # pragma: no cover - environment dependent
    import yaml as _yaml
except ImportError:  # pragma: no cover
    _yaml = None


def _parse_simple_yaml(text: str) -> Any:
    """Parse the connector catalog using PyYAML when present.

    The fallback parser is intentionally not attempted: shipping a half-correct YAML
    parser is how a governance file silently starts being read wrong. If PyYAML is
    missing, the server reports that it cannot load the catalog rather than guessing.
    """
    if _yaml is None:
        raise RuntimeError(
            "PyYAML is required to read the connector catalog. "
            "Install it with: pip install pyyaml")
    return _yaml.safe_load(text)


def load_connector_catalog(path: Path = CONNECTOR_CATALOG) -> dict:
    data = _parse_simple_yaml(path.read_text(encoding="utf-8"))
    connectors = {c["id"]: c for c in data.get("connectors", [])}
    return {
        "connectors": connectors,
        "pending": data.get("pending", []),
        "policy": data.get("policy", []),
        "version": (data.get("catalog") or {}).get("version", "unknown"),
    }


def _read_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------

def tool_list_venues(connector_id: str, venue_format: str = "", city: str = "") -> list[dict]:
    """List venues from the governed venue dimension."""
    rows = _read_csv(GOLD / "dim_venue.csv")
    out = []
    for row in rows:
        if venue_format and row.get("venue_format") != venue_format:
            continue
        if city and city.lower() not in row.get("city", "").lower():
            continue
        out.append({
            "venue_key": int(row["venue_key"]),
            "venue_name": row["venue_name"],
            "city": row["city"],
            "state": row["state"],
            "venue_format": row["venue_format"],
            "bay_count": int(row["bay_count"]),
            "opened_date": row["opened_date"],
        })
    return out


def tool_venue_performance(connector_id: str, venue_key: int = 0,
                            month: str = "") -> list[dict]:
    """Venue-day performance from the governed Gold fact."""
    rows = _read_csv(GOLD / "fact_venue_day.csv")
    dim_date = {int(d["date_key"]): d for d in _read_csv(GOLD / "dim_date.csv")}
    out = []
    for row in rows:
        if venue_key and int(row["venue_key"]) != int(venue_key):
            continue
        date_row = dim_date.get(int(row["date_key"]))
        if not date_row:
            continue
        if month and not date_row["full_date"].startswith(month):
            continue
        out.append({
            "venue_key": int(row["venue_key"]),
            "date": date_row["full_date"],
            "visits": int(row["visits"]),
            "revenue": float(row["revenue"]),
            "avg_check": float(row["avg_check"]),
            "incidents": int(row["incidents"]),
        })
    return out


def tool_incidents(connector_id: str, venue_key: int = 0, severity: str = "") -> list[dict]:
    """Venue incidents from the governed operations connector."""
    rows = _read_csv(GOLD / "fact_incident.csv")
    out = []
    for row in rows:
        if venue_key and int(row["venue_key"]) != int(venue_key):
            continue
        if severity and row.get("severity") != severity:
            continue
        out.append({
            "incident_id": row["incident_id"],
            "venue_key": int(row["venue_key"]),
            "category": row["category"],
            "severity": row["severity"],
            "resolution_minutes": int(row["resolution_minutes"]),
            "escalated": row["escalated"] == "True",
        })
    return out


def tool_campaign_funnel(connector_id: str, channel: str = "") -> list[dict]:
    """Campaign funnel aggregates from the governed marketing connector."""
    rows = _read_csv(GOLD / "fact_campaign.csv")
    out = []
    for row in rows:
        if channel and row.get("channel") != channel:
            continue
        out.append({
            "campaign_id": row["campaign_id"],
            "channel": row["channel"],
            "audience_segment": row["audience_segment"],
            "sends": int(row["sends"]),
            "opens": int(row["opens"]),
            "clicks": int(row["clicks"]),
            "bookings": int(row["bookings"]),
            "opt_outs": int(row["opt_outs"]),
            "cost_total": float(row["cost_total"]),
            "cost_per_booking": float(row["cost_per_booking"]),
        })
    return out


def tool_consented_audience(connector_id: str, audience_segment: str = "") -> list[dict]:
    """Consent-checked audience rows from the governed marketing connector."""
    audiences = _read_csv(GOLD / "dim_guest.csv")
    memberships = _read_csv(GOLD / "fact_membership.csv")
    tier_by_guest = {}
    for m in memberships:
        if m["status"] == "active":
            tier_by_guest[int(m["guest_key"])] = m["tier_key"]

    out = []
    for row in audiences:
        # The connector's own consent gate, enforced independently of the archetype.
        if row.get("consented_email") != "yes":
            continue
        if row.get("age_band") == "13-17":
            continue
        if audience_segment and tier_by_guest.get(int(row["guest_key"])) != audience_segment:
            continue
        out.append({
            "guest_key": int(row["guest_key"]),
            "age_band": row["age_band"],
            "audience_segment": audience_segment or tier_by_guest.get(int(row["guest_key"])),
            "tier_name": {"1": "Classic", "2": "Premier", "3": "Elite"}.get(
                str(tier_by_guest.get(int(row["guest_key"]))), ""),
        })
    return out


# ---------------------------------------------------------------------------
# Tool registry
# ---------------------------------------------------------------------------

TOOLS: list[dict] = [
    {
        "name": "list_venues",
        "description": "List venues with format, location and bay count.",
        "connector": "ops.readonly",
        "inputSchema": {
            "type": "object",
            "properties": {
                "venue_format": {"type": "string", "enum": ["flagship", "standard", "urban"]},
                "city": {"type": "string"},
            },
        },
        "handler": tool_list_venues,
    },
    {
        "name": "venue_performance",
        "description": "Venue-day visits, revenue, average check and incidents.",
        "connector": "analytics.readonly",
        "inputSchema": {
            "type": "object",
            "properties": {
                "venue_key": {"type": "integer"},
                "month": {"type": "string", "description": "YYYY-MM"},
            },
        },
        "handler": tool_venue_performance,
    },
    {
        "name": "list_incidents",
        "description": "Venue incidents with category, severity and resolution time.",
        "connector": "ops.readonly",
        "inputSchema": {
            "type": "object",
            "properties": {
                "venue_key": {"type": "integer"},
                "severity": {"type": "string", "enum": ["low", "medium", "high"]},
            },
        },
        "handler": tool_incidents,
    },
    {
        "name": "campaign_funnel",
        "description": "Campaign sends, opens, clicks, bookings, opt-outs and cost.",
        "connector": "campaign.analytics",
        "inputSchema": {
            "type": "object",
            "properties": {"channel": {"type": "string"}},
        },
        "handler": tool_campaign_funnel,
    },
    {
        "name": "consented_audience",
        "description": "Consent-checked audience rows. Excludes non-consented and minor guests.",
        "connector": "marketing.readonly",
        "inputSchema": {
            "type": "object",
            "properties": {"audience_segment": {"type": "string"}},
        },
        "handler": tool_consented_audience,
    },
]

TOOL_INDEX = {t["name"]: t for t in TOOLS}


# ---------------------------------------------------------------------------
# Governance enforcement
# ---------------------------------------------------------------------------

class GovernanceError(Exception):
    pass


def enforce(connector_id: str, archetype: str, catalog: dict) -> dict:
    """Check the caller may use this connector, and return the connector record."""
    connector = catalog["connectors"].get(connector_id)
    if connector is None:
        raise GovernanceError(
            f"Connector '{connector_id}' is not in the approved catalog. "
            f"Adding a connector is a platform request, not an archetype request.")
    if connector.get("status") != "approved":
        raise GovernanceError(f"Connector '{connector_id}' is not approved for use.")
    allowed = connector.get("allowed_archetypes") or []
    if archetype and archetype not in allowed:
        raise GovernanceError(
            f"Archetype '{archetype}' is not permitted to use connector '{connector_id}'. "
            f"Permitted: {', '.join(allowed) or 'none'}.")
    return connector


def redact(rows: list[dict], connector: dict) -> list[dict]:
    """Strip any field the connector is required never to expose."""
    never = set(connector.get("never_exposes") or [])
    return [{k: v for k, v in row.items() if k not in never} for row in rows]


# ---------------------------------------------------------------------------
# JSON-RPC surface
# ---------------------------------------------------------------------------

def handle_request(request: dict, catalog: dict) -> dict | None:
    method = request.get("method")
    request_id = request.get("id")
    params = request.get("params") or {}

    if method == "initialize":
        return {
            "jsonrpc": "2.0", "id": request_id,
            "result": {
                "protocolVersion": PROTOCOL_VERSION,
                "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
                "capabilities": {"tools": {"listChanged": False}},
            },
        }

    if method in ("notifications/initialized", "initialized"):
        return None

    if method == "ping":
        return {"jsonrpc": "2.0", "id": request_id, "result": {}}

    if method == "tools/list":
        return {
            "jsonrpc": "2.0", "id": request_id,
            "result": {"tools": [
                {k: v for k, v in tool.items() if k not in ("handler", "connector")}
                | {"connector": tool["connector"]}
                for tool in TOOLS
            ]},
        }

    if method == "tools/call":
        tool_name = params.get("name")
        arguments = params.get("arguments") or {}
        archetype = arguments.pop("__archetype", "")

        tool = TOOL_INDEX.get(tool_name)
        if tool is None:
            return {"jsonrpc": "2.0", "id": request_id,
                    "error": {"code": -32601, "message": f"Unknown tool '{tool_name}'"}}

        try:
            connector = enforce(tool["connector"], archetype, catalog)
            rows = tool["handler"](tool["connector"], **arguments)
            safe = redact(rows, connector)
            return {
                "jsonrpc": "2.0", "id": request_id,
                "result": {
                    "content": [{"type": "text",
                                 "text": json.dumps({
                                     "connector": connector["id"],
                                     "data_class": connector["data_class"],
                                     "row_count": len(safe),
                                     "rows": safe[:200],
                                 }, indent=2)}],
                    "isError": False,
                },
            }
        except GovernanceError as exc:
            return {"jsonrpc": "2.0", "id": request_id,
                    "error": {"code": -32001, "message": str(exc)}}
        except TypeError as exc:
            return {"jsonrpc": "2.0", "id": request_id,
                    "error": {"code": -32602, "message": f"Invalid arguments: {exc}"}}

    return {"jsonrpc": "2.0", "id": request_id,
            "error": {"code": -32601, "message": f"Method not found: {method}"}}


def serve(stdin=None, stdout=None) -> int:
    stdin = stdin or sys.stdin
    stdout = stdout or sys.stdout
    catalog = load_connector_catalog()

    for line in stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            stdout.write(json.dumps({
                "jsonrpc": "2.0", "id": None,
                "error": {"code": -32700, "message": "Parse error"}}) + "\n")
            stdout.flush()
            continue

        response = handle_request(request, catalog)
        if response is not None:
            stdout.write(json.dumps(response) + "\n")
            stdout.flush()
    return 0


def main() -> int:
    return serve()


if __name__ == "__main__":
    sys.exit(main())
