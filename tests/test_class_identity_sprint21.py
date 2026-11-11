"""Sprint 21 — class identity mechanics (deterministic RNG)."""

import random

from app.engine.equipment import compute_armor_class, refresh_armor_class, set_equipped_weapon
from app.engine.models import MonsterState
from app.engine.service import GameEngine


def hero(klass: str, **scores: int):
    abilities = dict.fromkeys(
        ("strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"),
        10,
    )
    abilities.update(scores)
    engine = GameEngine(random.Random(21))
    return engine.create_character(
        1,
        "Test",
        "human",
        klass,
        abilities,
        fighting_style="defense" if klass == "fighter" else None,
        expertise_skills=["Stealth", "Acrobatics"] if klass == "rogue" else None,
    )


def begin(hero):
    hero.in_combat = True
    hero.combat_turn = "player"
    hero.combat_flags = {}


def force_max_rolls(game: GameEngine):
    game.rng.randint = lambda low, high: high


def test_fighter_defense_style_increases_ac_with_armor():
    fighter = hero("fighter", strength=16, dexterity=12)
    fighter.fighting_style = "defense"
    refresh_armor_class(fighter)
    ac_defense = fighter.armor_class
    fighter.fighting_style = ""
    refresh_armor_class(fighter)
    assert ac_defense == fighter.armor_class + 1


def test_fighter_dueling_adds_damage_with_shortsword():
    game = GameEngine(random.Random(3))
    force_max_rolls(game)
    fighter = hero("fighter", strength=16, dexterity=10)
    fighter.fighting_style = "dueling"
    set_equipped_weapon(fighter, "shortsword")
    monster = MonsterState(hp=30, max_hp=30, armor_class=10)
    begin(fighter)
    events, facts = game.attack(fighter, monster)
    assert any("Damage" in line for line in events)
    assert facts.get("dueling_bonus") == 2
    assert monster.hp < 30


def test_second_wind_heals_once_per_rest_cycle():
    game = GameEngine(random.Random(5))
    force_max_rolls(game)
    fighter = hero("fighter", constitution=14)
    fighter.hp = 5
    fighter.second_wind_available = True
    begin(fighter)
    ok, events, facts = __import__(
        "app.engine.class_features", fromlist=["use_second_wind"]
    ).use_second_wind(game, fighter)
    assert ok and facts["healing"] > 0
    assert fighter.second_wind_available is False
    ok2, _, _ = __import__(
        "app.engine.class_features", fromlist=["use_second_wind"]
    ).use_second_wind(game, fighter)
    assert not ok2
    from app.engine.class_features import on_short_rest_class_features

    on_short_rest_class_features(fighter)
    assert fighter.second_wind_available is True


def test_rogue_expertise_doubles_proficiency_on_skill():
    game = GameEngine(random.Random(1))
    rogue = hero("rogue", dexterity=16)
    rogue.expertise_skills = ["Stealth"]
    mod_plain = game.modifier(rogue.abilities["dexterity"]) + 2
    mod_expert = game.skill_modifier(rogue, "Stealth")
    assert mod_expert == mod_plain + 2


def test_sneak_attack_requires_advantage():
    game = GameEngine(random.Random(9))
    force_max_rolls(game)
    rogue = hero("rogue", dexterity=16)
    rogue.expertise_skills = ["Stealth", "Acrobatics"]
    set_equipped_weapon(rogue, "shortsword")
    monster = MonsterState(hp=40, max_hp=40, armor_class=10)
    begin(rogue)
    events_no_adv, facts = game.attack(rogue, monster)
    assert "sneak_attack" not in facts
    assert any("Sneak Attack unavailable" in line for line in events_no_adv)
    rogue.combat_flags = {"hidden": True, "attack_advantage": True}
    hp_before = monster.hp
    _, facts2 = game.attack(rogue, monster)
    assert "sneak_attack" in facts2
    assert monster.hp < hp_before


def test_cleric_life_domain_and_disciple_of_life_on_cure_wounds():
    game = GameEngine(random.Random(11))
    force_max_rolls(game)
    cleric = hero("cleric", wisdom=16)
    cleric.divine_domain = "life"
    cleric.hp = 5
    cleric.spell_slots = {1: 2}
    cleric.in_combat = True
    cleric.combat_turn = "player"
    result, _ = game.resolve_action(cleric, "cast Cure Wounds", MonsterState())
    assert result.state_changed
    assert result.spell_facts["effect"].get("disciple_of_life") == 3
    assert "Bless" in cleric.prepared_spells


def test_wizard_spellbook_separate_from_prepared():
    wizard = hero("wizard", intelligence=16)
    leveled_known = [s for s in wizard.known_spells if s not in {"Fire Bolt", "Mage Hand", "Light"}]
    assert len(leveled_known) >= 3
    assert len(wizard.prepared_spells) <= 4
    assert set(wizard.prepared_spells).issubset(set(wizard.known_spells))


def test_arcane_recovery_after_short_rest():
    wizard = hero("wizard", intelligence=16)
    wizard.spell_slots = {1: 0}
    wizard.max_spell_slots = {1: 2}
    wizard.arcane_recovery_available = True
    wizard.arcane_recovery_ready = False
    from app.engine.class_features import on_short_rest_class_features, use_arcane_recovery

    on_short_rest_class_features(wizard)
    assert wizard.arcane_recovery_ready is True
    ok, _, facts = use_arcane_recovery(wizard)
    assert ok and facts["slots_restored"].get(1, 0) == 1
    assert wizard.spell_slots[1] == 1
    ok2, _, _ = use_arcane_recovery(wizard)
    assert not ok2
    assert wizard.arcane_recovery_available is False


def test_short_rest_at_full_hp_enables_arcane_recovery_without_restoring_slots():
    game = GameEngine(random.Random(31))
    wizard = hero("wizard", intelligence=15)
    wizard.spell_slots = {1: 1}
    wizard.max_spell_slots = {1: 2}
    result, _ = game.resolve_action(wizard, "take a breather", None)
    assert result.state_changed
    assert wizard.arcane_recovery_ready is True
    assert wizard.spell_slots[1] == 1


def test_arcane_recovery_via_resolve_action_restores_to_cap():
    game = GameEngine(random.Random(32))
    wizard = hero("wizard", intelligence=15)
    wizard.spell_slots = {1: 0}
    wizard.max_spell_slots = {1: 2}
    from app.engine.class_features import on_short_rest_class_features

    on_short_rest_class_features(wizard)
    result, _ = game.resolve_action(wizard, "arcane recovery", None)
    assert result.state_changed
    assert result.class_facts.get("kind") == "arcane_recovery"
    assert wizard.spell_slots[1] == 1
    again, _ = game.resolve_action(wizard, "arcane recovery", None)
    assert not again.state_changed


def test_persistence_fields_survive_load():
    from dataclasses import asdict
    from app.engine.equipment import load_character_state

    fighter = hero("fighter")
    fighter.fighting_style = "dueling"
    payload = asdict(fighter)
    restored = load_character_state(payload)
    assert restored.fighting_style == "dueling"
