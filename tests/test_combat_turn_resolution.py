"""Combat V2 — structured turn resolution matches journal fact lines."""

from __future__ import annotations

import random
import re
import uuid

import pytest
from fastapi.testclient import TestClient

from app.api import app
from app.db import init_db
from app.engine.combat_positioning import MELEE_REACH_FT
from app.engine.models import MonsterState, TurnResult
from app.engine.service import GameEngine
from tests.test_spells import create_hero


def _finalize(game: GameEngine, hero, monster, result: TurnResult) -> TurnResult:
    return game._finalize_turn_result(result, character=hero, monster=monster)


def _melee(game: GameEngine):
    hero = game.create_character(1, "Hero", "human", "fighter")
    hero.in_combat = True
    hero.combat_turn = "player"
    hero.combat_distance_ft = MELEE_REACH_FT
    hero.combat_movement_remaining_ft = 30
    hero.combat_flags = {}
    monster = MonsterState(
        name="Goblin",
        hp=30,
        max_hp=30,
        armor_class=10,
        attack_bonus=4,
        damage="1d6+2",
        template_key="goblin",
    )
    hero.combatant = {
        "name": monster.name,
        "hp": monster.hp,
        "max_hp": monster.max_hp,
        "armor_class": monster.armor_class,
    }
    return hero, monster


def _attack_beat(resolution: dict) -> dict:
    beats = resolution.get("beats") or []
    attacks = [b for b in beats if b.get("kind") == "attack"]
    assert attacks, f"expected attack beat, got {beats}"
    return attacks[0]


def _hero_hp_from_journal(events: list[str]) -> tuple[int, int] | None:
    joined = " ".join(events)
    if m := re.search(r"Your HP:\s*(\d+)/(\d+)", joined):
        return int(m.group(1)), int(m.group(2))
    return None


def _enemy_hp_from_journal(events: list[str]) -> tuple[int, int] | None:
    joined = " ".join(events)
    if m := re.search(r"Goblin has (\d+)/(\d+) HP", joined, re.IGNORECASE):
        return int(m.group(1)), int(m.group(2))
    return None


def test_attack_miss_facts_match_journal():
    game = GameEngine(random.Random(1))
    game.rng.randint = lambda a, b: 4 if b == 20 else 1
    hero, monster = _melee(game)
    result, monster = game.resolve_action(hero, "attack goblin", monster)
    result = _finalize(game, hero, monster, result)
    assert result.resolution
    beat = _attack_beat(result.resolution)
    assert beat["outcome"] == "miss"
    line = next(e for e in result.events if "Attack with" in e and "miss" in e)
    m = re.search(r":\s*(\d+)\s*\(d20 \+(\d+)\) vs AC (\d+)", line)
    assert m
    assert beat["attack_roll"]["total"] == int(m.group(1))
    assert beat["attack_roll"]["modifier"] == int(m.group(2))
    assert beat["target_ac"] == int(m.group(3))
    assert beat["hero"]["hp_current"] == hero.hp
    assert beat["enemy"]["hp_current"] == monster.hp


def test_attack_hit_and_damage_facts_match_journal():
    game = GameEngine(random.Random(2))
    game.rng.randint = lambda a, b: 18 if b == 20 else 3
    hero, monster = _melee(game)
    result, monster = game.resolve_action(hero, "attack goblin", monster)
    result = _finalize(game, hero, monster, result)
    beat = _attack_beat(result.resolution)
    assert beat["outcome"] == "hit"
    assert beat["damage"]["total"] > 0
    dmg_line = next(e for e in result.events if e.startswith("Damage "))
    dm = re.search(r"Damage (\d+)", dmg_line)
    assert dm
    assert beat["damage"]["total"] == int(dm.group(1))
    journal_hp = _enemy_hp_from_journal(result.events)
    assert journal_hp
    assert beat["enemy"]["hp_current"] == journal_hp[0]
    assert beat["enemy"]["hp_max"] == journal_hp[1]


def test_attack_critical_hit_outcome():
    game = GameEngine(random.Random(3))
    game.rng.randint = lambda a, b: 20 if b == 20 else 5
    hero, monster = _melee(game)
    result, monster = game.resolve_action(hero, "attack goblin", monster)
    result = _finalize(game, hero, monster, result)
    beat = _attack_beat(result.resolution)
    assert beat["outcome"] == "critical_hit"
    assert beat["attack_roll"]["natural"] == 20


def test_movement_distance_facts_match_journal():
    game = GameEngine(random.Random(4))
    hero, monster = _melee(game)
    hero.combat_distance_ft = MELEE_REACH_FT + 10
    result, monster = game.resolve_action(hero, "step back 5 ft", monster)
    result = _finalize(game, hero, monster, result)
    movement = next(b for b in result.resolution["beats"] if b["kind"] == "movement")
    assert movement["distance_ft"] == {"from": 15, "to": 20}
    assert f"now {movement['distance_ft']['to']} ft" in " ".join(result.events).lower()
    assert movement["hero"]["hp_current"] == hero.hp
    assert movement["enemy"]["hp_current"] == monster.hp


def test_shield_reaction_facts_and_hp_match_journal():
    game = GameEngine(random.Random(7))
    hero = create_hero("wizard", dexterity=10)
    hero.in_combat = True
    hero.combat_turn = "reaction"
    hero.armor_class = 12
    hero.hp = 20
    hero.max_hp = 20
    if "Shield" not in hero.known_spells:
        hero.known_spells.append("Shield")
    hero.combat_reaction_pending = {
        "kind": "shield_vs_attack",
        "monster_name": "Orc",
        "monster_key": "goblin",
        "label": "attack",
        "melee": True,
        "natural": 12,
        "attack_total": 12,
        "critical": False,
        "damage_dice": "1d6",
        "damage_bonus": 2,
    }
    monster = MonsterState(name="Orc", hp=20, max_hp=20, armor_class=12, attack_bonus=3, damage="1d6+2")
    result, monster = game.resolve_action(hero, "cast Shield", monster)
    result = _finalize(game, hero, monster, result)
    shield = next(b for b in result.resolution["beats"] if b.get("kind") == "reaction" and b.get("name") == "shield")
    assert shield["cast"] is True
    assert shield["hero"]["hp_current"] == hero.hp
    assert shield["hero"]["hp_max"] == hero.max_hp
    assert "miss" in " ".join(result.events).lower()
    attacks = [b for b in result.resolution["beats"] if b["kind"] == "attack"]
    assert attacks[-1]["outcome"] == "miss"


def test_ghoul_save_facts_match_journal():
    game = GameEngine(random.Random(11))
    hero = game.create_character(
        1,
        "Scout",
        "human",
        "rogue",
        {"strength": 10, "dexterity": 16, "constitution": 8, "intelligence": 14, "wisdom": 10, "charisma": 10},
    )
    hero.in_combat = True
    hero.combat_turn = "enemy"
    hero.hp = 40
    hero.max_hp = 40
    hero.quest_flags = {}
    hero.armor_class = 14
    monster = MonsterState(
        name="Ghoul",
        hp=20,
        max_hp=20,
        armor_class=13,
        attack_bonus=5,
        damage="1d6+3",
        template_key="ghoul",
    )
    game.rng.randint = lambda a, b: 16 if b == 20 else 2
    events, save_facts = game._enemy_turn(hero, monster)
    result = _finalize(game, hero, monster, TurnResult("enemy", events, True, save_facts=save_facts))
    save_beats = [b for b in result.resolution["beats"] if b["kind"] == "saving_throw"]
    assert save_beats, result.resolution
    beat = save_beats[0]
    joined = " ".join(events)
    assert str(beat["roll"]["total"]) in joined
    assert str(beat["dc"]) in joined
    assert beat["hero"]["hp_current"] == hero.hp
    assert beat["hero"]["hp_max"] == hero.max_hp


def test_low_hp_visible_in_participant_facts():
    from app.engine.reactive_spells import apply_pending_attack_damage, build_pending_attack_payload

    game = GameEngine(random.Random(12))
    hero, monster = _melee(game)
    hero.hp = 5
    hero.max_hp = 20
    hero.armor_class = 8
    game.rng.randint = lambda a, b: 4
    game._begin_turn_resolution()
    pending = build_pending_attack_payload(
        monster=monster,
        monster_key="goblin",
        label="attack",
        melee=True,
        natural=18,
        attack_total=22,
        critical=False,
        damage_dice="1d6",
        damage_bonus=1,
    )
    events = apply_pending_attack_damage(game, hero, monster, pending)
    result = _finalize(game, hero, monster, TurnResult("enemy hit", events, True))
    beat = next(b for b in result.resolution["beats"] if b.get("damage"))
    assert beat["hero"]["hp_current"] == hero.hp
    assert beat["hero"]["hp_max"] == hero.max_hp
    assert beat["hero"]["hp_current"] / beat["hero"]["hp_max"] < 0.25
    journal_hp = _hero_hp_from_journal(events)
    assert journal_hp
    assert beat["hero"]["hp_current"] == journal_hp[0]


@pytest.fixture
def setup_db():
    import asyncio

    asyncio.run(init_db())
    yield


def test_idempotent_action_returns_identical_resolution(setup_db):
    client = TestClient(app)
    client.post("/auth/register", json={"username": "residem", "password": "password123"})
    token = client.post("/auth/login", json={"username": "residem", "password": "password123"}).json()[
        "access_token"
    ]
    headers = {"Authorization": f"Bearer {token}"}
    char_id = client.post(
        "/characters",
        json={"name": "Res", "race": "human", "character_class": "fighter"},
        headers=headers,
    ).json()["id"]
    key = str(uuid.uuid4())
    idem_headers = {**headers, "Idempotency-Key": key}

    from app.db import Session, CharacterRecord, decode_character_state, encode_character_state
    from app.engine.equipment import load_character_state
    import asyncio

    async def seed():
        async with Session() as session:
            record = await session.get(CharacterRecord, char_id)
            hero = load_character_state(decode_character_state(record.payload))
            hero.in_combat = True
            hero.combat_turn = "player"
            hero.combat_distance_ft = MELEE_REACH_FT
            hero.combat_movement_remaining_ft = 30
            hero.combat_flags = {}
            hero.combatant = {"name": "Goblin", "hp": 30, "max_hp": 30, "armor_class": 10}
            from dataclasses import asdict

            record.payload = encode_character_state(asdict(hero))
            await session.commit()

    asyncio.run(seed())
    first = client.post(f"/characters/{char_id}/actions", json={"action": "attack goblin"}, headers=idem_headers)
    second = client.post(f"/characters/{char_id}/actions", json={"action": "attack goblin"}, headers=idem_headers)
    assert first.status_code == 200 and second.status_code == 200
    assert first.json().get("resolution") == second.json().get("resolution")
    assert first.json()["events"] == second.json()["events"]