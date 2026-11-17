"""Tests for the platform topology generator.

The topology is rendered in the portal as the architecture diagram. If it drifts from
the implementation, the diagram becomes a lie, so the graph is checked against the
files it claims to describe.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from platform.topology import topology as topo  # noqa: E402


@pytest.fixture(scope="module")
def graph():
    return topo.build_topology()


class TestGraphIntegrity:
    def test_every_edge_endpoint_resolves_to_a_node(self, graph):
        ids = {n["id"] for n in graph["nodes"]}
        for edge in graph["edges"]:
            assert edge["source"] in ids, f"{edge['id']}: unknown source"
            assert edge["target"] in ids, f"{edge['id']}: unknown target"

    def test_no_self_loops(self, graph):
        for edge in graph["edges"]:
            assert edge["source"] != edge["target"], f"{edge['id']} is a self loop"

    def test_every_node_belongs_to_a_declared_layer(self, graph):
        layer_ids = {layer["id"] for layer in graph["layers"]}
        for node in graph["nodes"]:
            assert node["layer"] in layer_ids, f"{node['id']} has unknown layer"

    def test_every_layer_has_at_least_one_node(self, graph):
        """An empty layer renders as a broken column in the diagram."""
        for layer in graph["layers"]:
            members = [n for n in graph["nodes"] if n["layer"] == layer["id"]]
            assert members, f"layer '{layer['id']}' has no nodes"

    def test_every_node_carries_a_description(self, graph):
        for node in graph["nodes"]:
            assert node["detail"], f"{node['id']} has no detail"
            assert node["label"], f"{node['id']} has no label"

    def test_every_edge_carries_a_payload_and_a_guard(self, graph):
        for edge in graph["edges"]:
            assert edge["payload"], f"{edge['id']} has no payload"
            assert edge["detail"], f"{edge['id']} has no detail"

    def test_node_source_files_exist(self, graph):
        for node in graph["nodes"]:
            source = node.get("source")
            if not source:
                continue
            assert (ROOT / source).exists(), f"{node['id']} points at missing {source}"


class TestCatalogConsistency:
    def test_topology_nodes_match_the_archetype_catalog(self, graph):
        catalog = topo._yaml_load(ROOT / "archetypes" / "catalog.yaml")
        declared = len(catalog.get("archetypes", []))
        registry = next(n for n in graph["nodes"] if n["id"] == "cat.archetypes")
        assert registry["count"] == declared

    def test_topology_nodes_match_the_connector_catalog(self, graph):
        catalog = topo._yaml_load(ROOT / "platform" / "connectors" / "catalog.yaml")
        declared = len(catalog.get("connectors", []))
        registry = next(n for n in graph["nodes"] if n["id"] == "cat.connectors")
        assert registry["count"] == declared

    def test_every_connector_has_a_source_node(self, graph):
        catalog = topo._yaml_load(ROOT / "platform" / "connectors" / "catalog.yaml")
        node_ids = {n["id"] for n in graph["nodes"]}
        for connector in catalog.get("connectors", []):
            assert f"src.{connector['id']}" in node_ids

    def test_every_mcp_tool_is_bound_to_an_approved_connector(self, graph):
        catalog = topo._yaml_load(ROOT / "platform" / "connectors" / "catalog.yaml")
        approved = {c["id"] for c in catalog.get("connectors", [])}
        for tool in graph["mcp_tools"]:
            assert tool["connector"] in approved, f"{tool['name']} binds an unapproved connector"

    def test_mcp_tool_count_matches_the_server(self, graph):
        sys.path.insert(0, str(ROOT))
        from platform.mcp_server import server
        assert len(graph["mcp_tools"]) == len(server.TOOLS)

    def test_gold_table_list_matches_the_pipeline_output(self, graph):
        snapshot = json.loads(
            (ROOT / "public" / "data" / "operations.json").read_text(encoding="utf-8"))
        gold = snapshot["metadata"]["gold_tables"]
        assert len(graph["tables"]) == len(gold)
        assert {t["name"] for t in graph["tables"]} == set(gold)


class TestSnapshotIntegration:
    def test_snapshot_contains_the_topology(self):
        snapshot = json.loads(
            (ROOT / "public" / "data" / "operations.json").read_text(encoding="utf-8"))
        assert "topology" in snapshot["governance"]
        assert snapshot["governance"]["topology"]["stats"]["nodes"] > 0
