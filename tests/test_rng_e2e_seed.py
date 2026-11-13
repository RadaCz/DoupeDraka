"""E2E RNG: per-character derived seeds, persisted state, isolation."""

from __future__ import annotations

import pytest

from app.engine.models import CharacterState
from app.engine.rng_state import (
    bind_engine_rng,
    capture_engine_rng,
    seed_for_character,
)
from app.engine.service import GameEngine


def _roll_sequence(engine: GameEngine, count: int = 6) -> list[int]:
    return [engine.roll("1d20", 0).total for _ in range(count)]


def test_seed_for_character_differs_with_e2e_base():
    char_id = "char-uuid-a"
    plain = seed_for_character(char_id, None)
    with_e2e = seed_for_character(char_id, 27)
    other_id = seed_for_character("char-uuid-b", 27)
    assert plain != with_e2e
    assert with_e2e != other_id


def test_e2e_seed_repeatable_sequence_same_character_id():
  e2e = 27
  char_id = "550e8400-e29b-41d4-a716-446655440000"
  engine1 = GameEngine()
  bind_engine_rng(CharacterState(id=char_id, owner_id=1, name="A", race="human", character_class="fighter"), engine1, e2e)
  seq1 = _roll_sequence(engine1)

  engine2 = GameEngine()
  bind_engine_rng(CharacterState(id=char_id, owner_id=1, name="A", race="human", character_class="fighter"), engine2, e2e)
  seq2 = _roll_sequence(engine2)

  assert seq1 == seq2
  assert seq1 != _roll_sequence(GameEngine())


def test_persisted_rng_state_restored_after_capture():
    hero = CharacterState(id="persist-1", owner_id=1, name="H", race="human", character_class="fighter")
    engine = GameEngine()
    bind_engine_rng(hero, engine, 27)
    _roll_sequence(engine, 4)
    capture_engine_rng(hero, engine)
    continuation_on_original = _roll_sequence(engine, 4)

    engine2 = GameEngine()
    bind_engine_rng(hero, engine2, 27)
    continuation_after_reload = _roll_sequence(engine2, 4)
    assert continuation_after_reload == continuation_on_original


def test_two_characters_isolated_under_same_e2e_base():
    e2e = 27
    a = CharacterState(id="iso-a", owner_id=1, name="A", race="human", character_class="fighter")
    b = CharacterState(id="iso-b", owner_id=2, name="B", race="human", character_class="fighter")
    engine = GameEngine()
    bind_engine_rng(a, engine, e2e)
    first = engine.roll("1d20", 0).total
    capture_engine_rng(a, engine)
    bind_engine_rng(b, engine, e2e)
    second = engine.roll("1d20", 0).total
    assert first != second or a.id != b.id

    engine_a = GameEngine()
    bind_engine_rng(a, engine_a, e2e)
    seq_a = _roll_sequence(engine_a, 8)
    engine_b = GameEngine()
    bind_engine_rng(b, engine_b, e2e)
    seq_b = _roll_sequence(engine_b, 8)
    assert seq_a != seq_b


def test_production_branch_unchanged_without_e2e_base():
    char_id = "prod-char"
    hero = CharacterState(id=char_id, owner_id=1, name="P", race="human", character_class="fighter")
    engine1 = GameEngine()
    bind_engine_rng(hero, engine1, None)
    seq1 = _roll_sequence(engine1, 4)

    engine2 = GameEngine()
    bind_engine_rng(hero, engine2)
    seq2 = _roll_sequence(engine2, 4)
    assert seq1 == seq2
    assert seed_for_character(char_id, None) == seed_for_character(char_id)


def test_parse_e2e_rng_base(monkeypatch: pytest.MonkeyPatch):
    from app.e2e_rng import parse_e2e_rng_base

    monkeypatch.delenv("E2E_RNG_SEED", raising=False)
    assert parse_e2e_rng_base() is None
    monkeypatch.setenv("E2E_RNG_SEED", "abc")
    assert parse_e2e_rng_base() is None
    monkeypatch.setenv("E2E_RNG_SEED", "27")
    assert parse_e2e_rng_base() == 27
