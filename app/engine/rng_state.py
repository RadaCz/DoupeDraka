"""Per-character RNG persistence — isolates dice streams across players and retries."""

from __future__ import annotations

import hashlib
import random
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .models import CharacterState
    from .service import GameEngine


def _seed_from_character_id(character_id: str) -> int:
    digest = hashlib.sha256(character_id.encode()).hexdigest()
    return int(digest[:8], 16)


def seed_for_character(character_id: str, e2e_base: int | None = None) -> int:
    """Stable per-character seed; E2E mode mixes harness base seed with character id."""
    if e2e_base is not None:
        combined = f"{e2e_base}:{character_id}"
        digest = hashlib.sha256(combined.encode()).hexdigest()
        return int(digest[:8], 16)
    return _seed_from_character_id(character_id)


def encode_rng_state(state: tuple[Any, ...]) -> dict[str, Any]:
    version, internal, gauss = state
    return {"v": version, "s": list(internal), "g": gauss}


def decode_rng_state(payload: dict[str, Any]) -> tuple[Any, ...]:
    return (payload["v"], tuple(payload["s"]), payload["g"])


def bind_engine_rng(
    character: CharacterState,
    engine: GameEngine,
    e2e_base: int | None = None,
) -> None:
    """Load this character's RNG stream into the engine before resolve_action."""
    payload = getattr(character, "rng_state", None)
    if payload and isinstance(payload, dict) and "s" in payload:
        try:
            engine.rng.setstate(decode_rng_state(payload))
            return
        except (KeyError, TypeError, ValueError):
            pass
    engine.rng.seed(seed_for_character(character.id, e2e_base))


def capture_engine_rng(character: CharacterState, engine: GameEngine) -> None:
    """Persist RNG only after a committed state change."""
    character.rng_state = encode_rng_state(engine.rng.getstate())


def fresh_engine_for_e2e(seed: int | None) -> GameEngine:
    from .service import GameEngine

    if seed is not None:
        return GameEngine(random.Random(seed))
    return GameEngine()
