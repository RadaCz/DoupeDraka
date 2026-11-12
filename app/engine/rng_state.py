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


def encode_rng_state(state: tuple[Any, ...]) -> dict[str, Any]:
    version, internal, gauss = state
    return {"v": version, "s": list(internal), "g": gauss}


def decode_rng_state(payload: dict[str, Any]) -> tuple[Any, ...]:
    return (payload["v"], tuple(payload["s"]), payload["g"])


def bind_engine_rng(character: CharacterState, engine: GameEngine) -> None:
    """Load this character's RNG stream into the engine before resolve_action."""
    payload = getattr(character, "rng_state", None)
    if payload and isinstance(payload, dict) and "s" in payload:
        try:
            engine.rng.setstate(decode_rng_state(payload))
            return
        except (KeyError, TypeError, ValueError):
            pass
    engine.rng.seed(_seed_from_character_id(character.id))


def capture_engine_rng(character: CharacterState, engine: GameEngine) -> None:
    """Persist RNG only after a committed state change."""
    character.rng_state = encode_rng_state(engine.rng.getstate())


def fresh_engine_for_e2e(seed: int | None) -> GameEngine:
    from .service import GameEngine

    if seed is not None:
        return GameEngine(random.Random(seed))
    return GameEngine()
