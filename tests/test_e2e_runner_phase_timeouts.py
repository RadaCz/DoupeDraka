"""E2E harness: outer runner phase budget must exceed Playwright per-spec timeouts."""

import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
RUN_TESTS = REPO / "frontend" / "e2e" / "run-tests.mjs"
GHOUL_SPEC = REPO / "frontend" / "e2e" / "ghoul-paralysis-combat.spec.ts"

RUNNER_TEARDOWN_BUFFER_MS = 45_000


def test_ghoul_runner_phase_timeout_covers_playwright_budget():
    run_src = RUN_TESTS.read_text(encoding="utf-8")
    spec_src = GHOUL_SPEC.read_text(encoding="utf-8")
    pw_raw = re.search(r"test\.setTimeout\(([\d_]+)", spec_src).group(1)
    playwright_ms = int(pw_raw.replace("_", ""))
    sum_match = re.search(
        r"\[DEDICATED_SPECS\.ghoul\]:\s*GHOUL_PLAYWRIGHT_TEST_TIMEOUT_MS\s*\+\s*RUNNER_PHASE_TEARDOWN_BUFFER_MS",
        run_src,
    )
    assert sum_match, "ghoul phase must be GHOUL_PLAYWRIGHT_TEST_TIMEOUT_MS + RUNNER_PHASE_TEARDOWN_BUFFER_MS"
    buf_raw = re.search(r"RUNNER_PHASE_TEARDOWN_BUFFER_MS\s*=\s*([\d_]+)", run_src).group(1)
    buffer_ms = int(buf_raw.replace("_", ""))
    phase_ms = playwright_ms + buffer_ms
    assert phase_ms >= playwright_ms + RUNNER_TEARDOWN_BUFFER_MS, (
        f"run-tests ghoul phase {phase_ms}ms must be >= Playwright {playwright_ms}ms + "
        f"{RUNNER_TEARDOWN_BUFFER_MS}ms buffer (trace/teardown)"
    )
