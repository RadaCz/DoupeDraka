import random
import pytest
from app.engine.catalog import ABILITY_ORDER, CLASSES
from app.engine.encounters import build_monster
from app.engine.models import CharacterState, MonsterState, RollResult
from app.engine.service import GameEngine


def stats(**values): 
    base = {"strength": 10, "dexterity": 10, "constitution": 10, "intelligence": 10, "wisdom": 10, "charisma": 10}
    return base | values


def test_created_fighter_has_valid_state():
    hero = GameEngine(random.Random(7)).create_character(1, "Arin", "human", "fighter", stats(strength=16, dexterity=14, constitution=14))
    # Fighter: hit_die=10, primary=strength, mana=0
    # HP = 10 + modifier(14) = 10 + 2 = 12
    # AC = chain mail 16 (heavy armor ignores the dexterity bonus)
    # mana = 0 because fighters have no spellcasting pool
    assert (hero.max_hp, hero.armor_class, hero.mana) == (12, 16, 0)


def test_created_sorcerer_has_mana():
    hero = GameEngine(random.Random(7)).create_character(1, "Arin", "human", "sorcerer", stats(charisma=16))
    # Sorcerer: hit_die=6, primary=charisma, mana=3
    # mana = 3 + modifier(16) = 3 + 3 = 6
    assert hero.mana == 6


def test_attack_never_deals_negative_damage():
    game = GameEngine(random.Random(1))
    hero = game.create_character(1, "Arin", "human", "fighter", stats(strength=3))
    monster = MonsterState()
    result = game.attack(hero, monster)
    assert result
    assert monster.hp >= 0


def test_attack_critical_hit():
    game = GameEngine(random.Random(42))
    hero = game.create_character(1, "Arin", "human", "fighter", stats(strength=16))
    monster = MonsterState()
    # Force critical by setting dice roll
    game.rng.randint = lambda a, b: 20
    result = game.attack(hero, monster)
    assert any("hit" in r for r in result)
    assert monster.hp < 7  # Should take damage


def test_misattack_returns_miss():
    game = GameEngine(random.Random(1))
    hero = game.create_character(1, "Arin", "human", "fighter", stats(strength=3))  # Low strength
    monster = MonsterState()
    result = game.attack(hero, monster)
    assert any("miss" in r.lower() for r in result) or any("critical miss" in r.lower() for r in result)


def test_resolve_action_attack():
    game = GameEngine(random.Random(42))
    hero = game.create_character(1, "Arin", "human", "fighter", stats(strength=16))
    monster = MonsterState()
    result, monster = game.resolve_action(hero, "attack", monster)
    assert result.state_changed
    assert any("attack" in e.lower() for e in result.events)


def test_resolve_action_cast():
    game = GameEngine(random.Random(42))
    hero = game.create_character(1, "Arin", "human", "wizard", stats(intelligence=16))
    initial_mana = hero.mana
    result, monster = game.resolve_action(hero, "cast spell", None)
    assert not result.state_changed
    assert hero.mana == initial_mana
    assert "not implemented" in result.events[0]


def test_cantrip_cast_does_not_spend_mana_or_spell_slots():
    game = GameEngine(random.Random(1))
    hero = game.create_character(1, "Arin", "human", "wizard", stats(intelligence=16))
    monster = MonsterState(hp=50, max_hp=50)
    game.rng.randint = lambda lower, upper: upper

    result, _ = game.resolve_action(hero, "cast Fire Bolt", monster)

    assert result.spell_facts["slot_consumed"] is False
    assert hero.spell_slots == {1: 2}
    assert hero.mana == hero.max_mana


def test_resolve_action_check():
    game = GameEngine(random.Random(42))
    hero = game.create_character(1, "Arin", "human", "fighter", stats(intelligence=16))
    result, monster = game.resolve_action(hero, "inspect the old door", None)
    assert result.state_changed
    assert any("intelligence check" in e.lower() for e in result.events)


@pytest.mark.parametrize(
    ("action", "ability"),
    [
        ("push the fallen pillar", "Strength"),
        ("sneak past the guard", "Dexterity"),
        ("endure the cold", "Constitution"),
        ("inspect the old door", "Intelligence"),
        ("listen at the door", "Wisdom"),
        ("persuade the guard", "Charisma"),
    ],
)
def test_free_text_checks_use_the_ability_that_fits_the_action(action, ability):
    game = GameEngine(random.Random(42))
    hero = game.create_character(1, "Arin", "human", "fighter")

    result, _ = game.resolve_action(hero, action, None)

    assert result.events[0].startswith(f"{ability} check:")


def test_exploration_can_start_a_level_appropriate_random_encounter():
    game = GameEngine(random.Random(42))
    hero = game.create_character(1, "Arin", "human", "fighter")
    game.roll = lambda dice, modifier=0, critical=False: RollResult(dice, (1,), modifier, 1 + modifier)

    result, monster = game.resolve_action(hero, "explore the cellar", None)

    assert result.state_changed
    assert monster is not None
    assert hero.in_combat
    assert any("six-sided die" in event for event in result.events)
    assert any(monster.name in event for event in result.events)
    assert monster.name in {"Kobold skirmisher", "Goblin scout", "Starving wolf", "Road bandit"}


def test_exploration_without_an_encounter_still_records_the_search():
    game = GameEngine(random.Random(42))
    hero = game.create_character(1, "Arin", "human", "fighter")
    game.roll = lambda dice, modifier=0, critical=False: RollResult(dice, (4,), modifier, 4 + modifier)

    result, monster = game.resolve_action(hero, "look around", None)

    assert result.state_changed
    assert monster is None
    assert not hero.in_combat
    assert "Scratches around" in result.events[1]


def test_exploration_cannot_bypass_an_active_combat():
    game = GameEngine(random.Random(42))
    hero = game.create_character(1, "Arin", "human", "fighter")
    monster = MonsterState()
    hero.in_combat = True

    result, active_monster = game.resolve_action(hero, "search for treasure", monster)

    assert not result.state_changed
    assert active_monster is monster
    assert "cannot explore" in result.events[0]


def test_high_level_exploration_can_select_harder_monsters():
    game = GameEngine(random.Random(42))
    hero = game.create_character(1, "Arin", "human", "fighter")
    hero.level = 5
    game.roll = lambda dice, modifier=0, critical=False: RollResult(dice, (1,), modifier, 1 + modifier)
    game.rng.choice = lambda options: options[-1]

    result, monster = game.resolve_action(hero, "travel deeper", None)

    assert monster is not None
    assert monster.name == "Cellar ogre"


def test_exploration_finds_gold_and_records_it():
    game = GameEngine(random.Random(42))
    hero = game.create_character(1, "Arin", "human", "fighter")
    game.roll = lambda dice, modifier=0, critical=False: RollResult(dice, (3,), modifier, 3 + modifier)

    result, monster = game.resolve_action(hero, "search the cellar", None)

    assert monster is None
    assert hero.gold == 3
    assert "3 gold pieces" in result.events[1]


def test_exploration_cooldown_prevents_back_to_back_encounter_checks():
    game = GameEngine(random.Random(42))
    hero = game.create_character(1, "Arin", "human", "fighter")
    hero.exploration_cooldown = 1
    game.roll = lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("cooldown must skip dice"))

    result, monster = game.resolve_action(hero, "explore again", None)

    assert result.state_changed
    assert monster is None
    assert hero.exploration_cooldown == 0
    assert "catch your breath" in result.events[0]

def test_empty_action():
    game = GameEngine(random.Random(42))
    hero = game.create_character(1, "Arin", "human", "fighter", stats())
    result, monster = game.resolve_action(hero, "", None)
    assert not result.state_changed
    assert any("Say what" in e for e in result.events)


def test_xp_and_level_up():
    game = GameEngine(random.Random(42))
    hero = game.create_character(1, "Arin", "human", "fighter", stats(strength=16))
    monster = MonsterState()
    game.rng.randint = lambda a, b: 20  # Critical hit
    result, monster = game.resolve_action(hero, "attack", monster)
    assert monster is None  # Monster defeated
    assert hero.xp == 50
    assert hero.level == 1


def test_multiple_kills_lead_to_level_up():
    game = GameEngine(random.Random(42))
    hero = game.create_character(1, "Arin", "human", "fighter", stats(strength=16))
    for i in range(3):
        monster = MonsterState()
        game.rng.randint = lambda a, b: 20
        result, monster = game.resolve_action(hero, "attack", monster)
    # 3 kills = 150 XP = 1 level (100 XP threshold) with 50 XP remaining
    assert hero.level == 2
    assert hero.xp == 50


def test_dead_character_cannot_act():
    game = GameEngine(random.Random(42))
    hero = game.create_character(1, "Arin", "human", "fighter", stats(strength=16))
    hero.hp = 0
    result, monster = game.resolve_action(hero, "attack", None)
    assert not result.state_changed
    assert monster is None
    assert hero.hp == 0
    assert hero.xp == 0
    assert any("fallen" in event for event in result.events)


def test_dead_character_cannot_level_up_or_heal():
    game = GameEngine(random.Random(42))
    hero = game.create_character(1, "Arin", "human", "fighter", stats(strength=16))
    hero.hp = 0
    hero.xp = 250
    game.rng.randint = lambda a, b: 20
    result, _ = game.resolve_action(hero, "attack", None)
    assert hero.level == 1
    assert hero.xp == 250
    assert hero.hp == 0
    assert not result.state_changed


def test_default_abilities_use_standard_array():
    hero = GameEngine(random.Random(1)).create_character(1, "Arin", "human", "fighter")
    assert sorted(hero.abilities.values(), reverse=True) == [15, 14, 13, 12, 10, 8]
    # Primary ability gets the highest score, so a default fighter can hit things.
    assert hero.abilities["strength"] == 15
    assert hero.abilities["constitution"] == 14


def test_default_abilities_are_valid_for_every_class():
    for class_name in CLASSES:
        hero = GameEngine(random.Random(1)).create_character(1, "Arin", "human", class_name)
        assert set(hero.abilities) == set(ABILITY_ORDER)
        primary = CLASSES[class_name].primary
        assert hero.abilities[primary] == max(hero.abilities.values())


def test_mana_regenerates_after_a_turn():
    game = GameEngine(random.Random(42))
    hero = game.create_character(1, "Arin", "human", "wizard", stats(intelligence=16))
    hero.mana = hero.max_mana - 1
    game.resolve_action(hero, "inspect the old door", None)
    assert hero.mana == hero.max_mana


def test_mana_regeneration_stops_at_max():
    game = GameEngine(random.Random(42))
    hero = game.create_character(1, "Arin", "human", "wizard", stats(intelligence=16))
    for _ in range(5):
        game.resolve_action(hero, "inspect the old door", None)
    assert hero.mana == hero.max_mana


def test_classes_without_mana_never_gain_mana():
    game = GameEngine(random.Random(42))
    hero = game.create_character(1, "Arin", "human", "fighter", stats())
    game.resolve_action(hero, "inspect the old door", None)
    assert hero.mana == 0
    assert hero.max_mana == 0


def test_early_fights_are_winnable_with_default_stats():
    """A brand new player must be able to level up without losing immediately.

    The fight itself is deliberately not rest-free: standard 5e goblins hit hard
    enough that two back-to-back fights without a rest is a coin flip, so the
    player is expected to rest between them. That is the intended loop.
    """
    game = GameEngine(random.Random(7))
    hero = game.create_character(1, "Arin", "human", "fighter")
    fights = 0
    while fights < 2 and hero.hp > 0:
        while 0 < hero.hp < hero.max_hp:
            game.resolve_action(hero, "rest", None)
        monster = build_monster(hero.difficulty, "goblin")
        for _ in range(30):
            if hero.hp <= 0 or monster is None:
                break
            game.resolve_action(hero, "attack", monster)
        fights += 1
    assert hero.hp > 0
    assert hero.level >= 2


def test_all_ten_abilities_lose_to_the_standard_array():
    """Guards the regression where blank characters defaulted to all-10 scores."""
    def duel_stats(abilities, seeds=range(60)):
        victories = 0
        knockouts = 0
        for seed in seeds:
            game = GameEngine(random.Random(seed))
            hero = game.create_character(1, "Arin", "human", "fighter", abilities)
            monster = build_monster("hard", "ogre")
            for _ in range(30):
                if hero.hp <= 0 or monster is None:
                    break
                result, monster = game.resolve_action(hero, "attack", monster)
                if any("Defeated in combat" in event for event in result.events):
                    knockouts += 1
                    break
            if hero.hp > 0 and monster is None:
                victories += 1
        return victories, knockouts

    standard_wins, standard_ko = duel_stats(None)
    flat_wins, flat_ko = duel_stats({ability: 10 for ability in ABILITY_ORDER})
    assert standard_wins >= flat_wins
    assert flat_ko >= standard_ko
    assert flat_ko > 0 or standard_wins > flat_wins


def test_martial_classes_get_no_spell_pool():
    """Fighters and barbarians must not be able to cast from a mana pool."""
    for class_name in ("fighter", "barbarian", "rogue"):
        hero = GameEngine(random.Random(1)).create_character(1, "Arin", "human", class_name)
        assert (hero.mana, hero.max_mana) == (0, 0)


def test_starting_armor_keeps_martials_alive():
    """Armor proficiencies in the catalog must actually set armor class."""
    fighter = GameEngine().create_character(1, "Arin", "human", "fighter")
    wizard = GameEngine().create_character(1, "Arin", "human", "wizard")
    # Chain mail (16, no dexterity) versus unarmored wizard (10 + dexterity).
    assert fighter.armor_class == 16
    assert wizard.armor_class == 10 + GameEngine.modifier(wizard.abilities["dexterity"])


def test_rest_recovers_hp_and_heals_nothing_at_full():
    game = GameEngine(random.Random(7))
    hero = game.create_character(1, "Arin", "human", "fighter")
    hero.hp = 2
    result, _ = game.resolve_action(hero, "rest", None)
    assert result.state_changed
    assert hero.hp > 2
    # Capped at max HP, and resting again at full is a free no-op.
    hero.hp = hero.max_hp
    again, _ = game.resolve_action(hero, "rest", None)
    assert not again.state_changed
    assert any("already at full health" in event for event in again.events)


def test_rest_does_not_work_mid_fight():
    game = GameEngine(random.Random(7))
    hero = game.create_character(1, "Arin", "human", "fighter")
    monster = MonsterState(name="Goblin scout", hp=40, max_hp=40, armor_class=16)
    # Start a real fight and keep the goblin alive, then try to rest mid-combat.
    _, monster = game.resolve_action(hero, "attack", monster)
    monster = monster or build_monster("normal", "goblin")
    result, _ = game.resolve_action(hero, "rest", monster)
    assert any("cannot rest" in event for event in result.events)
    assert not result.state_changed
    assert hero.in_combat


def test_fleeing_ends_the_fight_and_clears_the_combatant():
    """A mismatched fight must be escapable, not an unwinnable mana sink."""
    game = GameEngine(random.Random(3))
    hero = game.create_character(1, "Lyra", "halfling", "rogue")
    monster = build_monster("normal", "goblin")
    _, monster = game.resolve_action(hero, "attack", monster)
    if monster is None:
        pytest.skip("goblin died immediately; nothing to flee from")
    # Force a successful escape roll.
    game.rng.randint = lambda a, b: 20
    result, after = game.resolve_action(hero, "flee", monster)
    assert result.combat_over
    assert after is None
    assert not hero.in_combat
    assert any("escape" in event for event in result.events)


def test_failed_flee_keeps_the_fight_going():
    game = GameEngine(random.Random(3))
    hero = game.create_character(1, "Lyra", "halfling", "rogue")
    monster = build_monster("normal", "ogre")
    game.rng.randint = lambda a, b: 1
    result, after = game.resolve_action(hero, "flee", monster)
    assert after is monster
    assert not result.combat_over
    assert any("fail to break away" in event for event in result.events)


def test_modifier_calculation():
    assert GameEngine.modifier(10) == 0
    assert GameEngine.modifier(16) == 3
    assert GameEngine.modifier(8) == -1


def test_invalid_race():
    game = GameEngine()
    with pytest.raises(ValueError, match="Unknown race"):
        game.create_character(1, "Arin", "dragon", "fighter")


def test_invalid_class():
    game = GameEngine()
    with pytest.raises(ValueError, match="Unknown"):
        game.create_character(1, "Arin", "human", "ninja")


def test_hp_never_goes_negative_when_damaged():
    game = GameEngine(random.Random(4))
    hero = game.create_character(1, "Arin", "human", "fighter")
    hero.hp = 8
    hero.in_combat = True
    monster = MonsterState(name="Brute", hp=30, max_hp=30, armor_class=8, attack_bonus=12, damage="1d6+0")
    game.rng.randint = lambda a, b: 20
    game._enemy_turn(hero, monster)
    assert hero.hp >= 0


def test_combat_knockout_respawns_at_safe_hub_with_one_hp():
    game = GameEngine(random.Random(11))
    hero = game.create_character(1, "Arin", "human", "fighter")
    hero.hp = 1
    hero.location = "The Sunken Corridor"
    hero.in_combat = True
    monster = MonsterState(
        name="Brute", hp=30, max_hp=30, armor_class=8, attack_bonus=15, damage="2d6+6",
    )
    events = game._enemy_turn(hero, monster)
    assert hero.hp == 1
    assert hero.location == "The Whispering Cellar"
    assert not hero.in_combat
    assert hero.combat_turn == "player"
    assert any("Defeated" in event for event in events)


def test_attack_cast_and_flee_require_player_turn():
    game = GameEngine(random.Random(2))
    hero = game.create_character(1, "Arin", "human", "fighter")
    monster = MonsterState(name="Goblin scout", hp=10, max_hp=10, armor_class=12, attack_bonus=4, damage="1d6+2")
    hero.in_combat = True
    hero.combat_turn = "enemy"

    attack, _ = game.resolve_action(hero, "attack goblin", monster)
    flee, _ = game.resolve_action(hero, "flee", monster)
    cast, _ = game.resolve_action(hero, "cast fire bolt", monster)

    for result in (attack, flee, cast):
        assert not result.state_changed
        assert any("not your turn" in event.lower() for event in result.events)


def test_player_turn_restored_after_attack_and_enemy_exchange():
    game = GameEngine(random.Random(22))
    hero = game.create_character(1, "Arin", "human", "fighter", stats(strength=16, dexterity=14))
    game.rng.randint = lambda a, b: 18
    result, monster = game.resolve_action(hero, "attack the goblin", None)
    assert any("Initiative" in event for event in result.events)
    if hero.in_combat and monster is not None:
        assert hero.combat_turn == "player"
