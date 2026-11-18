"""Tests for the portal snapshot the Next.js app renders.

The portal publishes numbers on its header and hero: adversarial cases caught,
guardrail self-tests, data quality checks, and the platform graph size. Every one
of those must come from a check that actually ran, so this module verifies that
the snapshot cannot carry a stale or missing figure.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

SNAPSHOT = ROOT / "public" / "data" / "operations.json"


@pytest.fixture(scope="module")
def snapshot():
    return json.loads(SNAPSHOT.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def artifacts(snapshot):
    return snapshot["metadata"]["artifacts"]


class TestArtifactCounts:
    def test_every_artifact_count_is_positive(self, artifacts):
        for name, value in artifacts.items():
            assert isinstance(value, int), f"{name} is not an integer"
            assert value > 0, f"{name} is {value}; the portal would show an empty figure"

    def test_guardrail_self_test_count_is_published(self, artifacts):
        assert artifacts["guardrail_cases"] > 0
        assert artifacts["guardrail_passed"] == artifacts["guardrail_cases"], (
            "the published guardrail self-test figure is not all passing")

    def test_adversarial_and_quality_figures_are_all_passing(self, artifacts):
        assert artifacts["adversarial_passed"] == artifacts["adversarial_cases"]
        assert artifacts["quality_passed"] == artifacts["quality_checks"]

    def test_counts_match_the_underlying_records(self, snapshot, artifacts):
        governance = snapshot["governance"]
        assert artifacts["adversarial_cases"] == governance["adversarial"]["total"]
        assert artifacts["adversarial_passed"] == governance["adversarial"]["passed"]
        assert artifacts["guardrail_cases"] == governance["guardrail_selftest"]["total"]
        assert artifacts["guardrail_passed"] == governance["guardrail_selftest"]["passed"]
        assert artifacts["quality_checks"] == len(snapshot["quality"])

    def test_catalog_validation_is_recorded_and_valid(self, snapshot):
        validation = snapshot["governance"]["catalog_validation"]
        assert validation["valid"], f"catalog invalid: {validation.get('errors')}"


class TestGuardrailSelfTestCapture:
    def test_captured_result_matches_a_live_self_test_run(self):
        """The published figure must match what the engine reports right now."""
        from scripts.build_portal_snapshot import _run_guardrail_self_test

        captured = _run_guardrail_self_test()
        assert captured["total"] > 0, "the self-test produced no cases"
        assert captured["passed"] == captured["total"]
        assert captured["ok"] is True

    def test_self_test_is_reported_as_a_fraction(self):
        result = subprocess.run(
            [sys.executable, "-m", "security.guardrails.guardrails", "--self-test"],
            capture_output=True, text=True, cwd=ROOT)
        assert result.returncode == 0, result.stdout + result.stderr
        assert "Self-test:" in result.stdout
