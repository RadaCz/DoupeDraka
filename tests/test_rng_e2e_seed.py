"""E2E RNG: stable identity, persisted state, production isolation."""

from __future__ import annotations

import pytest

from app.e2e_rng import build_e2e_rng_identity, parse_e2e_rng_base
from app.engine.models import CharacterState
from app.engine.rng_state import (
    bind_engine_rng,
    capture_engine_rng,
    seed_for_character,
)
from app.engine.service import GameEngine


def _roll_sequence(engine: GameEngine, count: int = 12) -> list[int]:
    return [engine.roll("1d20", 0).total for _ in range(count)]


def _hero(char_id: str, name: str = "Hero") -> CharacterState:
    return CharacterState(
        id=char_id,
        owner_id=1,
        name=name,
        race="human",
        character_class="fighter",
    )


def test_e2e_same_identity_different_uuids_same_sequence():
    e2e = 27
    identity = build_e2e_rng_identity(755_500_000, "Bell UI E2E")
    uuid_a = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    uuid_b = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

    engine1 = GameEngine()
    bind_engine_rng(_hero(uuid_a, "Bell UI E2E"), engine1, e2e, identity)
    seq_a = _roll_sequence(engine1)

    engine2 = GameEngine()
    bind_engine_rng(_hero(uuid_b, "Bell UI E2E"), engine2, e2e, identity)
    seq_b = _roll_sequence(engine2)

    assert seq_a == seq_b
    assert seq_a != _roll_sequence(GameEngine())


def test_e2e_different_identities_isolated():
    e2e = 27
    id_a = build_e2e_rng_identity(755_500_000, "Bell UI E2E")
    id_b = build_e2e_rng_identity(735_000_000, "Ghoul Paralysis E2E")

    engine_a = GameEngine()
    bind_engine_rng(_hero("id-a", "Bell UI E2E"), engine_a, e2e, id_a)
    seq_a = _roll_sequence(engine_a, 10)

    engine_b = GameEngine()
    bind_engine_rng(_hero("id-b", "Ghoul Paralysis E2E"), engine_b, e2e, id_b)
    seq_b = _roll_sequence(engine_b, 10)

    assert seq_a != seq_b


def test_persisted_rng_state_restored_after_capture():
    e2e = 27
    identity = build_e2e_rng_identity(501, "Persist")
    hero = _hero("persist-uuid-1", "Persist")
    engine = GameEngine()
    bind_engine_rng(hero, engine, e2e, identity)
    _roll_sequence(engine, 4)
    capture_engine_rng(hero, engine)
    continuation_on_original = _roll_sequence(engine, 6)

    engine2 = GameEngine()
    bind_engine_rng(hero, engine2, e2e, identity)
    continuation_after_reload = _roll_sequence(engine2, 6)
    assert continuation_after_reload == continuation_on_original


def test_production_branch_unchanged_without_e2e_base():
    char_id = "prod-char-uuid"
    hero = _hero(char_id, "Prod")
    engine1 = GameEngine()
    bind_engine_rng(hero, engine1, None, None)
    seq1 = _roll_sequence(engine1, 8)

    engine2 = GameEngine()
    bind_engine_rng(hero, engine2)
    seq2 = _roll_sequence(engine2, 8)
    assert seq1 == seq2
    assert seed_for_character(char_id, None) == seed_for_character(char_id)


def test_e2e_identity_differs_from_uuid_only_seed():
    char_id = "random-uuid-each-run"
    e2e = 27
    identity = build_e2e_rng_identity(755_500_000, "Bell UI E2E")
    uuid_seed = seed_for_character(char_id, e2e, e2e_identity=char_id)
    stable_seed = seed_for_character(char_id, e2e, e2e_identity=identity)
    assert uuid_seed != stable_seed


def test_parse_e2e_rng_base(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("E2E_RNG_SEED", raising=False)
    assert parse_e2e_rng_base() is None
    monkeypatch.setenv("E2E_RNG_SEED", "abc")
    assert parse_e2e_rng_base() is None
    monkeypatch.setenv("E2E_RNG_SEED", "27")
    assert parse_e2e_rng_base() == 27
