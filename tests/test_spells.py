import json
import random

from app.db import decode_character_state
from app.engine.models import CharacterState, MonsterState, RollResult
from app.engine.reference import SPELLS
from app.engine.service import GameEngine
from app.engine.spells import (
    CLASS_SPELL_LISTS,
    MODELED_SPELL_EFFECTS,
    PREPARED_CASTERS,
    SPELLCASTING_ABILITIES,
    spell_slot_progression,
)


def create_hero(character_class: str, **scores: int) -> CharacterState:
    abilities = {
        "strength": 10,
        "dexterity": 10,
        "constitution": 10,
        "intelligence": 10,
        "wisdom": 10,
        "charisma": 10,
    }
    abilities.update(scores)
    hero = GameEngine(random.Random(1)).create_character(
        1, "Arin", "human", character_class, abilities
    )
    if character_class == "wizard":
        for spell in ("Magic Missile", "Shield"):
            if spell not in hero.known_spells:
                hero.known_spells.append(spell)
            if spell not in hero.prepared_spells:
                hero.prepared_spells.append(spell)
    return hero


def force_high_rolls(game: GameEngine) -> None:
    game.rng.randint = lambda lower, upper: upper


def begin_combat(hero: CharacterState) -> None:
    hero.in_combat = True
    hero.combat_turn = "player"


def assert_active_monster(hero: CharacterState, monster: MonsterState, returned: MonsterState | None) -> None:
    """Engine returns the live monster only while combat continues."""
    if hero.in_combat:
        assert returned is monster
    else:
        assert returned is None


def test_class_spell_lists_only_use_srd_catalog_cantrips_and_level_one_spells():
    catalog = {spell["name"]: spell["level"] for spell in SPELLS}
    assert set(CLASS_SPELL_LISTS) == set(SPELLCASTING_ABILITIES)
    for levels in CLASS_SPELL_LISTS.values():
        assert set(levels) == {0, 1}
        assert all(catalog[name] == level for level, names in levels.items() for name in names)
    assert CLASS_SPELL_LISTS["paladin"][0] == ()
    assert CLASS_SPELL_LISTS["ranger"][0] == ()


def test_character_initialization_assigns_class_ability_and_selected_spells():
    wizard = create_hero("wizard", intelligence=16)
    cleric = create_hero("cleric", wisdom=16)
    assert wizard.spellcasting_ability == "int"
    assert {"Fire Bolt", "Mage Hand", "Light"} <= set(wizard.known_spells)
    leveled = [s for s in wizard.known_spells if s not in {"Fire Bolt", "Mage Hand", "Light"}]
    # G-09 / character_creation: wizard knows 4 level-1 spells at creation (not 6).
    assert len(leveled) == 4
    assert {"Sacred Flame", "Cure Wounds"} <= set(cleric.prepared_spells)
    assert cleric.known_spells == []


def test_full_casters_start_with_two_level_one_slots():
    for character_class in ("bard", "cleric", "druid", "sorcerer", "wizard"):
        hero = create_hero(character_class)
        assert hero.spell_slots == {1: 2}
        assert hero.max_spell_slots == {1: 2}


def test_half_casters_gain_slots_and_prepared_spells_at_level_two():
    game = GameEngine(random.Random(1))
    for character_class in ("paladin", "ranger"):
        hero = create_hero(character_class)
        assert hero.spell_slots == {}
        assert hero.prepared_spells == []
        hero.xp = 100
        game._level_up(hero)
        assert hero.level == 2
        assert hero.spell_slots == {1: 2}
        assert hero.prepared_spells


def test_warlock_pact_slots_follow_pact_progression():
    assert spell_slot_progression("warlock", 1) == {1: 1}
    assert spell_slot_progression("warlock", 2) == {1: 2}
    assert spell_slot_progression("warlock", 3) == {2: 2}
    assert spell_slot_progression("warlock", 11) == {5: 3}


def test_cantrip_damages_active_enemy_without_spending_a_spell_slot():
    game = GameEngine(random.Random(1))
    force_high_rolls(game)
    hero = create_hero("wizard", intelligence=16)
    hero.hp = hero.max_hp = 80
    monster = MonsterState(hp=50, max_hp=50, armor_class=12)
    begin_combat(hero)
    result, after = game.resolve_action(hero, "CAST   fire   bolt", monster)
    assert_active_monster(hero, monster, after)
    assert monster.hp < 50
    assert hero.spell_slots == {1: 2}
    assert result.spell_facts["slot_consumed"] is False
    assert result.spell_facts["target_hp_after"] == monster.hp


def test_level_one_spell_consumes_one_slot_and_exposes_structured_facts():
    game = GameEngine(random.Random(1))
    force_high_rolls(game)
    hero = create_hero("wizard")
    monster = MonsterState(hp=50, max_hp=50, armor_class=12)
    result, _ = game.resolve_action(hero, "cast    MAGIC   MISSILE at Goblin", None)
    assert result.spell_facts["spell_name"] == "Magic Missile"
    assert result.spell_facts["slot_level"] == 1
    assert result.spell_facts["slot_consumed"] is True
    assert result.spell_facts["effect"]["damage"] == 15
    assert hero.spell_slots == {1: 1}


def test_level_one_spell_without_slots_leaves_character_and_encounter_unchanged():
    game = GameEngine(random.Random(1))
    hero = create_hero("wizard")
    hero.spell_slots.clear()
    before_combat = hero.in_combat
    result, monster = game.resolve_action(hero, "cast Magic Missile at goblin", None)
    assert not result.state_changed
    assert monster is None
    assert hero.in_combat is before_combat
    assert hero.spell_slots == {}
    assert not result.spell_facts["slot_consumed"]
    assert "no level 1 spell slots" in result.events[0].lower()


def test_unknown_spell_is_rejected_without_changing_slots_or_hp():
    game = GameEngine(random.Random(1))
    hero = create_hero("wizard")
    hero.hp -= 1
    before = (hero.hp, dict(hero.spell_slots), hero.mana)
    result, monster = game.resolve_action(hero, "cast Hex", None)
    assert monster is None
    assert not result.state_changed
    assert (hero.hp, hero.spell_slots, hero.mana) == before
    assert not result.spell_facts["slot_consumed"]


def test_spell_attack_uses_spellcasting_ability_and_reduces_enemy_hp():
    game = GameEngine(random.Random(1))
    force_high_rolls(game)
    hero = create_hero("wizard", intelligence=18)
    monster = MonsterState(hp=40, max_hp=40, armor_class=13)
    result, _ = game.resolve_action(hero, "cast Fire Bolt at Goblin", monster)
    attack = result.spell_facts["effect"]["attacks"][0]
    assert attack["roll"]["modifier"] == 6
    assert attack["hit"]
    assert monster.hp < 40


def test_magic_missile_is_three_auto_hit_darts():
    game = GameEngine(random.Random(1))
    force_high_rolls(game)
    hero = create_hero("wizard")
    hero.hp = hero.max_hp = 80
    enemy = MonsterState(hp=50, max_hp=50, armor_class=12)
    begin_combat(hero)
    result, monster = game.resolve_action(hero, "cast Magic Missile at goblin", enemy)
    assert_active_monster(hero, enemy, monster)
    assert len(result.spell_facts["effect"]["darts"]) == 3
    assert result.spell_facts["effect"]["damage"] == 15


def test_healing_spell_restores_hp_but_never_exceeds_maximum():
    game = GameEngine(random.Random(1))
    force_high_rolls(game)
    hero = create_hero("cleric", wisdom=16)
    hero.hp = hero.max_hp - 2
    result, _ = game.resolve_action(hero, "cast Cure   Wounds", None)
    assert hero.hp == hero.max_hp
    assert result.spell_facts["effect"]["healing"] == 2
    assert result.spell_facts["effect"]["dice_result"]["modifier"] == 6
    assert result.spell_facts["effect"]["disciple_of_life"] == 3
    assert result.spell_facts["effect"]["dice_result"]["total"] == 14
    assert result.spell_facts["target_hp_after"] == hero.max_hp
    assert hero.spell_slots == {1: 1}


def test_healing_word_uses_bonus_action_in_combat():
    game = GameEngine(random.Random(1))
    force_high_rolls(game)
    hero = create_hero("bard", charisma=16)
    hero.max_hp = 20
    hero.hp = 10
    hero.in_combat = True
    hero.combat_turn = "player"
    from app.engine.class_features import mark_player_turn_start

    mark_player_turn_start(hero)
    monster = MonsterState(name="Wolf", hp=20, max_hp=20, armor_class=12)

    result, _ = game.resolve_action(hero, "cast Healing Word", monster)

    assert result.spell_facts["effect"]["healing"] == 7
    assert result.spell_facts["effect"]["action_cost"] == "bonus"
    assert hero.combat_flags.get("bonus_action_used")
    assert not hero.combat_flags.get("action_used")
    assert hero.spell_slots == {1: 1}


def test_half_caster_at_level_one_reports_no_slots_yet():
    game = GameEngine(random.Random(1))
    hero = create_hero("paladin")

    result, monster = game.resolve_action(hero, "cast Cure Wounds", None)

    assert monster is None
    assert not result.state_changed
    assert "no spell slots yet" in result.events[0].lower()
    assert hero.spell_slots == {}
    assert hero.prepared_spells == []


def test_burning_hands_successful_save_halves_damage_and_consumes_slot():
    game = GameEngine(random.Random(1))
    force_high_rolls(game)
    hero = create_hero("wizard")
    monster = MonsterState(hp=50, max_hp=50, saving_throws={"dexterity": 0})
    result, _ = game.resolve_action(hero, "cast Burning Hands", monster)
    assert result.spell_facts["save_result"]["succeeded"]
    assert result.spell_facts["save_result"]["dc"] == 10  # INT 10 wizard: 8 + prof + mod
    assert result.spell_facts["effect"]["damage"] == 9
    assert monster.hp == 41
    assert hero.spell_slots == {1: 1}


def test_sacred_flame_successful_save_deals_no_damage():
    game = GameEngine(random.Random(1))
    force_high_rolls(game)
    hero = create_hero("cleric", wisdom=16)
    monster = MonsterState(hp=50, max_hp=50, saving_throws={"dexterity": 0})
    result, _ = game.resolve_action(hero, "cast Sacred Flame", monster)
    assert result.spell_facts["save_result"]["succeeded"]
    assert result.spell_facts["effect"]["damage"] == 0
    assert monster.hp == 50
    assert hero.spell_slots == {1: 2}


def test_unmodeled_known_spell_is_honest_and_does_not_spend_a_slot():
    game = GameEngine(random.Random(1))
    hero = create_hero("wizard")
    before = dict(hero.spell_slots)
    if "Detect Magic" not in hero.known_spells:
        hero.known_spells.append("Detect Magic")
    result, monster = game.resolve_action(hero, "cast Detect Magic", None)
    assert monster is None
    assert not result.state_changed
    assert hero.spell_slots == before
    assert result.spell_facts["effect"]["type"] == "not_modeled"
    assert "spell resolved, effect not yet modeled" in result.events[0].lower()


def test_old_character_payload_decodes_with_default_spell_fields():
    payload = json.dumps({
        "id": "old-hero",
        "owner_id": 1,
        "name": "Old Arin",
        "race": "human",
        "character_class": "wizard",
        "abilities": {"intelligence": 16},
    })
    hero = CharacterState(**decode_character_state(payload))
    assert hero.spell_slots == {}
    assert hero.max_spell_slots == {}
    assert hero.known_spells == []
    assert hero.prepared_spells == []
    assert hero.spellcasting_ability == ""


def test_failed_cast_on_legacy_character_does_not_hydrate_spell_state():
    hero = CharacterState(
        id="legacy",
        owner_id=1,
        name="Old Arin",
        race="human",
        character_class="wizard",
        abilities={"intelligence": 16},
    )
    before = (
        dict(hero.spell_slots),
        dict(hero.max_spell_slots),
        list(hero.known_spells),
        list(hero.prepared_spells),
        hero.spellcasting_ability,
    )

    result, _ = GameEngine(random.Random(1)).resolve_action(hero, "cast Hex", None)

    assert not result.state_changed
    assert (
        hero.spell_slots,
        hero.max_spell_slots,
        hero.known_spells,
        hero.prepared_spells,
        hero.spellcasting_ability,
    ) == before


def test_vicious_mockery_failed_save_applies_disadvantage():
    game = GameEngine(random.Random(1))
    game.rng.randint = lambda lower, upper: 1 if upper == 20 else lower
    hero = create_hero("bard", charisma=16)
    begin_combat(hero)
    monster = MonsterState(hp=50, max_hp=50, saving_throws={"wisdom": 0})
    result, monster = game.resolve_action(hero, "cast Vicious Mockery", monster)
    assert result.spell_facts["effect"].get("disadvantage_next_attack") is True
    assert any("disadvantage on its next attack" in event for event in result.events)
    assert not any("effect is not modeled" in event for event in result.events)
