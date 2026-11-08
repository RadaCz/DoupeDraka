import pytest

from app.engine import economy
from app.engine.catalog import ABILITY_ORDER, CLASSES, RACES, standard_abilities
from app.engine.encounters import DIFFICULTY_PROFILES, MONSTERS, build_monster, parse_damage, resolve_template
from app.engine.models import DIFFICULTIES, HUMORS, TONES
from app.engine.reference import (
    BACKGROUNDS,
    CLASS_SPECS,
    DRACONIC_ANCESTRY,
    FEATS,
    RACE_SPECS,
    SPELLS,
    background_list,
    class_list,
    feat_list,
    race_list,
)
from app.engine.service import GameEngine
from app.engine.tools import combat_calculator
from app.heroes import HEROES, get_hero


# --------------------------------------------------------------------------
# Encounter difficulty
# --------------------------------------------------------------------------

def test_every_difficulty_has_a_profile():
    assert set(DIFFICULTY_PROFILES) == set(DIFFICULTIES)


def test_difficulty_scaling_is_monotonic():
    """Harder profiles must get more HP, better attack, more damage and more XP."""
    for key in MONSTERS:
        easy, normal, hard = (build_monster(d, key) for d in ("easy", "normal", "hard"))
        assert easy.max_hp <= normal.max_hp <= hard.max_hp
        assert easy.attack_bonus < normal.attack_bonus < hard.attack_bonus
        assert easy.armor_class <= normal.armor_class <= hard.armor_class
        assert easy.reward_xp <= normal.reward_xp <= hard.reward_xp


def test_normal_profile_matches_the_template():
    """`normal` is the 5e baseline, so no value may be invented or lost."""
    for template in MONSTERS.values():
        monster = build_monster("normal", template.key)
        assert (monster.hp, monster.armor_class, monster.attack_bonus) == (
            template.hp, template.armor_class, template.attack_bonus)
        assert monster.damage == f"{template.damage_dice}+{template.damage_bonus}"
        assert monster.reward_xp == template.reward_xp


def test_monster_is_always_viable():
    """Scaling must never produce a 0 HP or AC 0 monster."""
    for key in MONSTERS:
        for difficulty in DIFFICULTIES:
            monster = build_monster(difficulty, key)
            assert monster.max_hp >= 1
            assert monster.armor_class >= 5
            assert monster.reward_xp >= 1
            assert monster.hp == monster.max_hp


def test_unknown_target_falls_back_to_the_default():
    assert resolve_template(None).key == "goblin"
    assert resolve_template("a pale thing").key == "goblin"


def test_target_is_matched_by_key_and_name():
    assert resolve_template("ogre").key == "ogre"
    assert resolve_template("attack the ogre").key == "ogre"
    assert resolve_template("wolf").key == "wolf"


def test_damage_strings_round_trip():
    assert parse_damage("1d6+2") == ("1d6", 2)
    assert parse_damage("2d8") == ("2d8", 0)


# --------------------------------------------------------------------------
# Economy (integer tenths, never float drift)
# --------------------------------------------------------------------------

def test_tier_costs_match_the_design():
    assert economy.turn_cost("lite") == 0
    assert economy.turn_cost("normal") == 10
    assert economy.turn_cost("pro") == 14


def test_starting_balance_is_100():
    assert economy.STARTING_BALANCE_TENTHS == 1000
    assert economy.to_units(economy.STARTING_BALANCE_TENTHS) == 100.0


def test_free_tier_does_not_reduce_balance():
    balance = 100
    for _ in range(10):
        balance, charged = economy.charge(balance, "lite")
        assert charged == 0
    assert balance == 100


def test_charge_refuses_to_overdraw():
    with pytest.raises(ValueError, match="Insufficient"):
        economy.charge(5, "normal")


def test_can_afford_boundaries():
    assert economy.can_afford(0, "lite")
    assert economy.can_afford(0, "normal") is False


def test_unknown_tier_and_package_raise():
    with pytest.raises(ValueError):
        economy.turn_cost("quantum")
    with pytest.raises(ValueError):
        economy.package_for("free-money")


def test_packages_are_priced_sanely():
    for package in economy.PACKAGES.values():
        assert package.mana_tenths > 0
        assert package.price_rub > 0


# --------------------------------------------------------------------------
# Reference data (drives the tooltips, so it must be complete)
# --------------------------------------------------------------------------

def test_every_race_has_traits_and_speed():
    for key, spec in RACE_SPECS.items():
        assert spec.traits, key
        assert spec.speed > 0, key
        assert spec.name


def test_every_class_has_subclasses_and_hit_die():
    for key, spec in CLASS_SPECS.items():
        assert len(spec.subclasses) == 1, key
        assert 6 <= spec.hit_die <= 12, key
        assert spec.primary in ABILITY_ORDER, key


def test_reference_covers_every_playable_race_and_class():
    """Anything the engine can create must be documented for the UI."""
    assert set(RACES) <= set(RACE_SPECS)
    assert set(CLASSES) <= set(CLASS_SPECS)


def test_trap_tooltips_the_gdd_calls_out():
    halfling = {t.name for t in RACE_SPECS["halfling"].traits}
    assert {"Lucky", "Halfling Nimbleness", "Brave"} <= halfling
    tiefling = {t.name for t in RACE_SPECS["tiefling"].traits}
    assert "Infernal Legacy" in tiefling
    warlock = {s.name for s in CLASS_SPECS["warlock"].subclasses}
    assert warlock == {"The Fiend"}


def test_dragonborn_has_all_ten_ancestries():
    assert len(DRACONIC_ANCESTRY) == 10
    assert set(DRACONIC_ANCESTRY) == set(RACE_SPECS["dragonborn"].subraces)
    for damage, breath in DRACONIC_ANCESTRY.values():
        assert damage and breath


def test_spell_library_is_shaped_for_the_ui():
    assert len(SPELLS) == 319
    names = {spell["name"] for spell in SPELLS}
    assert len(names) == 319
    assert {"Goodberry", "Harm", "Zone of Truth"} <= names
    for spell in SPELLS:
        assert {"name", "level", "school", "range", "text"} <= set(spell)
        assert 0 <= spell["level"] <= 9
        assert spell["range"] and spell["text"]


def test_srd_feat_and_background_reference_counts():
    assert len(FEATS) == 1
    assert FEATS[0]["name"] == "Grappler"
    assert len(BACKGROUNDS) == 1
    assert BACKGROUNDS[0]["name"] == "Acolyte"
    assert feat_list()[0]["benefits"]
    assert background_list()[0]["feature"]["name"] == "Shelter of the Faithful"


def test_reference_serializes_to_json():
    races, classes = race_list(), class_list()
    assert all("traits" in race and "subraces" in race for race in races)
    assert all("subclasses" in klass for klass in classes)
    assert all(len(klass["subclasses"]) == 1 for klass in classes)


# --------------------------------------------------------------------------
# Tools: 5e encounter difficulty bands
# --------------------------------------------------------------------------

def test_combat_calculator_bands_are_ordered():
    solo_easy = combat_calculator([3], ["kobold"])
    solo_deadly = combat_calculator([1], ["ogre", "ogre", "ogre"])
    assert solo_easy["adjusted_xp"] < solo_deadly["adjusted_xp"]
    assert solo_easy["band"] in ("easy", "medium", "hard", "deadly", "trivial")
    assert solo_deadly["band"] == "deadly"


def test_combat_calculator_group_multiplier_applies():
    one = combat_calculator([1], ["goblin"])
    three = combat_calculator([1], ["goblin", "goblin", "goblin"])
    assert three["base_xp"] == 3 * one["base_xp"]
    assert three["multiplier"] > one["multiplier"]


def test_combat_calculator_reaches_every_band():
    """Regression: a duplicated `deadly` branch used to make `hard` unreachable."""
    from app.engine.tools import BANDS

    seen = set()
    # Sweep the party size and the monster count until every band is produced.
    for levels in ([8], [5], [3], [2], [1]):
        for monsters in (["kobold"], ["goblin"], ["goblin", "goblin"], ["ogre"], ["ogre", "ogre"]):
            seen.add(combat_calculator(levels, monsters)["band"])
    assert "hard" in seen, f"hard band unreachable; only saw {sorted(seen)}"
    assert "deadly" in seen
    assert seen <= set(BANDS)


def test_combat_calculator_bands_are_monotonic():
    """Adding the same monster must never lower the difficulty band."""
    order = ["trivial", "easy", "medium", "hard", "deadly"]
    previous = -1
    for count in range(1, 7):
        band = combat_calculator([1], ["goblin"] * count)["band"]
        index = order.index(band)
        assert index >= previous, f"band dropped at {count} goblins: {band}"
        previous = index


def test_combat_calculator_rejects_empty_input():
    with pytest.raises(ValueError):
        combat_calculator([], ["goblin"])
    with pytest.raises(ValueError):
        combat_calculator([1], [])


def test_combat_calculator_rejects_bad_levels():
    with pytest.raises(ValueError):
        combat_calculator([0], ["goblin"])


# --------------------------------------------------------------------------
# Pre-made heroes
# --------------------------------------------------------------------------

def test_presets_match_the_design():
    assert set(HEROES) == {"tank", "skirmisher", "support", "healer"}
    assert HEROES["tank"].race == "half_orc"
    assert HEROES["tank"].character_class == "barbarian"
    assert HEROES["skirmisher"].character_class == "rogue"
    assert HEROES["support"].character_class == "bard"
    assert HEROES["healer"].character_class == "cleric"


def test_every_hero_creates_a_playable_character():
    game = GameEngine()
    for key, hero in HEROES.items():
        character = game.create_character(1, hero.name, hero.race, hero.character_class, hero.abilities)
        assert set(character.abilities) == set(ABILITY_ORDER), key
        assert all(3 <= score <= 20 for score in character.abilities.values()), key
        # The whole point of a pre-made hero: it can actually fight.
        assert character.armor_class >= 13, key
        assert character.max_hp >= 8, key
        primary = CLASSES[hero.character_class].primary
        assert character.abilities[primary] >= 16, key


def test_hero_abilities_are_level_one_legal():
    """Pre-made heroes are explicit spreads, but must stay inside legal bounds."""
    for key, hero in HEROES.items():
        assert set(hero.abilities) == set(ABILITY_ORDER), key
        assert all(8 <= score <= 17 for score in hero.abilities.values()), key
        # Nobody starts with a wasted primary ability.
        assert max(hero.abilities.values()) >= 16, key


def test_unknown_preset_raises():
    with pytest.raises(ValueError, match="Unknown preset"):
        get_hero("necromancer")


# --------------------------------------------------------------------------
# Campaign settings
# --------------------------------------------------------------------------

def test_settings_are_defaulted():
    hero = GameEngine().create_character(1, "Arin", "human", "fighter")
    assert (hero.difficulty, hero.tone, hero.humor, hero.verbose) == ("normal", "balanced", "rare", True)


def test_apply_settings_validates_and_sets():
    game = GameEngine()
    hero = game.create_character(1, "Arin", "human", "fighter")
    game.apply_settings(hero, difficulty="hard", tone="grimdark", humor="comedy", verbose=False)
    assert (hero.difficulty, hero.tone, hero.humor, hero.verbose) == ("hard", "grimdark", "comedy", False)


@pytest.mark.parametrize("field,value", [
    ("difficulty", "impossible"),
    ("tone", "shakespearean"),
    ("humor", "sarcastic"),
])
def test_apply_settings_rejects_unknown_values(field, value):
    game = GameEngine()
    hero = game.create_character(1, "Arin", "human", "fighter")
    with pytest.raises(ValueError, match=field):
        game.apply_settings(hero, **{field: value})
    # A rejected update must not partially apply.
    assert hero.difficulty == "normal" and hero.tone == "balanced" and hero.humor == "rare"


def test_settings_survive_a_payload_round_trip():
    """Stored characters written before settings existed must still decode."""
    from dataclasses import asdict
    from app.engine.models import CharacterState

    hero = GameEngine().create_character(1, "Old", "human", "fighter")
    payload = asdict(hero)
    for key in ("difficulty", "tone", "humor", "verbose"):
        payload.pop(key)
    restored = CharacterState(**payload)
    assert (restored.difficulty, restored.tone, restored.humor, restored.verbose) == \
        ("normal", "balanced", "rare", True)


def test_constants_are_exposed():
    assert TONES == ("light", "balanced", "dark", "grimdark")
    assert HUMORS == ("serious", "rare", "frequent", "comedy")
    assert DIFFICULTIES == ("easy", "normal", "hard")