"""Archetype health and drift monitor.

Answers the question the pipeline has to answer every week: which archetypes are still
worth keeping, which need extending, which should be merged, and which should be retired?

Two signals drive it:

1. **Usage signals** - request volume, human rewrite rate, gate failure rate, and the
   number of questions that reached office hours. These come from the catalog.
2. **Drift signals** - prompt growth against a recorded baseline, and the adversarial
   pass rate. Prompt bloat is the failure mode that silently degrades an archetype:
   every rule added makes the prompt longer, and past a threshold the model starts
   skipping rules rather than following all of them.

The output is a table with a recommended action per archetype. The recommendation is a
*proposal*, and the catalog records who decided what.

Usage:
    python -m monitoring.health_report            # human-readable table
    python -m monitoring.health_report --json     # machine-readable
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "archetypes" / "catalog.yaml"
SKILL_DIR = ROOT / "archetypes"

try:
    import yaml as _yaml
except ImportError:  # pragma: no cover
    _yaml = None


# Thresholds. These are policy, not measurement: the monitor detects, a person decides.
THRESHOLDS = {
    "drift_prompt_growth_pct": 15,     # prompt grew more than this vs baseline
    "rewrite_rate_high": 0.20,         # humans rewrite a fifth of the output
    "gate_failure_rate_high": 0.10,    # a tenth of runs fail a gate
    "support_questions_high": 40,      # repeated questions, not one-off usage
    "low_usage_weekly": 20,            # fewer than this per week
    "overlap_merge_pct": 0.50,         # share of requests served by another archetype
}


def load_catalog(path: Path = CATALOG_PATH) -> dict:
    if _yaml is None:
        raise RuntimeError("PyYAML is required to read the archetype catalog. "
                           "Install it with: pip install pyyaml")
    return _yaml.safe_load(path.read_text(encoding="utf-8"))


def _read_skill_bytes(relative_path: str) -> int:
    """Actual byte size of the archetype's instruction surface."""
    skill = ROOT / relative_path
    if not skill.exists():
        return 0
    total = skill.stat().st_size
    for extra in sorted(skill.parent.glob("references/*.md")):
        total += extra.stat().st_size
    return total


def evaluate(archetype: dict) -> dict:
    """Produce the health verdict for one archetype."""
    usage = archetype.get("usage") or {}
    health = archetype.get("health") or {}
    status = archetype.get("status")

    drift_pct = 0.0
    baseline = health.get("baseline_prompt_bytes") or 0
    current = health.get("prompt_bytes") or 0
    if baseline:
        drift_pct = round((current - baseline) / baseline * 100, 1)

    rewrite_rate = float(usage.get("human_rewrite_rate") or 0)
    gate_failure = float(usage.get("gate_failure_rate") or 0)
    support = int(usage.get("support_questions") or 0)
    weekly = int(usage.get("weekly_avg") or 0)

    signals: list[str] = []

    if drift_pct >= THRESHOLDS["drift_prompt_growth_pct"]:
        signals.append(f"prompt grew {drift_pct}% against baseline")
    if rewrite_rate >= THRESHOLDS["rewrite_rate_high"]:
        signals.append(f"human rewrite rate {rewrite_rate:.0%}")
    if gate_failure >= THRESHOLDS["gate_failure_rate_high"]:
        signals.append(f"gate failure rate {gate_failure:.0%}")
    if support >= THRESHOLDS["support_questions_high"]:
        signals.append(f"{support} support questions")
    if 0 < weekly < THRESHOLDS["low_usage_weekly"]:
        signals.append(f"only {weekly} requests per week")

    adversarial_rate = health.get("adversarial_pass_rate")
    if adversarial_rate is not None and adversarial_rate < 1.0:
        signals.append(f"adversarial pass rate {adversarial_rate:.0%}")

    # A retired archetype is already decided. Report it, do not re-decide it.
    if status == "retired":
        action = "retire"
        rationale = "Already retired. Kept for provenance."
    elif signals:
        # Rank by how serious the signals are.
        if drift_pct >= THRESHOLDS["drift_prompt_growth_pct"] or gate_failure >= THRESHOLDS["gate_failure_rate_high"]:
            action = "review"
            rationale = ("Needs a review before the next release. "
                         + "; ".join(signals) + ".")
        elif rewrite_rate >= THRESHOLDS["rewrite_rate_high"] or support >= THRESHOLDS["support_questions_high"]:
            action = "extend"
            rationale = ("Still useful but not landing cleanly. "
                         + "; ".join(signals) + ".")
        else:
            action = "keep"
            rationale = "Within thresholds. " + "; ".join(signals) + "."
    else:
        action = "keep"
        rationale = "Within thresholds on every signal."

    return {
        "name": archetype["name"],
        "title": archetype.get("title"),
        "status": status,
        "version": archetype.get("version"),
        "data_class": archetype.get("data_class"),
        "steward": archetype.get("steward"),
        "weekly_avg": weekly,
        "rewrite_rate": rewrite_rate,
        "gate_failure_rate": gate_failure,
        "support_questions": support,
        "prompt_bytes": current,
        "baseline_prompt_bytes": baseline,
        "drift_pct": drift_pct,
        "adversarial_pass_rate": adversarial_rate,
        "actual_skill_bytes": _read_skill_bytes(archetype["path"]),
        "signals": signals,
        "recommended_action": action,
        "rationale": rationale,
        "catalog_decision": archetype.get("decision"),
        "catalog_reason": (archetype.get("decision_reason") or "").strip(),
        "catalog_agrees": archetype.get("decision") == action,
    }


def reconcile(row: dict) -> dict:
    """Compare the monitor's proposal with the decision the catalog already records.

    A disagreement is not an error. It is the point of having a monitor: the machine
    sees the signal, the steward sees the context and decides. What must not happen is
    a silent divergence where the catalog says one thing and the monitor says another
    and nobody reconciles them, so the disagreement is surfaced explicitly.
    """
    catalog_decision = row.get("catalog_decision")
    recommended = row["recommended_action"]

    if not catalog_decision:
        status = "no-catalog-decision"
    elif catalog_decision == recommended:
        status = "aligned"
    elif catalog_decision in {"extend", "merge", "retire"} and recommended == "review":
        # A steward already acted on the signal; the monitor confirms it is real.
        status = "decided-by-steward"
    else:
        status = "unreconciled"

    return {**row, "reconciliation": status,
            "reconciliation_note": {
                "aligned": "Monitor and catalog agree.",
                "decided-by-steward": (f"Monitor flags a signal; the catalog records "
                                       f"'{catalog_decision}' with a stated reason. "
                                       f"Confirm at the next review."),
                "unreconciled": (f"Monitor proposes '{recommended}' but the catalog says "
                                 f"'{catalog_decision}'. This needs an explicit decision."),
                "no-catalog-decision": "Catalog has no recorded decision for this archetype.",
            }[status]}


def build_report() -> dict:
    catalog = load_catalog()
    rows = [reconcile(evaluate(a)) for a in catalog.get("archetypes", [])]
    action_counts: dict[str, int] = {}
    for row in rows:
        action_counts[row["recommended_action"]] = action_counts.get(row["recommended_action"], 0) + 1

    drifted = [r["name"] for r in rows if r["drift_pct"] >= THRESHOLDS["drift_prompt_growth_pct"]]
    unreconciled = [r["name"] for r in rows if r["reconciliation"] == "unreconciled"]

    return {
        "catalog_version": (catalog.get("catalog") or {}).get("version", "unknown"),
        "catalog_updated": (catalog.get("catalog") or {}).get("updated", "unknown"),
        "thresholds": THRESHOLDS,
        "archetypes": rows,
        "action_counts": action_counts,
        "drifted": drifted,
        "unreconciled": unreconciled,
        "declined": catalog.get("declined", []),
        "policy": (
            "The monitor proposes. A human decides. Retiring, merging and extending an "
            "archetype is a catalog change and requires the app steward and the "
            "archetype owner to sign it, not just a monitoring job to apply it."),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Archetype health and drift monitor")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON")
    args = parser.parse_args()

    report = build_report()

    if args.json:
        print(json.dumps(report, indent=2))
        return 0

    print(f"Archetype health report  (catalog {report['catalog_version']}, "
          f"updated {report['catalog_updated']})\n")
    header = (f"{'archetype':<28}{'status':<11}{'req/wk':>7}{'rewrite':>9}"
              f"{'gatefail':>9}{'drift':>8}  {'action':<8} {'reconciliation':<20} signals")
    print(header)
    print("-" * len(header))
    for row in report["archetypes"]:
        drift = f"{row['drift_pct']:+.1f}%"
        print(f"{row['name']:<28}{row['status']:<11}{row['weekly_avg']:>7}"
              f"{row['rewrite_rate']:>9.0%}{row['gate_failure_rate']:>9.0%}"
              f"{drift:>8}  {row['recommended_action']:<8} {row['reconciliation']:<20} "
              f"{'; '.join(row['signals']) or 'within thresholds'}")

    print(f"\nActions proposed: {report['action_counts']}")
    if report["drifted"]:
        print(f"Prompt bloat detected in: {', '.join(report['drifted'])}")
    if report["unreconciled"]:
        print(f"Unreconciled with catalog: {', '.join(report['unreconciled'])}")
    print(f"\n{report['policy']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
