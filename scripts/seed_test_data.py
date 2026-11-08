#!/usr/bin/env python3
"""Seed dev data: one QA user, five characters, fifty random engine turns.

Usage (from repo root, venv active):

    python scripts/seed_test_data.py

Uses DATABASE_URL from the environment (same as the API).
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import random
from dataclasses import asdict

from sqlalchemy import select

from app.db import CharacterRecord, EventRecord, Session, User, decode_character_state, encode_character_state, init_db
from app.engine.models import CharacterState, MonsterState
from app.engine.service import GameEngine
from app.telemetry import analytics_rows_from_turn, append_analytics, record_character_created

SEED_USERNAME = "qa_seed_player"
ACTIONS = [
    "look around",
    "explore the corridor",
    "search the area",
    "rest",
    "travel to The Sunken Corridor",
    "travel to The Shrine of the Forgotten",
    "travel to The Goblin Market",
    "buy healing potion",
    "attack the goblin",
    "flee",
]

BUILD_SPECS = [
    ("Aria", "elf", "wizard", 1, 80, ["traveler's clothes", "dagger"]),
    ("Borin", "dwarf", "fighter", 2, 120, ["traveler's clothes", "shortsword", "healing potion"]),
    ("Cira", "human", "cleric", 3, 200, ["traveler's clothes", "mace", "healing potion"]),
    ("Dax", "halfling", "rogue", 4, 150, ["traveler's clothes", "shortsword +1"]),
    ("Elen", "half_elf", "bard", 5, 90, ["traveler's clothes", "rapier"]),
]


async def ensure_user(session) -> User:
    user = await session.scalar(select(User).where(User.username == SEED_USERNAME))
    if user is None:
        user = User(username=SEED_USERNAME, hashed_password="!")
        session.add(user)
        await session.flush()
    return user


async def seed_characters(session, user: User, game: GameEngine) -> list[CharacterState]:
    heroes: list[CharacterState] = []
    for name, race, clazz, level, gold, inventory in BUILD_SPECS:
        hero = game.create_character(user.id, name, race, clazz)
        hero.level = level
        hero.gold = gold
        hero.inventory = list(inventory)
        hero.hp = hero.max_hp
        session.add(CharacterRecord(id=hero.id, owner_id=user.id, payload=encode_character_state(asdict(hero))))
        record_character_created(session, hero.id, race, clazz)
        heroes.append(hero)
    await session.commit()
    return heroes


async def simulate_turns(session, game: GameEngine, heroes: list[CharacterState], turns: int = 50) -> None:
    rng = random.Random(42)
    for _ in range(turns):
        hero = rng.choice(heroes)
        record = await session.scalar(select(CharacterRecord).where(CharacterRecord.id == hero.id))
        if record is None:
            continue
        character = CharacterState(**decode_character_state(record.payload))
        action = rng.choice(ACTIONS)
        if character.hp <= 0:
            character.hp = character.max_hp
        turn_location = character.location
        monster = MonsterState(**character.combatant) if character.combatant else None
        result, active = game.resolve_action(character, action, monster)
        character.combatant = asdict(active) if active else None
        append_analytics(
            session,
            analytics_rows_from_turn(
                character.id,
                result,
                location=turn_location,
                monster_name=monster.name if monster else None,
            ),
        )
        journal = "\n".join(result.events) if result.events else "No change."
        session.add(EventRecord(character_id=character.id, action=action, result=journal))
        record.payload = encode_character_state(asdict(character))
        await session.commit()


async def main() -> None:
    await init_db()
    game = GameEngine(random.Random(7))
    async with Session() as session:
        user = await ensure_user(session)
        await session.commit()
        heroes = await seed_characters(session, user, game)
    async with Session() as session:
        refreshed: list[CharacterState] = []
        for hero in heroes:
            record = await session.get(CharacterRecord, hero.id)
            if record:
                refreshed.append(CharacterState(**decode_character_state(record.payload)))
        heroes = refreshed
        await simulate_turns(session, game, heroes, turns=50)
    print(f"Seeded user {SEED_USERNAME} with {len(heroes)} characters and 50 turns.")
    print("Tip: register/login in dev or attach Telegram to this user id for UI testing.")


if __name__ == "__main__":
    asyncio.run(main())
