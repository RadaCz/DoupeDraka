"""Sprint 26 — engine authority for MVP racial traits (SRD 5.1)."""

from __future__ import annotations

import random
from dataclasses import asdict

import pytest

from app.engine.catalog import ABILITY_ORDER, standard_abilities
from app.engine.equipment import load_character_state
from app.engine.race_features import (
    apply_poison_damage_resistance,
    darkvision_range_ft,
    enrich_character_dict,
    halfling_lucky_reroll,
    public_race_reference_traits,
    saving_throw_racial_advantage,
    stonecunning_bonus,
)
from app.engine.saving_throws import SavingThrowRequest, perform_saving_throw
from app.engine.service import GameEngine


@pytest.fixture
def game() -> GameEngine:
    return GameEngine(random.Random(42))


def _fighter(game: GameEngine, race: str, name: str | None = None):
    base = dict(standard_abilities("fighter"))
    return game.create_character(1, name or f"S26-{race}", race, "fighter", base)


def test_reference_traits_modeled_flags():
    lucky = next(t for t in public_race_reference_traits("halfling") if t["trait_id"] == "lucky")
    assert lucky["modeled"] is True
    nimble = next(t for t in public_race_reference_traits("halfling") if t["trait_id"] == "halfling_nimbleness")
    assert nimble["deferred"] is True
    trance = next(t for t in public_race_reference_traits("elf") if t["trait_id"] == "trance")
    assert trance["deferred"] is True


def test_enrich_character_dict_darkvision(game: GameEngine):
    dwarf = _fighter(game, "dwarf")
    payload = enrich_character_dict(dwarf)
    assert payload["race_features"]["darkvision_ft"] == 60
    human = _fighter(game, "human")
    assert enrich_character_dict(human)["race_features"]["darkvision_ft"] is None


def test_elf_keen_senses_perception_on_create(game: GameEngine):
    elf = _fighter(game, "elf")
    assert "Perception" in elf.skill_proficiencies


def test_elf_perception_backfill_on_load(game: GameEngine):
    elf = _fighter(game, "elf")
    data = asdict(elf)
    data["skill_proficiencies"] = [s for s in data["skill_proficiencies"] if s != "Perception"]
    loaded = load_character_state(data)
    assert "Perception" in loaded.skill_proficiencies


def test_halfling_lucky_rerolls_natural_one(game: GameEngine):
    halfling = _fighter(game, "halfling")
    natural, note = halfling_lucky_reroll(halfling, 1, lambda: 12)
    assert natural == 12
    assert "Lucky" in note
    natural2, note2 = halfling_lucky_reroll(halfling, 12, lambda: 1)
    assert natural2 == 12
    assert note2 == ""


def test_halfling_lucky_idempotent_single_reroll(game: GameEngine):
    halfling = _fighter(game, "halfling")
    calls = {"n": 0}

    def pull() -> int:
        calls["n"] += 1
        return 1

    natural, _ = halfling_lucky_reroll(halfling, 1, pull)
    assert natural == 1
    assert calls["n"] == 1


def test_dwarf_poison_save_advantage(game: GameEngine):
    dwarf = _fighter(game, "dwarf")
    req = SavingThrowRequest("constitution", 15, "hazard", "vault_poison", tags=("poison",))
    assert saving_throw_racial_advantage(dwarf, req) is True
    rolls = iter([4, 17])
    result = perform_saving_throw(game, dwarf, req, roll_d20=lambda: next(rolls))
    assert result.advantage is True
    assert result.d20_roll == 17


def test_elf_fey_ancestry_charm_save(game: GameEngine):
    elf = _fighter(game, "elf")
    req = SavingThrowRequest("wisdom", 14, "spell", "charm_person", tags=("charm",))
    assert saving_throw_racial_advantage(elf, req) is True


def test_halfling_brave_frightened_save(game: GameEngine):
    halfling = _fighter(game, "halfling")
    req = SavingThrowRequest("wisdom", 12, "effect", "fear_aura", tags=("fear",))
    assert saving_throw_racial_advantage(halfling, req) is True


def test_racial_advantage_neutralized_when_disadvantage(game: GameEngine):
    dwarf = _fighter(game, "dwarf")
    req = SavingThrowRequest(
        "constitution",
        12,
        "hazard",
        "poison_gas",
        tags=("poison",),
        advantage=True,
        disadvantage=True,
    )
    result = perform_saving_throw(game, dwarf, req, roll_d20=lambda: 10)
    assert result.advantage is False
    assert result.disadvantage is False
    assert result.second_d20 is None


def test_dwarf_poison_damage_resistance():
    dwarf = GameEngine().create_character(1, "D", "dwarf", "fighter", standard_abilities("fighter"))
    reduced, note = apply_poison_damage_resistance(dwarf, 11, damage_type="poison")
    assert reduced == 5
    assert "Dwarven Resilience" in note
    unchanged, _ = apply_poison_damage_resistance(dwarf, 8, damage_type="acid")
    assert unchanged == 8


def test_stonecunning_doubles_history_proficiency(game: GameEngine):
    dwarf = _fighter(game, "dwarf")
    dwarf.skill_proficiencies = list(dwarf.skill_proficiencies) + ["History"]
    bonus = stonecunning_bonus(dwarf, "History", stonework=True)
    assert bonus == 2
    assert stonecunning_bonus(dwarf, "History", stonework=False) == 0
    assert stonecunning_bonus(dwarf, "Arcana", stonework=True) == 0


def test_stonecunning_skill_check_journal(game: GameEngine):
    dwarf = _fighter(game, "dwarf")
    dwarf.skill_proficiencies = list(dwarf.skill_proficiencies) + ["History"]
    game.rng = random.Random(0)
    _result, success, note = game.skill_check(dwarf, "History", 8, stonework=True)
    assert "Stonecunning" in note


def test_human_ability_increases_all_stats(game: GameEngine):
    base = dict(standard_abilities("fighter"))
    human = _fighter(game, "human")
    for ability in ABILITY_ORDER:
        assert human.abilities[ability] == base[ability] + 1


def test_race_features_persist_in_enriched_payload(game: GameEngine):
    elf = _fighter(game, "elf")
    data = enrich_character_dict(elf)
    reloaded = load_character_state({k: v for k, v in data.items() if k != "race_features"})
    assert darkvision_range_ft(reloaded) == 60
    assert "Perception" in reloaded.skill_proficiencies
