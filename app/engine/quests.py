"""Structured quest definitions and resolvers (Etapa 4)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from .models import CharacterState, TurnResult

LevelUpFn = Callable[[CharacterState], tuple[list[str], dict]]


@dataclass(frozen=True)
class QuestStepPublic:
    id: str
    label: str
    hint: str
    location: str | None = None


@dataclass(frozen=True)
class CampaignQuestPublic:
    id: str
    title: str
    category: str
    steps: tuple[QuestStepPublic, ...]


@dataclass(frozen=True)
class SideQuestPublic:
    id: str
    title: str
    hint: str
    location: str
    reward_flag: str


CHAPTER_ONE_STEPS: tuple[QuestStepPublic, ...] = (
    QuestStepPublic(
        "bell_quest_accepted",
        "Recover the stolen shrine bell",
        "At the Shrine of the Forgotten, talk to Caldus about the bell.",
        "The Shrine of the Forgotten",
    ),
    QuestStepPublic(
        "bell_acquired",
        "Obtain the bell from Nib",
        "Travel to the Goblin Market and ask Nib about the shrine bell.",
        "The Goblin Market",
    ),
    QuestStepPublic(
        "bell_quest_complete",
        "Return the bell to Caldus",
        "Return to the shrine and give the bell back to Caldus.",
        "The Shrine of the Forgotten",
    ),
    QuestStepPublic(
        "vault_hint_given",
        "Learn about the Vault of Echoes",
        "Search the Sunken Corridor or talk to locals until the vault route opens.",
        "The Sunken Corridor",
    ),
    QuestStepPublic(
        "chapter_one_complete",
        "Defeat the Bell Warden",
        "Enter the Vault of Echoes and face the Bell Warden in the pit.",
        "The Bell Warden's Pit",
    ),
)

CHAPTER_ONE = CampaignQuestPublic(
    id="chapter_one",
    title="The Stolen Bell",
    category="main",
    steps=CHAPTER_ONE_STEPS,
)

SIDE_QUESTS: tuple[SideQuestPublic, ...] = (
    SideQuestPublic(
        id="crypt_echo_relic",
        title="Echo of the Forgotten",
        hint="Search the Forgotten Crypt for a relic tucked behind a cracked sarcophagus.",
        location="The Forgotten Crypt",
        reward_flag="crypt_relic_claimed",
    ),
)


def quest_catalog() -> dict:
    return {
        "campaigns": [
            {
                "id": CHAPTER_ONE.id,
                "title": CHAPTER_ONE.title,
                "category": CHAPTER_ONE.category,
                "steps": [
                    {"id": s.id, "label": s.label, "hint": s.hint, "location": s.location}
                    for s in CHAPTER_ONE.steps
                ],
            }
        ],
        "side_quests": [
            {
                "id": q.id,
                "title": q.title,
                "hint": q.hint,
                "location": q.location,
                "reward_flag": q.reward_flag,
            }
            for q in SIDE_QUESTS
        ],
    }


def resolve_main_quest_step(
    character: CharacterState,
    action: str,
    step: str,
    level_up: LevelUpFn,
) -> TurnResult | None:
    if character.in_combat:
        return TurnResult(action, ["You cannot deal with the quest while a fight is still raging."], False)
    flags = character.quest_flags

    if step == "return_bell" and character.location == "The Shrine of the Forgotten":
        if flags.get("bell_quest_complete"):
            return TurnResult(action, ["Caldus has already received the shrine bell."], False, costs_adventure_mana=False)
        if not (flags.get("bell_found") or flags.get("bell_acquired")):
            return TurnResult(action, ["You do not have the shrine bell to return."], False, costs_adventure_mana=False)
        flags["bell_quest_complete"] = True
        flags["bell_acquired"] = True
        character.inventory = [item for item in character.inventory if item.casefold() != "shrine bell"]
        character.gold += 5
        character.xp += 30
        events = ["You return the shrine bell to Caldus and receive 5 gold pieces and 30 XP."]
        level_events, level_up_facts = level_up(character)
        events.extend(level_events)
        return TurnResult(action, events, True, level_up_facts=level_up_facts)

    if step == "accept_caldus" and character.location == "The Shrine of the Forgotten":
        if flags.get("bell_quest_complete"):
            if not flags.get("vault_hint_given"):
                flags["vault_hint_given"] = True
                flags["vault_unlocked"] = True
                return TurnResult(
                    action,
                    [
                        "Caldus thanks you and warns that the bell thief fled toward "
                        "The Vault of Echoes beneath the corridor. The Bell Warden still guards the pit.",
                    ],
                    True,
                )
            return TurnResult(action, ["Caldus thanks you again for returning the shrine bell."], False, costs_adventure_mana=False)
        if flags.get("bell_quest_accepted"):
            return TurnResult(action, ["Caldus reminds you that Nib at the market saw the stolen bell."], False, costs_adventure_mana=False)
        flags["bell_quest_accepted"] = True
        return TurnResult(
            action,
            ["You agree to recover the stolen shrine bell. Caldus says Nib at the Goblin Market may know where it went."],
            True,
        )

    if step == "ask_nib" and character.location == "The Goblin Market":
        if flags.get("bell_quest_complete") or flags.get("bell_acquired"):
            return TurnResult(action, ["Nib has nothing more to say about the shrine bell."], False, costs_adventure_mana=False)
        if not flags.get("bell_quest_accepted"):
            return TurnResult(action, ["Nib shrugs. You need a better reason to ask about the shrine bell."], False, costs_adventure_mana=False)
        flags["bell_found"] = True
        flags["bell_acquired"] = True
        if "Shrine bell" not in character.inventory:
            character.inventory.append("Shrine bell")
        return TurnResult(action, ["Nib admits the theft and hands you the shrine bell."], True)

    return None


def try_side_quest_explore(character: CharacterState, action: str) -> TurnResult | None:
    """Deterministic one-time rewards tied to location exploration."""
    folded = action.casefold()
    if "search" not in folded and "inspect" not in folded and "explore" not in folded:
        return None
    if character.location != "The Forgotten Crypt":
        return None
    flags = character.quest_flags
    if flags.get("crypt_relic_claimed"):
        return TurnResult(
            action,
            ["The crypt's echo relic is already in your pack; only dust remains in the niche."],
            False,
            costs_adventure_mana=False,
        )
    flags["crypt_relic_claimed"] = True
    character.gold += 15
    character.xp += 10
    if "Echo shard" not in character.inventory:
        character.inventory.append("Echo shard")
    return TurnResult(
        action,
        [
            "Behind a cracked sarcophagus you find an echo shard and 15 gold from a forgotten burial.",
            "You gain 10 XP for uncovering the relic.",
        ],
        True,
    )
