"""Enrich the public snapshot with governance artifacts for the web layer.

The portal must render facts that are backed by files in this repository, not
hand-written copy. This script reads the archetype catalog, the connector catalog, the
adversarial suite, the guardrail self-test and the quality checks, and writes one
combined snapshot the Next.js app reads.

Run after `scripts/build_pipeline.py`:
    python -m scripts.build_portal_snapshot
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

SNAPSHOT_PATH = ROOT / "public" / "data" / "operations.json"

try:
    import yaml as _yaml
except ImportError:  # pragma: no cover
    _yaml = None


def _load_yaml(path: Path) -> dict:
    if _yaml is None:
        raise RuntimeError("PyYAML is required to build the portal snapshot. "
                           "Install it with: pip install pyyaml")
    return _yaml.safe_load(path.read_text(encoding="utf-8"))


def _run_json(module: str) -> dict:
    result = subprocess.run(
        [sys.executable, "-m", module, "--json"],
        capture_output=True, text=True, cwd=ROOT)
    if result.returncode != 0 and not result.stdout.strip():
        return {"error": result.stderr.strip()[-400:]}
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return {"error": "could not parse module output"}


def build() -> dict:
    snapshot = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))

    catalog = _load_yaml(ROOT / "archetypes" / "catalog.yaml")
    connectors = _load_yaml(ROOT / "platform" / "connectors" / "catalog.yaml")
    health = _run_json("monitoring.health_report")
    adversarial = _run_json("security.adversarial.run_suite")
    catalog_validation = _run_json("monitoring.validate_catalog")

    snapshot["governance"] = {
        "archetype_catalog": {
            "version": (catalog.get("catalog") or {}).get("version", "unknown"),
            "updated": (catalog.get("catalog") or {}).get("updated", "unknown"),
            "archetypes": catalog.get("archetypes", []),
            "declined": catalog.get("declined", []),
        },
        "connector_catalog": {
            "version": (connectors.get("catalog") or {}).get("version", "unknown"),
            "updated": (connectors.get("catalog") or {}).get("updated", "unknown"),
            "connectors": connectors.get("connectors", []),
            "pending": connectors.get("pending", []),
            "policy": connectors.get("policy", []),
        },
        "health": health,
        "adversarial": adversarial,
        "catalog_validation": catalog_validation,
    }

    snapshot["metadata"]["artifacts"] = {
        "archetypes": len(catalog.get("archetypes", [])),
        "connectors": len(connectors.get("connectors", [])),
        "connectors_pending": len(connectors.get("pending", [])),
        "archetypes_declined": len(catalog.get("declined", [])),
        "adversarial_cases": adversarial.get("total", 0),
        "adversarial_passed": adversarial.get("passed", 0),
        "quality_checks": len(snapshot.get("quality", [])),
        "quality_passed": sum(1 for c in snapshot.get("quality", []) if c["status"] == "PASS"),
    }

    SNAPSHOT_PATH.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
    return snapshot


def main() -> int:
    snapshot = build()
    artifacts = snapshot["metadata"]["artifacts"]
    print(f"Portal snapshot written: {SNAPSHOT_PATH}")
    print(f"  archetypes: {artifacts['archetypes']} "
          f"(+{artifacts['archetypes_declined']} declined)")
    print(f"  connectors: {artifacts['connectors']} approved, "
          f"{artifacts['connectors_pending']} pending")
    print(f"  adversarial cases: {artifacts['adversarial_passed']}/{artifacts['adversarial_cases']}")
    print(f"  quality checks: {artifacts['quality_passed']}/{artifacts['quality_checks']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())