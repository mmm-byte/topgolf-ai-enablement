"""Tests for the archetype scaffold script.

The scaffold is the entry point for a non-technical builder, so the things it must
refuse matter as much as the things it generates.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

SCAFFOLD_DIR = ROOT / "archetypes" / "shift-handover" / "scripts"
sys.path.insert(0, str(SCAFFOLD_DIR))

import importlib.util  # noqa: E402

spec = importlib.util.spec_from_file_location("scaffold", SCAFFOLD_DIR / "scaffold.py")
scaffold = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scaffold)


def test_generated_archetype_has_every_expected_file(tmp_path):
    target = scaffold.scaffold(
        "test-archetype", "Test archetype", "internal-aggregated",
        "analytics.readonly", tmp_path)

    expected = {
        "SKILL.md", "spec.md", "guardrails.json",
        "references/intake-answers.md", "tests/test_test_archetype.py",
    }
    actual = {str(p.relative_to(target)) for p in target.rglob("*") if p.is_file()}
    assert expected <= actual


def test_generated_skill_md_has_required_frontmatter(tmp_path):
    target = scaffold.scaffold(
        "fm-archetype", "FM archetype", "internal-aggregated",
        "analytics.readonly", tmp_path)
    text = (target / "SKILL.md").read_text(encoding="utf-8")
    assert text.startswith("---")
    frontmatter = text.split("---")[1]
    for field in ("name:", "description:", "data-class:", "connector:", "status:", "version:"):
        assert field in frontmatter


def test_generated_guardrail_manifest_is_valid_json(tmp_path):
    target = scaffold.scaffold(
        "json-archetype", "JSON archetype", "public",
        "venue.directory", tmp_path)
    manifest = json.loads((target / "guardrails.json").read_text(encoding="utf-8"))
    assert manifest["data-class"] == "public"
    assert "allowed-fields" in manifest
    assert "never-read-fields" in manifest


def test_invalid_name_is_refused(tmp_path):
    with pytest.raises(SystemExit):
        scaffold.scaffold("Not A Valid Name", "X", "public",
                          "venue.directory", tmp_path)


def test_invalid_data_class_is_refused(tmp_path):
    with pytest.raises(SystemExit):
        scaffold.scaffold("ok-name", "X", "not-a-class",
                          "venue.directory", tmp_path)


def test_unapproved_connector_is_refused(tmp_path):
    with pytest.raises(SystemExit):
        scaffold.scaffold("ok-name", "X", "public",
                          "totally.made.up", tmp_path)


def test_existing_directory_is_not_overwritten(tmp_path):
    scaffold.scaffold("dup-name", "X", "public", "venue.directory", tmp_path)
    with pytest.raises(SystemExit):
        scaffold.scaffold("dup-name", "X", "public", "venue.directory", tmp_path)
