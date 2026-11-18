"""Scaffold a new archetype from the catalog conventions.

This is the entry point for a non-technical builder. It generates a complete archetype
folder: the SKILL.md skeleton with the right frontmatter, a spec.md from the template,
a guardrail manifest, and a test file wired to the adversarial suite.

The point is that a builder fills in the blanks and the result is already gated, rather
than writing something from scratch and discovering the gates later.

Usage:
    python archetypes/shift-handover/scripts/scaffold.py --name my-archetype \
        --title "My archetype" --data-class internal-aggregated --connector analytics.readonly
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CATALOG = ROOT / "archetypes" / "catalog.yaml"
CONNECTORS = ROOT / "aiplatform" / "connectors" / "catalog.yaml"

try:
    import yaml as _yaml
except ImportError:  # pragma: no cover
    _yaml = None

VALID_CLASSES = {"public", "internal-aggregated", "internal-personal", "restricted"}

SKILL_TEMPLATE = """---
name: {name}
description: TODO — describe in one sentence what this archetype produces and when to use it. Include the trigger phrases a user would actually type.
allowed-tools: Read, Grep
data-class: {data_class}
connector: {connector}
version: 0.1.0
owner: TODO — owning team
data-owner: TODO — named data owner, not a department
status: draft
last-reviewed: {today}
---

# {title}

TODO — one paragraph: what this archetype produces, and who uses it.

## What it produces

TODO — the exact format. Not a topic, a format.

## Preconditions

TODO — what must be present before this archetype runs, and what happens when it is missing.

## Hard rules

TODO — numbered, falsifiable rules. Each one must map to a case in the adversarial
suite and, where possible, to a guardrail assertion. A rule that cannot fail is not a
rule.

1. **Scope.** This archetype reads only the fields declared in `guardrails.json`.
2. **No speculation.** State only what the source records.
3. **Human decisions stay human.** Anything involving safety, money, refunds, credits or
   guest communication is routed to a person.

## Failure modes to refuse

| Input | Correct behaviour |
|---|---|
| TODO | TODO |

## Escalation

| Condition | Route to |
|---|---|
| Security or guest safety finding | Security |
| Data class or consent finding | Data owner |
| Scope or correctness finding | App steward |

## Related

- [Intake questionnaire](../../references/intake-questionnaire.md)
- [Spec template](../../references/spec-template.md)
- [Guardrails](../../references/guardrails.md)
"""

GUARDRAILS_TEMPLATE = """{{
  "name": "{name}",
  "data-class": "{data_class}",
  "allowed-fields": [],
  "never-read-fields": [],
  "output": {{
    "type": "text",
    "prohibited_patterns": ["email_address", "external_url", "credit_card"]
  }},
  "policy": {{
    "enabled": false
  }}
}}
"""

SPEC_TEMPLATE = """# Spec: {title}

## 1. Outcome
TODO — one sentence, written from the user's side.

## 2. User
- **Role:** TODO
- **Frequency:** TODO
- **Current process:** TODO
- **Without this archetype they:** TODO

## 3. Inputs
| Source | Connector | Fields read | Data class | Must never read |
|---|---|---|---|---|
| TODO | {connector} | TODO | {data_class} | TODO |

**Preconditions:** TODO
**Missing precondition behaviour:** TODO

## 4. Output contract
**Format:** TODO
**Length:** TODO
**Must never contain:** TODO
**Human decisions retained:** TODO

## 5. Rules
TODO

## 6. Failure handling
| Condition | Behaviour |
|---|---|
| TODO | TODO |

## 7. Escalation
| Finding type | Severity | Route to | Response time |
|---|---|---|---|
| TODO | S2 | TODO | TODO |

## 8. Release gate
- [ ] Unit tests pass
- [ ] Output schema validation passes
- [ ] Secrets scan clean
- [ ] Scope check passes
- [ ] Adversarial suite passes
- [ ] Human review complete
- [ ] One week in staging with logged output
- [ ] App steward assigned
- [ ] Review date set

## 9. Success measures
| Measure | Baseline | Target | How measured |
|---|---|---|---|
| TODO | TODO | TODO | TODO |

## 10. Retirement criteria
TODO — what usage or escalation pattern means this archetype should be extended, merged
into another, or retired.

## 11. Sign-off
| Role | Name | Date |
|---|---|---|
| Author | | |
| Reviewer | | |
| App steward | | |
| Data owner | | |
"""

TEST_TEMPLATE = '''"""Tests for the {name} archetype.

The generated tests prove the guardrail manifest is wired correctly. Add archetype
specific cases below.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT))

from security.guardrails.guardrails import run_guardrails  # noqa: E402

MANIFEST = json.loads((ROOT / "archetypes" / "{name}" / "guardrails.json").read_text(encoding="utf-8"))


def test_manifest_declares_a_data_class():
    assert MANIFEST["data-class"] in {{"public", "internal-aggregated", "internal-personal", "restricted"}}


def test_manifest_has_an_allowlist_and_denylist():
    assert "allowed-fields" in MANIFEST
    assert "never-read-fields" in MANIFEST


def test_never_read_fields_are_not_also_allowed():
    overlap = set(MANIFEST["allowed-fields"]) & set(MANIFEST["never-read-fields"])
    assert not overlap, "a field cannot be both allowed and never-read: " + str(overlap)


def test_empty_output_passes_the_guardrail():
    result = run_guardrails(MANIFEST, "ok", None, None, set())
    assert not result.blocked
'''


def _load_catalog_ids(path: Path, key: str) -> list[str]:
    if _yaml is None:
        raise RuntimeError("PyYAML is required. Install it with: pip install pyyaml")
    data = _yaml.safe_load(path.read_text(encoding="utf-8"))
    return [c["id"] for c in (data.get(key) or [])]


def scaffold(name: str, title: str, data_class: str, connector: str,
             output_dir: Path, owner: str = "", data_owner: str = "") -> Path:
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", name):
        raise SystemExit(
            f"'{name}' is not a valid archetype name. Use lowercase words separated by "
            f"hyphens, for example 'guest-frequency-anomaly'.")

    if data_class not in VALID_CLASSES:
        raise SystemExit(
            f"'{data_class}' is not a valid data class. Choose one of: "
            f"{', '.join(sorted(VALID_CLASSES))}.")

    known_connectors = _load_catalog_ids(CONNECTORS, "connectors")
    if connector not in known_connectors:
        raise SystemExit(
            f"Connector '{connector}' is not in the approved connector catalog.\n"
            f"Approved connectors: {', '.join(known_connectors)}\n"
            f"Adding a connector is a platform request, not an archetype request.")

    target = output_dir / name
    if target.exists():
        raise SystemExit(f"'{target}' already exists. Pick another name or remove it first.")

    (target / "references").mkdir(parents=True)
    (target / "scripts").mkdir()
    (target / "tests").mkdir()

    from datetime import date
    today = date.today().isoformat()

    skill = SKILL_TEMPLATE.format(name=name, title=title, data_class=data_class,
                                   connector=connector, today=today)
    (target / "SKILL.md").write_text(skill, encoding="utf-8")
    (target / "spec.md").write_text(SPEC_TEMPLATE.format(title=title, connector=connector,
                                                         data_class=data_class), encoding="utf-8")
    (target / "guardrails.json").write_text(
        GUARDRAILS_TEMPLATE.format(name=name, data_class=data_class), encoding="utf-8")
    (target / "tests" / f"test_{name.replace('-', '_')}.py").write_text(
        TEST_TEMPLATE.format(name=name), encoding="utf-8")
    (target / "references" / "intake-answers.md").write_text(
        f"# Intake answers: {title}\n\n"
        f"Answer every question in the shared intake questionnaire before this archetype\n"
        f"is used against real data.\n\n"
        f"- **Data class:** {data_class}\n"
        f"- **Connector:** {connector}\n"
        f"- **Owner:** {owner or 'TODO'}\n"
        f"- **Data owner:** {data_owner or 'TODO'}\n"
        f"- **App steward:** TODO\n\n"
        f"Copy the question list from `archetypes/references/intake-questionnaire.md` and\n"
        f"fill in the answers here.\n", encoding="utf-8")

    return target


def main() -> int:
    parser = argparse.ArgumentParser(description="Scaffold a new archetype")
    parser.add_argument("--name", required=True, help="kebab-case archetype name")
    parser.add_argument("--title", required=True, help="Human readable title")
    parser.add_argument("--data-class", required=True, choices=sorted(VALID_CLASSES))
    parser.add_argument("--connector", required=True, help="Must exist in the connector catalog")
    parser.add_argument("--owner", default="")
    parser.add_argument("--data-owner", default="")
    parser.add_argument("--output-dir", default=str(ROOT / "archetypes"))
    args = parser.parse_args()

    target = scaffold(args.name, args.title, args.data_class, args.connector,
                      Path(args.output_dir), args.owner, args.data_owner)

    print(f"Archetype scaffolded: {target}")
    print("\nNext steps:")
    print(f"  1. Answer the intake questions in {target.name}/references/intake-answers.md")
    print(f"  2. Fill in the rules in {target.name}/SKILL.md")
    print(f"  3. Declare the fields in {target.name}/guardrails.json")
    print(f"  4. Add the archetype to archetypes/catalog.yaml with status 'draft'")
    print(f"  5. Run: python -m monitoring.validate_catalog")
    return 0


if __name__ == "__main__":
    sys.exit(main())
