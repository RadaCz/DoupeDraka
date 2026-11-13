#!/usr/bin/env python3
"""Fail CI when common secret patterns appear in tracked source files."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SKIP_DIRS = {
    ".git",
    ".venv",
    "node_modules",
    "dist",
    "__pycache__",
    ".pytest_cache",
    ".wt-baseline",
    "frontend/e2e",
}

SKIP_FILES = {
    "scripts/secret_scan.py",
    "scripts/audit_secret_hygiene.py",
    "tests/test_telegram_auth.py",
    "tests/test_staging_preflight.py",
    "frontend/e2e/telegram.ts",
}

PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("telegram_bot_token", re.compile(r"\b\d{8,12}:[A-Za-z0-9_-]{20,}\b")),
    ("aws_access_key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("private_key_block", re.compile(r"-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----")),
    ("openai_api_key", re.compile(r"\bsk-[A-Za-z0-9]{20,}\b")),
    ("openrouter_api_key", re.compile(r"\bsk-or-v1-[A-Za-z0-9_-]{20,}\b")),
    ("groq_api_key", re.compile(r"\bgsk_[A-Za-z0-9]{20,}\b")),
    ("nvidia_api_key", re.compile(r"\bnvapi-[A-Za-z0-9_-]{20,}\b")),
    ("cerebras_api_key", re.compile(r"\bcsk-[A-Za-z0-9]{20,}\b")),
    ("anthropic_api_key", re.compile(r"\bsk-ant-[A-Za-z0-9_-]{20,}\b")),
    ("huggingface_token", re.compile(r"\bhf_[A-Za-z0-9]{20,}\b")),
    # Ignore obvious fixtures (user:pass placeholders / staging-db-secret in tests).
    (
        "postgres_url_with_password",
        re.compile(
            r"postgres(?:ql)?://(?![^:\s/]+:(?:password|secret|staging-db-secret|doupe)@)"
            r"[^:\s/]+:[^@\s/]{8,}@"
        ),
    ),
    (
        "mysql_url_with_password",
        re.compile(
            r"mysql(?:\+[^:]+)?://(?![^:\s/]+:(?:password|secret)@)[^:\s/]+:[^@\s/]{8,}@"
        ),
    ),
]


def scan_file(path: Path) -> list[str]:
    rel = path.relative_to(ROOT).as_posix()
    if rel in SKIP_FILES:
        return []
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return []
    hits: list[str] = []
    for name, pattern in PATTERNS:
        if pattern.search(text):
            hits.append(f"{rel}: suspected {name}")
    return hits


def tracked_files() -> list[Path] | None:
    import subprocess

    try:
        output = subprocess.check_output(
            ["git", "ls-files", "-z"],
            cwd=ROOT,
            stderr=subprocess.DEVNULL,
        )
    except (OSError, subprocess.CalledProcessError):
        return None
    return [ROOT / part for part in output.decode("utf-8", "surrogateescape").split("\0") if part]


def main() -> int:
    findings: list[str] = []
    paths = tracked_files()
    if paths is None:
        paths = [p for p in ROOT.rglob("*") if p.is_file()]
    for path in paths:
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".db", ".sqlite"}:
            continue
        findings.extend(scan_file(path))
    if findings:
        print("Secret scan failed:")
        for line in sorted(findings):
            print(f"  {line}")
        return 1
    print("Secret scan: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
