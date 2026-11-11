"""Sprint 23 — fail-closed resolution and Bandit Camp skill challenges."""

import random
from dataclasses import asdict

from app.engine.economy_balance import BANDIT_CAMP_EVIDENCE_GOLD_GP
from app.engine.equipment import load_character_state
from app.engine.models import MonsterState, RollResult
from app.engine.service import GameEngine
from app.engine.skill_challenges import (
    BANDIT_CAMP,
    FLAG_EVIDENCE,
    FLAG_SOCIAL_DONE,
    FLAG_STEALTH_DONE,
)


def _camp_hero(klass: str = "rogue"):
    game = GameEngine(random.Random(23))
    hero = game.create_character(
        1,
        "Scout",
        "halfling" if klass == "rogue" else "human",
        klass,
        expertise_skills=["Stealth", "Deception"] if klass == "rogue" else None,
    )
    hero.location = BANDIT_CAMP
    return game, hero


def _snap(hero):
    return hero.gold, dict(hero.quest_flags), list(hero.inventory), hero.xp


def test_unknown_action_no_side_effects():
    game, hero = _camp_hero()
    before = _snap(hero)
    result, _ = game.resolve_action(hero, "dance the macarena wildly", None)
    assert not result.state_changed
    assert _snap(hero) == before


def test_talk_without_npc_no_check():
    game, hero = _camp_hero()
    before = hero.xp, hero.gold
    result, _ = game.resolve_action(hero, "talk to the empty air", None)
    assert not result.state_changed
    assert "Charisma check" not in " ".join(result.events)
    assert hero.xp == before[0] and hero.gold == before[1]


def test_bandit_stealth_success_awards_once(monkeypatch):  # noqa: ARG001
    game, hero = _camp_hero("rogue")

    def always_high(self, character, skill, dc):
        return RollResult("1d20", (18,), 5, 23), True, ""

    monkeypatch.setattr(GameEngine, "skill_check", always_high)
    result, _ = game.resolve_action(hero, "sneak past the bandit sentries", None)
    assert result.state_changed
    assert hero.quest_flags[FLAG_EVIDENCE]
    assert hero.quest_flags[FLAG_STEALTH_DONE]
    gold = hero.gold
    again, _ = game.resolve_action(hero, "sneak past the bandit sentries", None)
    assert not again.state_changed
    assert hero.gold == gold


def test_bandit_stealth_fail_allows_social_path(monkeypatch):
    game, hero = _camp_hero()

    def fail_then_pass(self, character, skill, dc):
        if skill == "Stealth":
            return RollResult("1d20", (3,), 0, 3), False, ""
        return RollResult("1d20", (17,), 2, 19), True, ""

    monkeypatch.setattr(GameEngine, "skill_check", fail_then_pass)
    fail, _ = game.resolve_action(hero, "sneak past the bandit sentries", None)
    assert fail.state_changed
    assert hero.quest_flags.get("bandit_camp_alerted")
    assert not hero.quest_flags.get(FLAG_EVIDENCE)
    ok, _ = game.resolve_action(hero, "bluff the bandit captain", None)
    assert ok.state_changed
    assert hero.quest_flags[FLAG_EVIDENCE]
    assert hero.quest_flags[FLAG_SOCIAL_DONE]


def test_bandit_captain_combat_awards_without_duplication():
    game, hero = _camp_hero("fighter")
    hero.quest_flags[FLAG_STEALTH_DONE] = True
    hero.quest_flags[FLAG_SOCIAL_DONE] = True
    for _ in range(3):
        game._grant_xp(hero, 100)
    game.rng.randint = lambda a, b: b
    from tests.combat_turn_helpers import resolve_combat_action_for_simulation

    _, captain = resolve_combat_action_for_simulation(game, hero, "attack the bandit captain", None)
    for _ in range(60):
        if not hero.in_combat and hero.quest_flags.get(FLAG_EVIDENCE):
            break
        if captain is None and not hero.in_combat:
            _, monster = resolve_combat_action_for_simulation(game, hero, "attack the bandit captain", None)
            captain = monster
            continue
        if captain is None:
            break
        if captain.hp <= 0:
            break
        _, captain = resolve_combat_action_for_simulation(game, hero, f"attack {captain.name}", captain)
    assert hero.quest_flags[FLAG_EVIDENCE]
    assert hero.gold >= BANDIT_CAMP_EVIDENCE_GOLD_GP
    before_gold = hero.gold
    # Simulate duplicate defeat hook
    from app.engine.skill_challenges import bandit_captain_defeat_rewards

    assert not bandit_captain_defeat_rewards(hero)
    assert hero.gold == before_gold


def test_evidence_persists_reload(monkeypatch):
    game, hero = _camp_hero()

    def win(self, character, skill, dc):
        return RollResult("1d20", (16,), 3, 19), True, ""

    monkeypatch.setattr(GameEngine, "skill_check", win)
    game.resolve_action(hero, "sneak past the bandit sentries", None)
    restored = load_character_state(asdict(hero))
    assert restored.quest_flags.get(FLAG_EVIDENCE)
    assert "Shrine goods ledger" in restored.inventory


def test_proficiency_raises_stealth_total(monkeypatch):
    game, hero = _camp_hero("rogue")
    captured = {}

    def capture(self, character, skill, dc):
        captured["mod"] = self.skill_modifier(character, skill)
        return RollResult("1d20", (10,), captured["mod"], 10 + captured["mod"]), True, ""

    monkeypatch.setattr(GameEngine, "skill_check", capture)
    game.resolve_action(hero, "sneak past the bandit sentries", None)
    game_plain = GameEngine(random.Random(1))
    plain = game_plain.create_character(1, "F", "human", "fighter")
    plain.location = BANDIT_CAMP
    mod_plain = game_plain.skill_modifier(plain, "Stealth")
    assert captured["mod"] > mod_plain
