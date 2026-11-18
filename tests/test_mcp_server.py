"""Tests for the governed MCP server.

These cover the governance behaviour that matters: a tool call is only served when the
named archetype is permitted to use the named connector, forbidden fields never leave
the server, and the consent gate holds independently of the archetype.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from aiplatform.mcp_server import server as mcp  # noqa: E402


@pytest.fixture(scope="module")
def catalog():
    return mcp.load_connector_catalog()


def _call(tool_name: str, arguments: dict, archetype: str = "") -> dict:
    """Invoke a tool through the JSON-RPC surface, exactly as a client would."""
    request = {
        "jsonrpc": "2.0", "id": 1, "method": "tools/call",
        "params": {"name": tool_name, "arguments": {**arguments, "__archetype": archetype}},
    }
    response = mcp.handle_request(request, mcp.load_connector_catalog())
    return response


def _rows(response: dict) -> list[dict]:
    payload = json.loads(response["result"]["content"][0]["text"])
    return payload["rows"]


class TestProtocolSurface:
    def test_initialize_returns_protocol_version(self):
        response = mcp.handle_request(
            {"jsonrpc": "2.0", "id": 1, "method": "initialize"},
            mcp.load_connector_catalog())
        assert response["result"]["protocolVersion"]
        assert response["result"]["serverInfo"]["name"] == "topgolf-governed-mcp"

    def test_tools_list_exposes_connector_binding(self):
        response = mcp.handle_request(
            {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
            mcp.load_connector_catalog())
        tools = response["result"]["tools"]
        assert tools
        for tool in tools:
            assert "connector" in tool
            assert "handler" not in tool

    def test_unknown_method_returns_error(self):
        response = mcp.handle_request(
            {"jsonrpc": "2.0", "id": 3, "method": "nope/nope"},
            mcp.load_connector_catalog())
        assert "error" in response

    def test_server_runs_over_stdio(self):
        payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "initialize"})
        proc = subprocess.run(
            [sys.executable, "-m", "aiplatform.mcp_server.server"],
            input=payload, capture_output=True, text=True, cwd=ROOT)
        assert proc.returncode == 0
        assert json.loads(proc.stdout.strip().splitlines()[0])["result"]["serverInfo"]


class TestConnectorGovernance:
    def test_permitted_archetype_is_served(self):
        response = _call("list_incidents", {"severity": "high"}, archetype="shift-handover")
        assert "result" in response
        assert response["result"]["isError"] is False

    def test_archetype_without_permission_is_refused(self):
        response = _call("list_incidents", {}, archetype="campaign-brief")
        assert "error" in response
        assert "not permitted" in response["error"]["message"]

    def test_unknown_connector_is_refused(self):
        with pytest.raises(mcp.GovernanceError):
            mcp.enforce("does.not.exist", "shift-handover",
                        mcp.load_connector_catalog())

    def test_pending_connector_is_not_in_approved_catalog(self, catalog):
        pending_ids = {p["id"] for p in catalog["pending"]}
        for pending_id in pending_ids:
            assert pending_id not in catalog["connectors"]

    def test_every_approved_connector_has_steward_and_data_owner(self, catalog):
        for connector in catalog["connectors"].values():
            assert connector.get("steward")
            assert connector.get("data_owner")
            assert connector.get("data_class") in {
                "public", "internal-aggregated", "internal-personal", "restricted"}

    def test_every_approved_connector_declares_never_exposes(self, catalog):
        for connector in catalog["connectors"].values():
            assert "never_exposes" in connector

    def test_no_approved_connector_exposes_a_write_path(self, catalog):
        for connector in catalog["connectors"].values():
            assert "write" not in connector.get("auth", "").lower()


class TestFieldRedaction:
    def test_never_exposes_fields_are_stripped(self):
        connector = {"never_exposes": ["guest_name", "card_brand"]}
        rows = [{"guest_key": 1, "guest_name": "X", "card_brand": "Visa", "age_band": "25-34"}]
        redacted = mcp.redact(rows, connector)
        assert redacted == [{"guest_key": 1, "age_band": "25-34"}]

    def test_incident_rows_carry_no_guest_identifier(self):
        response = _call("list_incidents", {}, archetype="shift-handover")
        for row in _rows(response):
            assert not any(key.startswith("guest_") for key in row)
            assert "guest_name" not in row


class TestConsentGate:
    def test_audience_excludes_minors(self):
        response = _call("consented_audience", {}, archetype="campaign-brief")
        for row in _rows(response):
            assert row["age_band"] != "13-17"

    def test_audience_excludes_non_consented_guests(self):
        response = _call("consented_audience", {}, archetype="campaign-brief")
        rows = _rows(response)
        assert rows, "expected a non-empty consented audience"
        # Every returned guest must be consented in the source dimension.
        import csv
        with (ROOT / "data" / "gold" / "dim_guest.csv").open(encoding="utf-8") as fh:
            source = {int(r["guest_key"]): r for r in csv.DictReader(fh)}
        for row in rows:
            assert source[row["guest_key"]]["consented_email"] == "yes"

    def test_audience_rows_expose_no_contact_details(self):
        response = _call("consented_audience", {}, archetype="campaign-brief")
        for row in _rows(response):
            assert set(row).issubset({"guest_key", "age_band", "audience_segment", "tier_name"})


class TestReadOnlySurface:
    def test_no_tool_declares_a_write_operation(self):
        for tool in mcp.TOOLS:
            assert tool["name"].startswith(("list_", "venue_", "campaign_", "consented_"))

    def test_campaign_tool_returns_aggregates_only(self):
        response = _call("campaign_funnel", {}, archetype="campaign-brief")
        for row in _rows(response):
            assert "guest_key" not in row
            assert "recipient_address" not in row
