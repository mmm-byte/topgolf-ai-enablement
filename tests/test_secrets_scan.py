"""Tests for the secrets scanner.

CI runs this scanner twice: once over the working tree and once over the full git
history. The history scan is the one that catches a credential which was committed
and later removed, so it has to actually detect one, and it has to apply the same
allowlist as the working-tree scan so documented example values are not reported.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from security.guardrails import secrets_scan  # noqa: E402

# Built at runtime so this source file does not itself contain a string that
# matches the AWS access key pattern, which would make the scanner report it.
# The shape matches the pattern: "AKIA" followed by 16 uppercase alphanumerics.
FAKE_AWS_KEY = "AKIA" + "1" * 10 + "ABCDEF"


class TestWorkingTreeScan:
    def test_the_repository_is_clean(self):
        report = secrets_scan.scan(ROOT)
        assert report["clean"], f"secrets found: {report['findings']}"

    def test_documented_example_values_are_allowed(self):
        """AWS's published example key matches the pattern but is not a secret."""
        assert secrets_scan._is_safe("AKIAIOSFODNN7EXAMPLE")
        assert secrets_scan._is_safe(
            "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY")

    def test_a_real_looking_key_is_not_allowed(self):
        assert not secrets_scan._is_safe(FAKE_AWS_KEY)


class TestHistoryScan:
    def test_the_repository_history_is_clean(self):
        report = secrets_scan.scan_history()
        assert report["clean"], f"secrets found in history: {report['findings']}"

    def test_history_scan_detects_a_planted_secret(self, tmp_path):
        """A secret committed and then removed must still be reported."""
        repo = tmp_path / "repo"
        repo.mkdir()
        env = {
            "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.com",
            "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.com",
            "PATH": "/usr/bin:/bin:/usr/local/bin",
            "HOME": str(tmp_path),
        }
        subprocess.run(["git", "init", "-q", "."], cwd=repo, env=env, check=True)
        (repo / "app.py").write_text("value = 1\n", encoding="utf-8")
        subprocess.run(["git", "add", "-A"], cwd=repo, env=env, check=True)
        subprocess.run(["git", "commit", "-qm", "first"], cwd=repo, env=env, check=True)

        (repo / "app.py").write_text(
            f'key = "{FAKE_AWS_KEY}"\n', encoding="utf-8")
        subprocess.run(["git", "add", "-A"], cwd=repo, env=env, check=True)
        subprocess.run(["git", "commit", "-qm", "leak"], cwd=repo, env=env, check=True)

        # Remove it again. The working tree is clean; the history is not.
        (repo / "app.py").write_text("value = 1\n", encoding="utf-8")
        subprocess.run(["git", "add", "-A"], cwd=repo, env=env, check=True)
        subprocess.run(["git", "commit", "-qm", "remove"], cwd=repo, env=env, check=True)

        original_root = secrets_scan.ROOT
        try:
            secrets_scan.ROOT = repo
            report = secrets_scan.scan_history()
        finally:
            secrets_scan.ROOT = original_root

        assert not report["clean"]
        assert any(f["pattern"] == "AWS access key id" for f in report["findings"])

    def test_history_scan_ignores_documented_example_values(self, tmp_path):
        repo = tmp_path / "repo2"
        repo.mkdir()
        env = {
            "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.com",
            "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.com",
            "PATH": "/usr/bin:/bin:/usr/local/bin",
            "HOME": str(tmp_path),
        }
        subprocess.run(["git", "init", "-q", "."], cwd=repo, env=env, check=True)
        (repo / "app.py").write_text(
            'example = "AKIAIOSFODNN7EXAMPLE"\n', encoding="utf-8")
        subprocess.run(["git", "add", "-A"], cwd=repo, env=env, check=True)
        subprocess.run(["git", "commit", "-qm", "example"], cwd=repo, env=env, check=True)

        original_root = secrets_scan.ROOT
        try:
            secrets_scan.ROOT = repo
            report = secrets_scan.scan_history()
        finally:
            secrets_scan.ROOT = original_root

        assert report["clean"], f"example value reported: {report['findings']}"
