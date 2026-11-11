"""Location-specific skill challenges with persistent consequences (Sprint 23)."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from .economy_balance import BANDIT_CAMP_EVIDENCE_GOLD_GP
from .models import TurnResult

if TYPE_CHECKING:
    from .service import GameEngine

BANDIT_CAMP = "The Bandit Camp"
FLAG_EVIDENCE = "bandit_shrine_evidence"
FLAG_STEALTH_DONE = "bandit_stealth_challenge_done"
FLAG_SOCIAL_DONE = "bandit_social_challenge_done"
FLAG_ALERTED = "bandit_camp_alerted"

CHALLENGE_STEALTH = "bandit_camp_stealth"
CHALLENGE_SOCIAL = "bandit_camp_social"

STEALTH_DC = 13
SOCIAL_DC = 14


def _fold(action: str) -> str:
    return re.sub(r"\s+", " ", action.casefold()).strip()


def _stealth_challenge_action(folded: str) -> bool:
    if not any(
        token in folded
        for token in (
            "sneak",
            "slip past",
            "creep",
            "stealth",
            "vyhnout",
            "plíž",
            "pliz",
            "vyhn",
            "avoid",
            "proklouzn",
        )
    ):
        return False
    return any(
        token in folded
        for token in ("sentr", "guard", "patrol", "watcher", "hlídk", "hlidk", "tent", "camp")
    )


def _social_challenge_action(folded: str) -> tuple[str, bool]:
    if not any(
        token in folded
        for token in (
            "bluff",
            "lie",
            "deceiv",
            "oklam",
            "lž",
            "persuad",
            "convinc",
            "intimid",
            "threaten",
            "přesvědč",
            "presvedc",
            "zastraš",
            "zastras",
            "captain",
            "velitel",
        )
    ):
        return "", False
    if any(token in folded for token in ("bluff", "lie", "deceiv", "oklam", "lž", "zlh")):
        return "Deception", True
    if any(token in folded for token in ("intimid", "threaten", "zastraš", "zastras")):
        return "Intimidation", True
    return "Persuasion", True


def _award_bandit_evidence(character) -> tuple[list[str], dict]:
    character.quest_flags[FLAG_EVIDENCE] = True
    character.gold += BANDIT_CAMP_EVIDENCE_GOLD_GP
    if "Shrine goods ledger" not in character.inventory:
        character.inventory.append("Shrine goods ledger")
    return (
        [
            "You secure a ledger tying the bandits to stolen shrine goods "
            f"and claim {BANDIT_CAMP_EVIDENCE_GOLD_GP} gold."
        ],
        {
            "challenge_id": CHALLENGE_STEALTH,
            "reward_gold": BANDIT_CAMP_EVIDENCE_GOLD_GP,
            "evidence": "shrine_goods_ledger",
        },
    )


def bandit_captain_defeat_rewards(character) -> list[str]:
    if character.location != BANDIT_CAMP:
        return []
    if character.quest_flags.get(FLAG_EVIDENCE):
        return []
    lines, _ = _award_bandit_evidence(character)
    lines[0] = (
        "The bandit captain falls. " + lines[0].replace("You secure", "You seize")
    )
    character.quest_flags[FLAG_ALERTED] = True
    return lines


def try_skill_challenge(engine: "GameEngine", character, action: str) -> TurnResult | None:
    if character.in_combat or not action.strip():
        return None
    folded = _fold(action)
  # Only Bandit Camp V1 in this sprint.
    if character.location != BANDIT_CAMP:
        return None

    flags = character.quest_flags
    if flags.get(FLAG_EVIDENCE):
        if _stealth_challenge_action(folded) or _social_challenge_action(folded)[1]:
            return TurnResult(
                action,
                ["You already secured proof that bandits fenced stolen shrine goods."],
                False,
                costs_adventure_mana=False,
            )
        return None

    if _stealth_challenge_action(folded):
        if flags.get(FLAG_STEALTH_DONE):
            return TurnResult(
                action,
                ["You already tried slipping past the sentries — try another approach."],
                False,
                costs_adventure_mana=False,
            )
        flags[FLAG_STEALTH_DONE] = True
        mod_note = ""
        if flags.get(FLAG_ALERTED):
            mod_note = " The camp is on alert — disadvantage on Stealth."
        check, _, lucky = engine.skill_check(character, "Stealth", STEALTH_DC)
        if flags.get(FLAG_ALERTED):
            # Roll twice and keep lower (disadvantage); outcome follows the kept roll.
            check2, _, lucky2 = engine.skill_check(character, "Stealth", STEALTH_DC)
            if check2.total < check.total:
                check, lucky = check2, lucky2
            mod_note += " (disadvantage applied)"
        success = check.total >= STEALTH_DC
        skill_facts = {
            "challenge_id": CHALLENGE_STEALTH,
            "skill": "Stealth",
            "dc": STEALTH_DC,
            "total": check.total,
            "success": success,
        }
        if success:
            reward_lines, reward_facts = _award_bandit_evidence(character)
            skill_facts.update(reward_facts)
            skill_facts["challenge_id"] = CHALLENGE_STEALTH
            return TurnResult(
                action,
                [
                    f"Stealth check: {check.total} vs DC {STEALTH_DC} — success.{lucky}{mod_note}",
                    "You slip between tents and photograph the stolen goods stash in your mind.",
                    *reward_lines,
                ],
                True,
                save_facts={"skill": skill_facts},
                costs_adventure_mana=False,
            )
        flags[FLAG_ALERTED] = True
        skill_facts["success"] = False
        return TurnResult(
            action,
            [
                f"Stealth check: {check.total} vs DC {STEALTH_DC} — failure.{lucky}{mod_note}",
                "A sentry shouts — the camp is alerted. Try bluffing the captain or fight your way to answers.",
            ],
            True,
            save_facts={"skill": skill_facts},
            costs_adventure_mana=False,
        )

    social_skill, is_social = _social_challenge_action(folded)
    if is_social:
        if flags.get(FLAG_SOCIAL_DONE):
            return TurnResult(
                action,
                ["You already tried talking your way through — try stealth or combat."],
                False,
                costs_adventure_mana=False,
            )
        flags[FLAG_SOCIAL_DONE] = True
        dc = SOCIAL_DC + (2 if flags.get(FLAG_ALERTED) else 0)
        check, success, lucky = engine.skill_check(character, social_skill, dc)
        skill_facts = {
            "challenge_id": CHALLENGE_SOCIAL,
            "skill": social_skill,
            "dc": dc,
            "total": check.total,
            "success": success,
        }
        if success:
            reward_lines, reward_facts = _award_bandit_evidence(character)
            skill_facts.update(reward_facts)
            return TurnResult(
                action,
                [
                    f"{social_skill} check: {check.total} vs DC {dc} — success.{lucky}",
                    "The captain boasts about fencing shrine goods to Nib's market — you let him talk.",
                    *reward_lines,
                ],
                True,
                save_facts={"skill": skill_facts},
                costs_adventure_mana=False,
            )
        flags[FLAG_ALERTED] = True
        skill_facts["success"] = False
        return TurnResult(
            action,
            [
                f"{social_skill} check: {check.total} vs DC {dc} — failure.{lucky}",
                "The bandits don't buy it. Sentries scatter — try stealth from another angle or attack.",
            ],
            True,
            save_facts={"skill": skill_facts},
            costs_adventure_mana=False,
        )

    return None
