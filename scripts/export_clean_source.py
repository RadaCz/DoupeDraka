#!/usr/bin/env python3
"""Build a source-only ZIP suitable for distribution (Etapa 0)."""

from __future__ import annotations

import subprocess
import zipfile
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXCLUDE_PREFIXES = (
    ".git/",
    "node_modules/",
    "frontend/dist/",
    ".venv/",
    "__pycache__/",
    ".pytest_cache/",
    ".wt-baseline/",
    "data/",
)
EXCLUDE_NAMES = {".env", ".aider.chat.history.md", ".aider.input.history"}


def main() -> None:
    stamp = datetime.now(UTC).strftime("%Y%m%d")
    out = ROOT / f"doupedraka-source-{stamp}.zip"
    files = subprocess.check_output(["git", "ls-files"], cwd=ROOT, text=True).splitlines()
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for rel in files:
            if rel in EXCLUDE_NAMES:
                continue
            if any(rel.startswith(prefix) for prefix in EXCLUDE_PREFIXES):
                continue
            archive.write(ROOT / rel, rel)
    print(f"Wrote {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
