"""Tests for the Topgolf venue-operations pipeline.

These verify the data contract the rest of the repository depends on: the Gold layer
is dimensional and conformed, the quality checks actually execute, the reported
snapshot matches the Gold tables, and the policy rules hold at the data level.
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts import build_pipeline as pipeline  # noqa: E402

GOLD = ROOT / "data" / "gold"
SILVER = ROOT / "data" / "silver"
SNAPSHOT = ROOT / "public" / "data" / "operations.json"


@pytest.fixture(scope="module")
def snapshot():
    return json.loads(SNAPSHOT.read_text(encoding="utf-8"))


def _rows(name: str) -> list[dict]:
    with (GOLD / name).open(encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


class TestGoldLayer:
    def test_all_expected_gold_tables_exist(self):
        expected = {
            "dim_venue.csv", "dim_date.csv", "dim_membership_tier.csv", "dim_guest.csv",
            "fact_visit.csv", "fact_membership.csv", "fact_campaign.csv",
            "fact_incident.csv", "fact_venue_day.csv",
        }
        present = {p.name for p in GOLD.glob("*.csv")}
        assert expected <= present, f"missing: {expected - present}"

    def test_keys_are_unique_and_non_null(self):
        for table, key in [
            ("dim_venue.csv", "venue_key"),
            ("dim_date.csv", "date_key"),
            ("dim_guest.csv", "guest_key"),
            ("fact_visit.csv", "visit_key"),
            ("fact_membership.csv", "membership_key"),
            ("fact_campaign.csv", "campaign_key"),
            ("fact_incident.csv", "incident_key"),
        ]:
            values = [row[key] for row in _rows(table)]
            assert all(v not in (None, "") for v in values), f"{table}.{key} has nulls"
            assert len(values) == len(set(values)), f"{table}.{key} is not unique"

    def test_venue_day_grain_is_one_row_per_venue_per_day(self):
        rows = _rows("fact_venue_day.csv")
        grains = [(r["venue_key"], r["date_key"]) for r in rows]
        assert len(grains) == len(set(grains))

    def test_facts_resolve_to_conformed_dimensions(self):
        venue_keys = {r["venue_key"] for r in _rows("dim_venue.csv")}
        guest_keys = {r["guest_key"] for r in _rows("dim_guest.csv")}
        date_keys = {r["date_key"] for r in _rows("dim_date.csv")}

        for row in _rows("fact_visit.csv"):
            assert row["guest_key"] in guest_keys
            assert row["venue_key"] in venue_keys
            assert row["date_key"] in date_keys

    def test_date_dimension_is_continuous_across_the_window(self):
        rows = sorted(_rows("dim_date.csv"), key=lambda r: r["full_date"])
        assert len(rows) == pipeline.COVERAGE_DAYS
        first = pipeline.date.fromisoformat(rows[0]["full_date"])
        last = pipeline.date.fromisoformat(rows[-1]["full_date"])
        assert (last - first).days == pipeline.COVERAGE_DAYS - 1

    def test_revenue_reconciles_between_silver_and_gold(self):
        with (SILVER / "visits.csv").open(encoding="utf-8") as fh:
            silver_total = round(sum(float(r["check_total"]) for r in csv.DictReader(fh)), 2)
        gold_total = round(sum(float(r["revenue"]) for r in _rows("fact_venue_day.csv")), 2)
        assert silver_total == gold_total


class TestQualityChecks:
    def test_every_quality_check_passes(self, snapshot):
        failures = [c for c in snapshot["quality"] if c["status"] != "PASS"]
        assert not failures, f"failing checks: {[c['name'] for c in failures]}"

    def test_quality_checks_have_observed_values(self, snapshot):
        for check in snapshot["quality"]:
            assert check["observed"], f"{check['name']} has no observed value"
            assert check["description"], f"{check['name']} has no description"

    def test_check_count_matches_the_suite(self, snapshot):
        assert len(snapshot["quality"]) >= 15


class TestPolicyRules:
    def test_minors_are_never_marketing_consented(self):
        minors = [r for r in _rows("dim_guest.csv") if r["age_band"] == "13-17"]
        assert minors, "expected minors in the fixture"
        for row in minors:
            assert row["consented_email"] == "no"

    def test_campaign_funnel_is_monotonic(self):
        for row in _rows("fact_campaign.csv"):
            sends = int(row["sends"])
            assert int(row["opens"]) <= sends
            assert int(row["clicks"]) <= sends
            assert int(row["bookings"]) <= int(row["clicks"])
            assert int(row["opt_outs"]) <= sends

    def test_cost_per_booking_is_zero_only_when_there_are_no_bookings(self):
        for row in _rows("fact_campaign.csv"):
            if int(row["bookings"]) == 0:
                assert float(row["cost_per_booking"]) == 0.0
            else:
                assert float(row["cost_per_booking"]) > 0


class TestSnapshot:
    def test_snapshot_declares_itself_synthetic(self, snapshot):
        assert snapshot["metadata"]["synthetic"] is True
        assert "synthetic" in snapshot["metadata"]["disclaimer"].lower()
        assert "not topgolf data" in snapshot["metadata"]["disclaimer"].lower()

    def test_snapshot_contains_the_governance_block(self, snapshot):
        """The web layer renders from this file, so the governance block must survive.

        The pipeline and the portal snapshot builder both write this file. A rebuild
        that drops the governance block silently breaks the portal build, so it is
        asserted here rather than discovered by a reviewer.
        """
        assert "governance" in snapshot, "governance block missing from the snapshot"
        governance = snapshot["governance"]
        for key in ("archetype_catalog", "connector_catalog", "health",
                    "adversarial", "catalog_validation"):
            assert key in governance, f"governance.{key} missing"

    def test_snapshot_artifacts_counts_are_present(self, snapshot):
        artifacts = snapshot["metadata"].get("artifacts")
        assert artifacts, "artifact counts missing from snapshot metadata"
        assert artifacts["archetypes"] >= 1
        assert artifacts["adversarial_cases"] >= 1

    def test_pipeline_rebuild_preserves_the_governance_block(self, snapshot):
        """Rebuilding the pipeline must not strip the governance block."""
        before = json.dumps(snapshot["governance"], sort_keys=True)
        pipeline.main()
        after = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
        assert "governance" in after, "pipeline rebuild stripped the governance block"
        assert json.dumps(after["governance"], sort_keys=True) == before

    def test_snapshot_kpis_match_the_gold_tables(self, snapshot):
        assert snapshot["kpis"]["total_visits"] == len(_rows("fact_visit.csv"))
        assert snapshot["kpis"]["venues"] == len(_rows("dim_venue.csv"))
        assert snapshot["kpis"]["active_members"] == sum(
            1 for r in _rows("fact_membership.csv") if r["status"] == "active")

    def test_snapshot_venue_rows_match_gold_venue_count(self, snapshot):
        assert len(snapshot["venues"]) == len(_rows("dim_venue.csv"))

    def test_snapshot_monthly_series_covers_the_window(self, snapshot):
        months = [row["month"] for row in snapshot["monthly"]]
        assert months == sorted(months)
        assert len(months) == len({m[:7] for m in months})

    def test_metric_catalog_entries_are_complete(self, snapshot):
        for metric in snapshot["metric_catalog"]:
            for field in ("name", "formula", "description", "grain", "owner", "caveat"):
                assert metric.get(field), f"{metric.get('name')} missing {field}"


class TestDeterminism:
    def test_regenerating_produces_identical_gold(self, tmp_path):
        """The pipeline must be reproducible, or the quality checks are meaningless."""
        import csv as _csv
        import hashlib

        def digest(directory: Path) -> str:
            hasher = hashlib.sha256()
            for path in sorted(directory.glob("*.csv")):
                hasher.update(path.name.encode())
                hasher.update(path.read_bytes())
            return hasher.hexdigest()

        original = digest(GOLD)
        pipeline.main()
        assert digest(GOLD) == original, "pipeline is not deterministic for a fixed seed"

    def test_seed_is_pinned(self):
        assert pipeline.SEED == 1847
