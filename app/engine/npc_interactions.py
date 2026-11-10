"""NPC talk outcomes with persistent quest/discovered state."""

from __future__ import annotations

import re

from .models import CharacterState, TurnResult

NPC_HOME = {
    "caldus": "The Shrine of the Forgotten",
    "nib": "The Goblin Market",
    "mara": "The Sunken Corridor",
}


def npc_id_from_action(action: str) -> str | None:
    folded = re.sub(r"\s+", " ", action.casefold())
    if not re.search(r"\b(talk|speak|ask|greet|mluv|zeptej|promluv)\b", folded):
        return None
    for npc_id in NPC_HOME:
        if re.search(rf"\b{npc_id}\b", folded):
            return npc_id
    return None


def resolve_npc_talk(character: CharacterState, action: str, npc_id: str) -> TurnResult:
    """Engine-only dialogue; quest advances stay in quests.resolve_main_quest_step."""
    if character.in_combat:
        return TurnResult(action, ["You cannot parley while blades are drawn."], False)
    home = NPC_HOME.get(npc_id)
    if home and character.location != home:
        return TurnResult(
            action,
            [f"{npc_id.title()} is not here. Try {home}."],
            False,
            costs_adventure_mana=False,
        )
    flags = character.quest_flags

    if npc_id == "caldus":
        if flags.get("bell_quest_complete"):
            if flags.get("vault_hint_given"):
                return TurnResult(
                    action,
                    ["Caldus smiles quietly. The vault route is open; the Bell Warden still waits in the pit."],
                    False,
                    costs_adventure_mana=False,
                )
            return TurnResult(
                action,
                ["Caldus is ready to reveal the vault — ask him about the bell again to hear the path."],
                False,
                costs_adventure_mana=False,
            )
        if flags.get("bell_quest_accepted"):
            return TurnResult(
                action,
                ["Caldus nods toward the Goblin Market. Nib traded in stolen bells."],
                False,
                costs_adventure_mana=False,
            )
        return TurnResult(
            action,
            [
                "Caldus pleads softly: the shrine bell was stolen. Ask him about the bell to accept the recovery quest.",
            ],
            False,
            costs_adventure_mana=False,
        )

    if npc_id == "nib":
        if flags.get("bell_quest_complete") or flags.get("bell_acquired"):
            return TurnResult(
                action,
                ["Nib keeps his distance. The shrine bell affair is closed."],
                False,
                costs_adventure_mana=False,
            )
        if not flags.get("bell_quest_accepted"):
            if flags.get("bell_market_rumor"):
                return TurnResult(
                    action,
                    [
                        "Nib hisses that you already know the rumors. Caldus at the shrine must sanction questions about the bell.",
                    ],
                    False,
                    costs_adventure_mana=False,
                )
            return TurnResult(
                action,
                ["Nib sells charms and avoids your gaze. Without Caldus's sanction he won't discuss sacred theft."],
                False,
                costs_adventure_mana=False,
            )
        return TurnResult(
            action,
            ["Nib sweats under your stare. Press him about the shrine bell to demand the truth."],
            False,
            costs_adventure_mana=False,
        )

    if npc_id == "mara":
        if flags.get("mara_warned"):
            return TurnResult(
                action,
                ["Mara adjusts her lantern. She already warned you about the waterway."],
                False,
                costs_adventure_mana=False,
            )
        flags["mara_warned"] = True
        flags["heard_waterway_danger"] = True
        return TurnResult(
            action,
            [
                "Mara lowers her voice: something tracks the flooded corridor. Tread carefully toward the shrine light.",
                "New discovery: Danger follows the waterway.",
            ],
            True,
            costs_adventure_mana=False,
        )

    return TurnResult(action, ["No one answers."], False, costs_adventure_mana=False)
