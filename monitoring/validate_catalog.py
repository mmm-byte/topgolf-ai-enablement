"""Catalog integrity checks.

The archetype catalog is the source of truth for what exists and who owns it. If the
catalog drifts from the repository, every other artifact in it becomes unreliable:
the health monitor reads it, the portal renders it, and the pipeline gates against it.

This validates that the catalog and the files on disk agree.

Usage:
    python -m monitoring.validate_catalog
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "archetypes" / "catalog.yaml"

try:
    import yaml as _yaml
except ImportError:  # pragma: no cover
    _yaml = None

VALID_STATUSES = {"draft", "pilot", "active", "deprecated", "retired"}
VALID_ACTIONS = {"keep", "extend", "merge", "review", "retire"}
VALID_DATA_CLASSES = {"public", "internal-aggregated", "internal-personal", "restricted"}


def validate() -> dict:
    if _yaml is None:
        raise RuntimeError("PyYAML is required to validate the archetype catalog. "
                           "Install it with: pip install pyyaml")

    catalog = _yaml.safe_load(CATALOG_PATH.read_text(encoding="utf-8"))
    errors: list[str] = []
    warnings: list[str] = []
    names: set[str] = set()

    archetypes = catalog.get("archetypes") or []
    if not archetypes:
        errors.append("catalog has no archetypes")

    for archetype in archetypes:
        name = archetype.get("name", "<unnamed>")
        if name in names:
            errors.append(f"{name}: duplicate archetype name")
        names.add(name)

        for required in ("name", "title", "path", "status", "version",
                         "data_class", "connector", "owner", "data_owner",
                         "steward", "usage", "health", "decision"):
            if required not in archetype:
                errors.append(f"{name}: missing required field '{required}'")

        status = archetype.get("status")
        if status and status not in VALID_STATUSES:
            errors.append(f"{name}: status '{status}' is not one of {sorted(VALID_STATUSES)}")

        data_class = archetype.get("data_class")
        if data_class and data_class not in VALID_DATA_CLASSES:
            errors.append(f"{name}: data_class '{data_class}' is not one of "
                          f"{sorted(VALID_DATA_CLASSES)}")

        decision = archetype.get("decision")
        if decision and decision not in VALID_ACTIONS:
            errors.append(f"{name}: decision '{decision}' is not one of {sorted(VALID_ACTIONS)}")

        path = archetype.get("path")
        if path:
            skill = ROOT / path
            if not skill.exists():
                errors.append(f"{name}: declared path does not exist: {path}")
            elif skill.name != "SKILL.md":
                errors.append(f"{name}: archetype must be a SKILL.md file, found {skill.name}")
            else:
                text = skill.read_text(encoding="utf-8")
                if not text.startswith("---"):
                    errors.append(f"{name}: SKILL.md has no YAML frontmatter")
                else:
                    frontmatter = text.split("---")[1]
                    for field in ("name:", "description:", "data-class:", "status:", "version:"):
                        if field not in frontmatter:
                            errors.append(f"{name}: SKILL.md frontmatter missing '{field}'")

        if archetype.get("status") in {"active", "pilot"}:
            if not archetype.get("next_review"):
                errors.append(f"{name}: an active or pilot archetype must have a next_review date")
            if not archetype.get("decision_accepted_by"):
                warnings.append(f"{name}: no recorded decision owner")

        usage = archetype.get("usage") or {}
        rewrite = usage.get("human_rewrite_rate")
        if rewrite is not None and not 0 <= rewrite <= 1:
            errors.append(f"{name}: human_rewrite_rate must be between 0 and 1")
        gate_failure = usage.get("gate_failure_rate")
        if gate_failure is not None and not 0 <= gate_failure <= 1:
            errors.append(f"{name}: gate_failure_rate must be between 0 and 1")

        health = archetype.get("health") or {}
        baseline = health.get("baseline_prompt_bytes")
        current = health.get("prompt_bytes")
        if baseline and current and current < baseline:
            warnings.append(f"{name}: prompt is smaller than its baseline; confirm the "
                            f"baseline was reset")

    for archetype in archetypes:
        if archetype.get("status") == "retired":
            if not archetype.get("superseded_by"):
                errors.append(f"{archetype['name']}: a retired archetype must name its successor")
            elif archetype["superseded_by"] not in names:
                errors.append(f"{archetype['name']}: successor '{archetype['superseded_by']}' "
                              f"is not in the catalog")
            if not archetype.get("retired_on"):
                errors.append(f"{archetype['name']}: a retired archetype needs a retired_on date")
            if not archetype.get("retirement_reason"):
                errors.append(f"{archetype['name']}: a retired archetype needs a retirement_reason")

    for declined in catalog.get("declined") or []:
        if not declined.get("reason"):
            errors.append(f"declined '{declined.get('name')}': missing reason")
        if not declined.get("route"):
            errors.append(f"declined '{declined.get('name')}': missing route")

    connector_catalog_path = ROOT / "platform" / "connectors" / "catalog.yaml"
    if connector_catalog_path.exists():
        connector_catalog = _yaml.safe_load(connector_catalog_path.read_text(encoding="utf-8"))
        known = {c["id"] for c in (connector_catalog.get("connectors") or [])}
        for archetype in archetypes:
            connector = archetype.get("connector")
            if connector and connector not in known:
                errors.append(f"{archetype['name']}: connector '{connector}' is not in the "
                              f"approved connector catalog")

    return {
        "catalog_version": (catalog.get("catalog") or {}).get("version", "unknown"),
        "archetypes": len(archetypes),
        "declined": len(catalog.get("declined") or []),
        "errors": errors,
        "warnings": warnings,
        "valid": not errors,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate the archetype catalog")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON")
    args = parser.parse_args()

    report = validate()

    if args.json:
        print(json.dumps(report, indent=2))
        return 0 if report["valid"] else 1

    for warning in report["warnings"]:
        print(f"  [WARN] {warning}")

    if report["valid"]:
        print(f"Catalog valid: {report['archetypes']} archetypes, "
              f"{report['declined']} declined, version {report['catalog_version']}")
        return 0

    print(f"Catalog invalid: {len(report['errors'])} error(s)\n")
    for error in report["errors"]:
        print(f"  [ERROR] {error}")
    return 1


if __name__ == "__main__":
    sys.exit(main())