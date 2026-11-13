"""E2E / test harness configuration read at the API layer (not inside engine rules)."""

from __future__ import annotations

import os


def parse_e2e_rng_base() -> int | None:
    """Return integer E2E_RNG_SEED when set and numeric; otherwise None (production)."""
    raw = os.environ.get("E2E_RNG_SEED")
    if raw is not None and str(raw).isdigit():
        return int(raw)
    return None
