"""Guardrail engine for archetype output.

Deterministic, dependency-free checks that run in CI on every pull request. The
engine is deliberately conservative: it fails closed. When it cannot prove an output is
safe, it reports the finding rather than passing it.

Check classes implemented here mirror `archetypes/references/guardrails.md`:

    scope    - declared readable fields vs fields actually touched
    output   - structure, length bounds, prohibited content
    policy   - output set vs data-class policy (e.g. minors never targeted)

Usage:
    python -m security.guardrails.guardrails --output out.json --archetype <name>
    python -m security.guardrails.guardrails --self-test
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GOLD = ROOT / "data" / "gold"

SEVERITY_ORDER = {"S1": 1, "S2": 2, "S3": 3, "S4": 4}
BLOCKING_SEVERITIES = {"S1", "S2"}


@dataclass
class Finding:
    check: str
    severity: str
    message: str
    detail: str = ""

    def as_dict(self) -> dict:
        return {"check": self.check, "severity": self.severity,
                "message": self.message, "detail": self.detail}


@dataclass
class GuardrailResult:
    findings: list[Finding] = field(default_factory=list)
    checks_run: list[str] = field(default_factory=list)

    @property
    def blocked(self) -> bool:
        return any(f.severity in BLOCKING_SEVERITIES for f in self.findings)

    @property
    def max_severity(self) -> str | None:
        if not self.findings:
            return None
        return min((f.severity for f in self.findings), key=lambda s: SEVERITY_ORDER[s])

    def as_dict(self) -> dict:
        return {
            "checks_run": self.checks_run,
            "findings": [f.as_dict() for f in self.findings],
            "blocked": self.blocked,
            "finding_count": len(self.findings),
            "max_severity": self.max_severity,
        }


# ---------------------------------------------------------------------------
# Reference data loaded from the Gold layer
# ---------------------------------------------------------------------------

def _read_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def load_guest_identifiers() -> dict:
    """Guest identifiers that must never appear in generated output."""
    names, emails = set(), set()
    for row in _read_csv(GOLD / "dim_guest.csv"):
        guest_id = row.get("guest_id", "")
        if guest_id:
            names.add(guest_id)
    return {"guest_ids": names, "emails": emails}


# Guest name shapes appear in synthetic incident narratives; the checker detects
# capitalised two-token sequences that match a known-name list plus explicit
# email/phone/card patterns.
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"(?<!\d)(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?!\d)")
CARD_RE = re.compile(r"(?<!\d)(?:\d[ -]*?){13,16}(?!\d)")
URL_RE = re.compile(r"https?://[^\s)>\]]+", re.IGNORECASE)


# ---------------------------------------------------------------------------
# Check: scope
# ---------------------------------------------------------------------------

def check_scope(archetype: dict, touched_fields: list[str] | None, result: GuardrailResult) -> None:
    """Compare the fields actually touched against the archetype's declared read set.

    `touched_fields` of None means scope tracking was not enabled for this run, so
    only the denylist direction can be checked. An empty list means tracking was
    enabled and nothing was read.
    """
    result.checks_run.append("scope")
    declared = set(archetype.get("allowed-fields") or [])
    never_read = set(archetype.get("never-read-fields") or [])

    if touched_fields is None:
        return

    touched = set(touched_fields)

    violations = touched & never_read
    for field_name in sorted(violations):
        severity = "S1" if archetype.get("data-class") in {"internal-personal", "restricted"} else "S2"
        result.findings.append(Finding(
            check="scope", severity=severity,
            message=f"Field '{field_name}' is on the never-read list but was accessed",
            detail=f"archetype={archetype.get('name')} data-class={archetype.get('data-class')}"))

    undeclared = touched - declared - never_read
    for field_name in sorted(undeclared):
        result.findings.append(Finding(
            check="scope", severity="S3",
            message=f"Field '{field_name}' was accessed but is not declared in the archetype",
            detail="Add it to allowed-fields if intentional, otherwise fix the archetype."))

    if declared and not touched:
        result.findings.append(Finding(
            check="scope", severity="S4",
            message="Archetype declares readable fields but nothing was read",
            detail="Either the archetype is miswired or the run was empty."))


# ---------------------------------------------------------------------------
# Check: output structure and prohibited content
# ---------------------------------------------------------------------------

def check_output(archetype: dict, output: str, result: GuardrailResult,
                 known_guest_ids: set[str] | None = None) -> None:
    """Validate output structure, length bounds and prohibited content."""
    result.checks_run.append("output")
    spec = archetype.get("output") or {}
    data_class = archetype.get("data-class", "public")

    text = output or ""

    if spec.get("type") == "lines":
        lines = [ln for ln in text.splitlines() if ln.strip()]
        expected = spec.get("count")
        if expected is not None and len(lines) != expected:
            result.findings.append(Finding(
                check="output", severity="S3",
                message=f"Expected {expected} output lines, found {len(lines)}",
                detail="; ".join(ln[:60] for ln in lines)))

        max_words = spec.get("max_words_per_line")
        if max_words:
            for idx, line in enumerate(lines, start=1):
                count = len(line.split())
                if count > max_words:
                    result.findings.append(Finding(
                        check="output", severity="S3",
                        message=f"Line {idx} has {count} words, limit is {max_words}",
                        detail=line[:120]))

    prohibited = set(spec.get("prohibited_patterns") or [])
    for pattern in sorted(prohibited):
        severity = "S2"
        if pattern == "guest_name" and data_class in {"internal-personal", "restricted"}:
            severity = "S1"

        if pattern == "guest_name":
            if known_guest_ids:
                hits = sorted({gid for gid in known_guest_ids if gid in text})
                if hits:
                    result.findings.append(Finding(
                        check="output", severity=severity,
                        message=f"Output contains {len(hits)} guest identifier(s)",
                        detail=", ".join(hits[:5])))
            # Two-token capitalised sequences are treated as possible personal names.
            possible_names = re.findall(r"\b[A-Z][a-z]{1,20}\s+[A-Z][a-z]{1,20}\b", text)
            allowed = set(spec.get("allowed_name_patterns") or [])
            suspicious = [n for n in possible_names if n not in allowed]
            if suspicious and not known_guest_ids:
                result.findings.append(Finding(
                    check="output", severity=severity,
                    message=f"Output contains {len(suspicious)} possible personal name(s)",
                    detail=", ".join(suspicious[:5])))

        elif pattern == "email_address" and EMAIL_RE.search(text):
            result.findings.append(Finding(
                check="output", severity=severity,
                message="Output contains an email address",
                detail=EMAIL_RE.search(text).group(0)[:60]))

        elif pattern == "phone_number" and PHONE_RE.search(text):
            result.findings.append(Finding(
                check="output", severity=severity,
                message="Output contains a phone number",
                detail=PHONE_RE.search(text).group(0)[:40]))

        elif pattern == "credit_card" and CARD_RE.search(text):
            result.findings.append(Finding(
                check="output", severity=severity,
                message="Output contains a card-like number",
                detail=""))

        elif pattern == "external_url" and URL_RE.search(text):
            result.findings.append(Finding(
                check="output", severity=severity,
                message="Output contains an external URL",
                detail=URL_RE.search(text).group(0)[:80]))

    for required in spec.get("requires") or []:
        if required not in text:
            result.findings.append(Finding(
                check="output", severity="S3",
                message=f"Required marker '{required}' is missing from the output",
                detail=""))


# ---------------------------------------------------------------------------
# Check: policy (data-class policy over the output set)
# ---------------------------------------------------------------------------

def check_policy(archetype: dict, output_guest_keys: list[int], result: GuardrailResult) -> None:
    """Check the output set against data-class policy, independent of the text."""
    result.checks_run.append("policy")
    policy = archetype.get("policy") or {}
    if not policy.get("enabled"):
        return

    guests = {int(g["guest_key"]): g for g in _read_csv(GOLD / "dim_guest.csv")}
    flagged_keys = set(policy.get("never_target_guest_keys") or [])

    for key in output_guest_keys:
        guest = guests.get(int(key))
        if guest is None:
            result.findings.append(Finding(
                check="policy", severity="S2",
                message=f"Output references unknown guest_key {key}",
                detail=""))
            continue
        if int(key) in flagged_keys:
            result.findings.append(Finding(
                check="policy", severity="S1",
                message=f"Output includes guest_key {key}, which policy forbids targeting",
                detail=f"age_band={guest.get('age_band')} "
                       f"consented_email={guest.get('consented_email')}"))

    if policy.get("require_consent") and policy.get("targeting_field") == "consented_email":
        for key in output_guest_keys:
            guest = guests.get(int(key))
            if guest and guest.get("consented_email") != "yes":
                result.findings.append(Finding(
                    check="policy", severity="S1",
                    message=f"Output includes guest_key {key}, who has not consented to marketing",
                    detail=f"age_band={guest.get('age_band')}"))

    if policy.get("exclude_age_bands"):
        excluded = set(policy["exclude_age_bands"])
        for key in output_guest_keys:
            guest = guests.get(int(key))
            if guest and guest.get("age_band") in excluded:
                result.findings.append(Finding(
                    check="policy", severity="S1",
                    message=f"Output includes guest_key {key} in excluded age band "
                            f"{guest.get('age_band')}",
                    detail=""))


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def run_guardrails(archetype: dict, output: str, touched_fields: list[str] | None = None,
                   output_guest_keys: list[int] | None = None,
                   known_guest_ids: set[str] | None = None) -> GuardrailResult:
    result = GuardrailResult()
    check_scope(archetype, touched_fields, result)
    check_output(archetype, output, result, known_guest_ids or set())
    check_policy(archetype, output_guest_keys or [], result)
    return result


def _self_test() -> int:
    """Prove the engine actually catches what it claims to catch.

    Each case asserts on the *finding severity produced*, not just on whether the
    release is blocked. S3 findings are reported but do not block release; S1 and S2
    findings do. Asserting only on `blocked` would let a real regression hide behind a
    severity downgrade.
    """
    archetype = {
        "name": "self-test", "data-class": "internal-personal",
        "allowed-fields": ["incident_id", "category", "severity"],
        "never-read-fields": ["guest_name"],
        "output": {"type": "lines", "count": 3, "max_words_per_line": 40,
                   "prohibited_patterns": ["guest_name", "email_address", "external_url"],
                   "requires": ["line1", "line2", "line3"]},
        "policy": {"enabled": False},
    }
    known_ids = {"G-000001", "G-000002"}

    good = "line1 nothing happened\nline2 nothing open\nline3 nothing to do"
    bad = ("line1 a guest complained\nline2 guest G-000001 still waiting\n"
           "line3 email them at a@b.com")

    # (name, output, touched_fields, guest_keys, expected severity or None)
    # touched_fields=None means scope tracking was not enabled for that case.
    cases = [
        ("clean output passes", good, None, [], None),
        ("guest id in output is caught", bad, None, [], "S1"),
        ("email in output is caught", bad, None, [], "S1"),
        ("never-read field access is caught", good, ["guest_name"], [], "S1"),
        ("undeclared field access is reported, not blocking", good,
         ["resolution_minutes"], [], "S3"),
        ("tracked-but-empty read is reported", good, [], [], "S4"),
        ("wrong line count is reported, not blocking", "line1 only one line", None, [], "S3"),
        ("missing required marker is reported, not blocking", "x\ny\nz", None, [], "S3"),
        ("over-long line is reported, not blocking",
         "line1 " + " ".join(["word"] * 45) + "\nline2 ok\nline3 ok", None, [], "S3"),
    ]

    failures = 0
    for name, text, touched, guests, expected_severity in cases:
        outcome = run_guardrails(archetype, text, touched, guests, known_ids)
        severities = [f.severity for f in outcome.findings]

        if expected_severity is None:
            ok = not outcome.findings and not outcome.blocked
            detail = "no findings, not blocked"
        else:
            ok = expected_severity in severities
            detail = f"severities={severities or ['none']}, expected {expected_severity}"

        if not ok:
            failures += 1
        status = "PASS" if ok else "FAIL"
        print(f"  [{status}] {name} ({detail})")

    # A clean run must not block; a run with an S1 must block.
    clean = run_guardrails(archetype, good, None, [], known_ids)
    unsafe = run_guardrails(archetype, bad, ["guest_name"], [], known_ids)
    for label, cond in (("clean output does not block", not clean.blocked),
                        ("S1 finding blocks release", unsafe.blocked)):
        if not cond:
            failures += 1
        print(f"  [{'PASS' if cond else 'FAIL'}] {label}")

    total = len(cases) + 2
    print(f"\nSelf-test: {total - failures}/{total} passed")
    return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Archetype guardrail engine")
    parser.add_argument("--archetype", help="Path to archetype SKILL.md frontmatter JSON sidecar")
    parser.add_argument("--output", help="Path to the generated output to check")
    parser.add_argument("--touched-fields", default="", help="Comma-separated fields actually read")
    parser.add_argument("--output-guest-keys", default="", help="Comma-separated guest keys in the output")
    parser.add_argument("--self-test", action="store_true", help="Run the engine's own test cases")
    args = parser.parse_args()

    if args.self_test:
        return _self_test()

    if not args.archetype or not args.output:
        parser.error("--archetype and --output are required unless --self-test is used")

    archetype = json.loads(Path(args.archetype).read_text(encoding="utf-8"))
    output = Path(args.output).read_text(encoding="utf-8")
    touched = [f for f in (args.touched_fields or "").split(",") if f]
    guest_keys = [int(g) for g in (args.output_guest_keys or "").split(",") if g.strip()]

    identifiers = load_guest_identifiers()
    result = run_guardrails(archetype, output, touched, guest_keys, identifiers["guest_ids"])

    print(json.dumps(result.as_dict(), indent=2))
    return 1 if result.blocked else 0


if __name__ == "__main__":
    sys.exit(main())
