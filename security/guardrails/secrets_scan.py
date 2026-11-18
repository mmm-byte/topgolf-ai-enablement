"""Secrets scan.

Scans tracked files for credential patterns. Run in CI so a credential cannot reach
the repository, and runnable locally before a commit.

This is a pattern scan, not a complete secret scanner. It is honest about that: it
catches the shapes of credentials that people actually paste into code and
configuration, and it is paired with a git history check in CI.

Usage:
    python -m security.guardrails.secrets_scan
    python -m security.guardrails.secrets_scan --path <dir>
    python -m security.guardrails.secrets_scan --history
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Directories that never contain source worth scanning.
SKIP_DIRS = {".git", "node_modules", ".next", ".venv", "venv", "__pycache__",
             "dist", "build", ".vercel", "site-packages", ".pytest_cache"}
SKIP_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".pdf", ".zip",
                 ".gz", ".woff", ".woff2", ".ttf", ".pyc", ".so", ".dylib", ".dll"}

# (name, pattern, severity)
PATTERNS: list[tuple[str, re.Pattern, str]] = [
    ("AWS access key id", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"), "S1"),
    ("AWS secret access key", re.compile(
        r"(?i)aws_secret_access_key\s*[=:]\s*['\"][A-Za-z0-9/+=]{40}['\"]"), "S1"),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_\-]{35}\b"), "S1"),
    ("Slack token", re.compile(r"\bxox[baprs]-[0-9A-Za-z\-]{10,}\b"), "S1"),
    ("GitHub personal access token", re.compile(r"\bghp_[0-9A-Za-z]{36}\b"), "S1"),
    ("GitHub fine-grained token", re.compile(r"\bgithub_pat_[0-9A-Za-z_]{50,}\b"), "S1"),
    ("Private key block", re.compile(
        r"-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----"), "S1"),
    ("Stripe live secret", re.compile(r"\bsk_live_[0-9A-Za-z]{16,}\b"), "S1"),
    ("Twilio account sid with secret", re.compile(
        r"\bSK[0-9a-fA-F]{32}\b"), "S1"),
    ("Generic assignment of a secret-looking value", re.compile(
        r"(?i)\b(?:api[_-]?key|secret[_-]?key|password|passwd|auth[_-]?token)\s*[=:]\s*"
        r"['\"][A-Za-z0-9/+_\-]{16,}['\"]"), "S2"),
    ("Database URL with inline password", re.compile(
        r"(?i)\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?)://[^\s:/@]+:[^\s/@]+@"), "S1"),
    ("Bearer token literal", re.compile(r"\bBearer\s+[A-Za-z0-9\-._~+/]{24,}={0,2}\b"), "S2"),
]

# Known-safe values that match a pattern but are examples, not secrets.
SAFE_VALUES = {
    "AKIAIOSFODNN7EXAMPLE",       # AWS's documented example key
    "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
}


def _is_safe(value: str) -> bool:
    return any(safe in value for safe in SAFE_VALUES)


def scan_file(path: Path, root: Path) -> list[dict]:
    findings = []
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return findings

    try:
        display_path = str(path.relative_to(root))
    except ValueError:
        # The scan target may sit outside the repository root.
        display_path = str(path)

    for line_number, line in enumerate(text.splitlines(), start=1):
        if len(line) > 4000:
            continue
        for name, pattern, severity in PATTERNS:
            match = pattern.search(line)
            if match and not _is_safe(match.group(0)):
                findings.append({
                    "severity": severity,
                    "pattern": name,
                    "file": display_path,
                    "line": line_number,
                    "match_preview": match.group(0)[:12] + "...",
                })
                break  # one finding per line is enough to act on
    return findings


def scan(target: Path) -> dict:
    findings: list[dict] = []
    scanned = 0

    if target.is_file():
        findings.extend(scan_file(target, ROOT))
        scanned = 1
    else:
        for path in sorted(target.rglob("*")):
            if not path.is_file():
                continue
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            if path.suffix.lower() in SKIP_SUFFIXES:
                continue
            findings.extend(scan_file(path, ROOT))
            scanned += 1

    return {
        "scanned_files": scanned,
        "findings": findings,
        "clean": not findings,
        "note": ("Pattern scan only. It cannot prove the absence of a secret. "
                 "CI also inspects git history for this reason."),
    }


def scan_history() -> dict:
    """Scan every revision in the repository for credential patterns.

    The working-tree scan cannot see a secret that was committed and later
    removed. This walks the full history and applies the same patterns and the
    same allowlist, so a documented example value is not reported here either.
    """
    import subprocess

    result = subprocess.run(
        ["git", "log", "-p", "--all", "--", ".", ":(exclude)package-lock.json"],
        capture_output=True, text=True, cwd=ROOT)

    findings: list[dict] = []
    if result.returncode != 0:
        return {
            "scanned_files": 0,
            "findings": [],
            "clean": False,
            "note": f"git history could not be read: {result.stderr.strip()[-200:]}",
        }

    current_commit = "unknown"
    for line in result.stdout.splitlines():
        if line.startswith("commit "):
            current_commit = line.split()[1][:12]
            continue
        if len(line) > 4000:
            continue
        for name, pattern, severity in PATTERNS:
            match = pattern.search(line)
            if match and not _is_safe(match.group(0)):
                findings.append({
                    "severity": severity,
                    "pattern": name,
                    "file": f"history:{current_commit}",
                    "line": 0,
                    "match_preview": match.group(0)[:12] + "...",
                })
                break

    return {
        "scanned_files": 1,
        "findings": findings,
        "clean": not findings,
        "note": ("History scan applies the same patterns and allowlist as the "
                 "working-tree scan."),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Secrets scan")
    parser.add_argument("--path", default=str(ROOT), help="Path to scan")
    parser.add_argument("--history", action="store_true",
                        help="Scan every revision instead of the working tree")
    args = parser.parse_args()

    if args.history:
        report = scan_history()
        scope = "history"
    else:
        target = Path(args.path).resolve()
        report = scan(target)
        scope = "working tree"

    if report["clean"]:
        print(f"Secrets scan: clean ({scope})")
        print(report["note"])
        return 0

    print(f"Secrets scan: {len(report['findings'])} finding(s) "
          f"in {scope}\n")
    for finding in report["findings"]:
        print(f"  [{finding['severity']}] {finding['pattern']}")
        print(f"      {finding['file']}:{finding['line']}  {finding['match_preview']}")
    return 1


if __name__ == "__main__":
    sys.exit(main())