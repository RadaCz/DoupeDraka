"""Útěk — schválená pravidla (docs/COMBAT_RULES_APPROVED.md §3, compliance).

Rozšiřuje #36 (`test_combat_reject_before_roll_p0c`) a stávající flee testy v
`test_engine.py` / `test_combat_turn_resolution.py` bez duplikace jejich tvrzení.
"""

from __future__ import annotations

import asyncio
import random
import uuid
from dataclasses import asdict

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.api import app
from app.db import ActionReceipt, CharacterRecord, EventRecord, Session, decode_character_state, encode_character_state, init_db
from app.engine.class_features import mark_player_turn_start
from app.engine.combat_positioning import MELEE_REACH_FT
from app.engine.encounters import build_monster
from app.engine.equipment import load_character_state
from app.engine.models import CharacterState, MonsterState, TurnResult
from app.engine.service import GameEngine
from sqlalchemy import func

from tests.test_engine import stats

pytestmark_api = pytest.mark.integration


def _game(seed: int = 31) -> GameEngine:
    return GameEngine(random.Random(seed))


def _finalize(game: GameEngine, hero, monster, result: TurnResult) -> TurnResult:
    return game._finalize_turn_result(result, character=hero, monster=monster)


def _fighter_in_melee(game: GameEngine, *, dexterity: int = 10) -> tuple[CharacterState, MonsterState]:
    hero = game.create_character(1, "Guard", "human", "fighter", stats(dexterity=dexterity))
    hero.in_combat = True
    hero.combat_turn = "player"
    hero.combat_round = 1
    hero.combat_flags = {
        "action_used": False,
        "bonus_action_used": False,
        "reaction_used": False,
    }
    mark_player_turn_start(hero)
    hero.combat_distance_ft = MELEE_REACH_FT
    hero.combat_movement_remaining_ft = 30
    monster = build_monster("normal", "goblin")
    hero.combatant = {
        "name": monster.name,
        "hp": monster.hp,
        "max_hp": monster.max_hp,
        "armor_class": monster.armor_class,
    }
    return hero, monster


def _combat_economy_snapshot(hero: CharacterState) -> dict:
    flags = dict(hero.combat_flags or {})
    return {
        "action_used": flags.get("action_used"),
        "bonus_action_used": flags.get("bonus_action_used"),
        "reaction_used": flags.get("reaction_used"),
        "movement_remaining_ft": hero.combat_movement_remaining_ft,
        "combat_distance_ft": hero.combat_distance_ft,
        "combat_turn": hero.combat_turn,
        "turn_count": hero.turn_count,
    }


def _assert_combat_denied_after_failed_flee(
    game: GameEngine,
    hero: CharacterState,
    monster: MonsterState,
    action: str,
) -> None:
    before = _combat_economy_snapshot(hero)
    result, monster_after = game.resolve_action(hero, action, monster)
    assert result.action_rejected is True
    assert result.state_changed is False
    assert _combat_economy_snapshot(hero) == before
    assert monster_after is monster


def _fail_flee(game: GameEngine, hero: CharacterState, monster: MonsterState) -> None:
    game.rng.randint = lambda a, b: 1 if a == 1 and b == 20 else 4
    result, after = game.resolve_action(hero, "flee", monster)
    assert result.state_changed is True
    assert result.action_rejected is False
    assert "fail to break away" in " ".join(result.events).casefold()
    assert hero.combat_flags.get("action_used") is True
    assert hero.combat_turn == "player"
    assert after is monster


def _rogue_in_melee(game: GameEngine, *, dexterity: int = 14) -> tuple[CharacterState, MonsterState]:
    hero = game.create_character(1, "Runner", "human", "rogue", stats(dexterity=dexterity))
    hero.level = 2
    hero.in_combat = True
    hero.combat_turn = "player"
    hero.combat_round = 1
    hero.combat_flags = {
        "action_used": False,
        "bonus_action_used": False,
        "reaction_used": False,
    }
    mark_player_turn_start(hero)
    hero.combat_distance_ft = MELEE_REACH_FT
    hero.combat_movement_remaining_ft = 30
    monster = build_monster("normal", "goblin")
    hero.combatant = {
        "name": monster.name,
        "hp": monster.hp,
        "max_hp": monster.max_hp,
        "armor_class": monster.armor_class,
    }
    return hero, monster


def test_flee_roll_is_d20_plus_dex_modifier_vs_dc_10():
    """Deterministický mock: d20=7, DEX 16 (+3) → celkem 10 vs DC 10 = úspěch."""
    game = _game()
    hero, monster = _rogue_in_melee(game, dexterity=16)
    mod = game.modifier(16)
    assert mod == 3

    rolls: list[int] = []

    def mock_randint(a: int, b: int) -> int:
        if a == 1 and b == 20:
            rolls.append(7)
            return 7
        return game.rng.randint(a, b)

    game.rng.randint = mock_randint
    result, after = game.resolve_action(hero, "flee", monster)
    result = _finalize(game, hero, after, result)

    assert len(rolls) == 1
    assert rolls[0] == 7
    assert not hero.in_combat
    assert after is None
    assert result.combat_over
    assert any(f"{7 + mod}" in e or "10" in e for e in result.events)


def test_flee_success_leaves_combat_and_clears_monster():
    """Úspěšný útěk — odkaz na test_engine; zde ověření přes stejný mock jako DC hraniční."""
    game = _game(40)
    hero, monster = _rogue_in_melee(game)
    game.rng.randint = lambda a, b: 20 if a == 1 and b == 20 else 5
    result, after = game.resolve_action(hero, "flee", monster)
    result = _finalize(game, hero, after, result)
    assert result.combat_over
    assert after is None
    assert not hero.in_combat
    assert hero.combat_flags.get("action_used") is not True


def test_flee_failure_consumes_action_without_ending_player_turn():
    """Neúspěch: akce spotřebována, žádná výměna s nepřítelem (viz #36 test_failed_flee_roll_still_consumes_action)."""
    game = _game(22)
    hero, monster = _rogue_in_melee(game)
    hero_hp = hero.hp
    monster_hp = monster.hp
    game.rng.randint = lambda a, b: 1 if a == 1 and b == 20 else 4

    result, after = game.resolve_action(hero, "flee", monster)
    result = _finalize(game, hero, after, result)

    assert result.state_changed
    assert hero.combat_flags.get("action_used")
    assert hero.combat_turn == "player"
    assert hero.in_combat
    assert after is monster
    assert not result.combat_over
    assert hero.hp == hero_hp
    assert monster.hp == monster_hp
    assert not any("hits you" in e.casefold() for e in result.events)


def test_after_failed_flee_player_can_move_bonus_action_and_end_turn():
    """Po neúspěšném útěku tah pokračuje — pohyb, bonus (Dash) a „end turn“ projdou."""
    game = _game(33)
    hero, monster = _rogue_in_melee(game)
    _fail_flee(game, hero, monster)
    move_before = hero.combat_movement_remaining_ft

    move, monster = game.resolve_action(hero, "retreat 10 ft", monster)
    assert move.state_changed
    assert not move.action_rejected
    assert hero.combat_distance_ft == MELEE_REACH_FT + 10

    dash, monster = game.resolve_action(hero, "dash", monster)
    assert dash.state_changed
    assert not dash.action_rejected
    assert hero.combat_flags.get("bonus_action_used")
    assert hero.combat_movement_remaining_ft == move_before - 10 + int(hero.speed or 30)

    end, monster = game.resolve_action(hero, "end turn", monster)
    assert end.state_changed
    assert not end.action_rejected
    assert hero.combat_turn in ("enemy", "player", "reaction")


def test_after_failed_flee_fighter_attack_flee_and_dash_are_action_rejected():
    """Po spotřebované akci (neúspěšný útěk) blokovat další akce spotřebovávající Action / bonus Dash."""
    game = _game(41)
    hero, monster = _fighter_in_melee(game)
    _fail_flee(game, hero, monster)
    for blocked in ("attack goblin", "flee", "dash"):
        _assert_combat_denied_after_failed_flee(game, hero, monster, blocked)


def test_after_failed_flee_rogue_second_cunning_dash_rejected_when_bonus_spent():
    game = _game(44)
    hero, monster = _rogue_in_melee(game)
    _fail_flee(game, hero, monster)
    dash, monster = game.resolve_action(hero, "dash", monster)
    assert dash.state_changed and hero.combat_flags.get("bonus_action_used")
    _assert_combat_denied_after_failed_flee(game, hero, monster, "dash")
    _assert_combat_denied_after_failed_flee(game, hero, monster, "attack goblin")


def test_after_failed_flee_rogue_attack_denied_before_bonus_dash_still_allowed():
    game = _game(45)
    hero, monster = _rogue_in_melee(game)
    _fail_flee(game, hero, monster)
    _assert_combat_denied_after_failed_flee(game, hero, monster, "attack goblin")
    dash, monster = game.resolve_action(hero, "dash", monster)
    assert dash.state_changed and not dash.action_rejected


def test_flee_reject_before_roll_documented_in_p0c_cases():
    """Zrušení před hodem pokrývá #36 — zde jen sanity grep, aby se sada nerozjela."""
    import tests.test_combat_reject_before_roll_p0c as p0c

    case_ids = {c.case_id for c in p0c._REJECT_CASES}
    assert "flee_enemy_turn" in case_ids
    assert "flee_action_already_used" in case_ids


@pytest.fixture
def setup_db():
    asyncio.run(init_db())
    yield


@pytest.fixture
def flee_api_client(setup_db):
    client = TestClient(app)
    client.post("/auth/register", json={"username": "fleerule", "password": "password123"})
    token = client.post("/auth/login", json={"username": "fleerule", "password": "password123"}).json()[
        "access_token"
    ]
    headers = {"Authorization": f"Bearer {token}"}
    char_id = client.post(
        "/characters",
        json={"name": "FleeIdem", "race": "human", "character_class": "rogue"},
        headers=headers,
    ).json()["id"]
    return client, headers, char_id


def _seed_player_combat(char_id: str, *, character_class: str = "rogue", dexterity: int | None = None) -> None:
    async def seed():
        async with Session() as session:
            record = await session.get(CharacterRecord, char_id)
            hero = load_character_state(decode_character_state(record.payload))
            if character_class:
                hero.character_class = character_class
            if dexterity is not None:
                hero.abilities["dexterity"] = dexterity
            hero.in_combat = True
            hero.combat_turn = "player"
            hero.combat_distance_ft = MELEE_REACH_FT
            hero.combat_movement_remaining_ft = 30
            hero.combat_flags = {}
            hero.combat_round = 1
            mark_player_turn_start(hero)
            monster = build_monster("normal", "goblin")
            hero.combatant = asdict(monster)
            record.payload = encode_character_state(asdict(hero))
            await session.commit()

    asyncio.run(seed())


async def _journal_metrics(char_id: str) -> tuple[int, int]:
    async with Session() as session:
        events = int(
            await session.scalar(
                select(func.count()).select_from(EventRecord).where(EventRecord.character_id == char_id)
            )
            or 0
        )
        record = await session.get(CharacterRecord, char_id)
        hero = load_character_state(decode_character_state(record.payload))
        return events, hero.turn_count


@pytest.mark.integration
def test_api_flee_same_idempotency_key_replays_without_double_commit(flee_api_client):
    """Stejný Útěk + Idempotency-Key: jeden hod, jedna spotřeba, stejná odpověď."""
    client, headers, char_id = flee_api_client
    _seed_player_combat(char_id)
    key = uuid.uuid4().hex
    idem_headers = {**headers, "Idempotency-Key": key}
    body = {"action": "flee"}

    first = client.post(f"/characters/{char_id}/actions", json=body, headers=idem_headers)
    second = client.post(f"/characters/{char_id}/actions", json=body, headers=idem_headers)
    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text

    f_json = first.json()
    s_json = second.json()
    assert s_json["events"] == f_json["events"]
    assert s_json.get("resolution") == f_json.get("resolution")
    assert s_json["character"]["combat_flags"] == f_json["character"]["combat_flags"]

    async def counts():
        async with Session() as session:
            events = (
                await session.scalars(select(EventRecord).where(EventRecord.character_id == char_id))
            ).all()
            receipts = (await session.scalars(select(ActionReceipt).where(ActionReceipt.key == key))).all()
            record = await session.get(CharacterRecord, char_id)
            return len(events), len(receipts), record.version

    events, receipts, version = asyncio.run(counts())
    assert events == 1
    assert receipts == 1
    assert version == 1


@pytest.mark.integration
def test_api_failed_flee_journals_and_increments_turn_count(flee_api_client) -> None:
    """Neúspěšný hod Útěku není action_rejected — zapisuje se do deníku."""
    client, headers, char_id = flee_api_client
    _seed_player_combat(char_id, dexterity=8)
    events_before, turns_before = asyncio.run(_journal_metrics(char_id))

    failed = False
    for _ in range(16):
        response = client.post(f"/characters/{char_id}/actions", json={"action": "flee"}, headers=headers)
        assert response.status_code == 200, response.text
        body = response.json()
        joined = " ".join(body.get("events", [])).casefold()
        char = body["character"]
        if char.get("in_combat") and char.get("combat_flags", {}).get("action_used"):
            assert "fail to break away" in joined
            failed = True
            break
        if not char.get("in_combat"):
            _seed_player_combat(char_id, dexterity=8)
            events_before, turns_before = asyncio.run(_journal_metrics(char_id))

    assert failed
    events_after, turns_after = asyncio.run(_journal_metrics(char_id))
    assert events_after == events_before + 1
    assert turns_after == turns_before + 1


@pytest.mark.integration
def test_api_flee_denied_before_roll_does_not_journal(flee_api_client) -> None:
    """Zrušení / odmítnutí Útěku před hodem — bez deníku a turn_count."""
    client, headers, char_id = flee_api_client
    _seed_player_combat(char_id)
    events_before, turns_before = asyncio.run(_journal_metrics(char_id))

    from app.engine.combat_action_economy import spend_action

    async def spend():
        async with Session() as session:
            record = await session.get(CharacterRecord, char_id)
            hero = load_character_state(decode_character_state(record.payload))
            spend_action(hero)
            record.payload = encode_character_state(asdict(hero))
            await session.commit()

    asyncio.run(spend())

    response = client.post(f"/characters/{char_id}/actions", json={"action": "flee"}, headers=headers)
    assert response.status_code == 200
    assert "already used your action" in " ".join(response.json().get("events", [])).casefold()
    events_after, turns_after = asyncio.run(_journal_metrics(char_id))
    assert events_after == events_before
    assert turns_after == turns_before


@pytest.mark.integration
def test_api_after_failed_flee_denied_attack_flee_dash_no_journal(flee_api_client) -> None:
    client, headers, char_id = flee_api_client
    _seed_player_combat(char_id, character_class="fighter", dexterity=8)
    failed = False
    for _ in range(16):
        response = client.post(f"/characters/{char_id}/actions", json={"action": "flee"}, headers=headers)
        body = response.json()
        char = body["character"]
        if char.get("in_combat") and char.get("combat_flags", {}).get("action_used"):
            failed = True
            break
        if not char.get("in_combat"):
            _seed_player_combat(char_id, character_class="fighter", dexterity=8)
    assert failed

    events_before, turns_before = asyncio.run(_journal_metrics(char_id))
    for denied in ("attack goblin", "flee", "dash"):
        response = client.post(
            f"/characters/{char_id}/actions",
            json={"action": denied},
            headers=headers,
        )
        assert response.status_code == 200
        assert asyncio.run(_journal_metrics(char_id)) == (events_before, turns_before)

    move = client.post(
        f"/characters/{char_id}/actions",
        json={"action": "retreat 5 ft"},
        headers=headers,
    )
    assert move.status_code == 200
    assert move.json()["character"]["combat_turn"] == "player"
    events_after_move, turns_after_move = asyncio.run(_journal_metrics(char_id))
    assert events_after_move == events_before + 1
    assert turns_after_move == turns_before + 1

    end = client.post(f"/characters/{char_id}/actions", json={"action": "end turn"}, headers=headers)
    assert end.status_code == 200


@pytest.mark.integration
def test_api_rogue_cunning_dash_after_failed_flee(flee_api_client) -> None:
    """Rogue L2+: po neúspěšném útěku volná bonusová akce → Cunning Dash."""
    client, headers, char_id = flee_api_client

    async def level_two():
        async with Session() as session:
            record = await session.get(CharacterRecord, char_id)
            hero = load_character_state(decode_character_state(record.payload))
            hero.level = 2
            record.payload = encode_character_state(asdict(hero))
            await session.commit()

    asyncio.run(level_two())
    _seed_player_combat(char_id, dexterity=8)

    failed = False
    for _ in range(16):
        response = client.post(f"/characters/{char_id}/actions", json={"action": "flee"}, headers=headers)
        body = response.json()
        char = body["character"]
        if char.get("in_combat") and char.get("combat_flags", {}).get("action_used"):
            failed = True
            break
        if not char.get("in_combat"):
            _seed_player_combat(char_id, dexterity=8)
    assert failed

    dash = client.post(f"/characters/{char_id}/actions", json={"action": "dash"}, headers=headers)
    assert dash.status_code == 200
    flags = dash.json()["character"].get("combat_flags") or {}
    assert flags.get("bonus_action_used") is True
    assert dash.json()["character"]["combat_turn"] == "player"