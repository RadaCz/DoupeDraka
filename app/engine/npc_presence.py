"""Minimal NPC presence hints for narration — only engine-backed, flag-gated facts."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class NpcPresence:
    id: str
    name: str
    role: str
    public_facts: tuple[str, ...]
    personality: str = ""
    temperament: str = ""
    motivation: str = ""
    voice: str = ""
    facts_when_all: tuple[tuple[tuple[str, ...], tuple[str, ...]], ...] = ()


LOCATION_NPCS: dict[str, tuple[NpcPresence, ...]] = {
    "The Shrine of the Forgotten": (
        NpcPresence(
            id="caldus",
            name="Caldus",
            role="shrine caretaker",
            personality="Patient, devout, quietly stubborn when sacred things are stolen.",
            temperament="Measured and solemn; anger is rare but deep.",
            motivation="Restore the shrine bell and protect what remains of the Forgotten faith.",
            voice="Soft, respectful cadence; formal address to strangers.",
            public_facts=(
                "Maintains the Shrine of the Forgotten.",
                "Cares about the stolen shrine bell until it is returned.",
            ),
            facts_when_all=(
                (("bell_quest_accepted",), ("Previously asked the hero to speak with Nib at the Goblin Market.",)),
                (
                    ("vault_hint_given",),
                    (
                        "Thanked the hero for returning the bell.",
                        "Mentioned a path toward the Vault of Echoes and the Bell Warden.",
                    ),
                ),
            ),
        ),
    ),
    "The Goblin Market": (
        NpcPresence(
            id="nib",
            name="Nib",
            role="goblin trader",
            personality="Shrewd, nervous charm; laughs too quickly when cornered.",
            temperament="Restless eyes; performs innocence poorly.",
            motivation="Profit, self-preservation, and keeping the theft secret.",
            voice="Hasty scraps of words, lots of hedging and bargaining fillers.",
            public_facts=("Runs a stall of charms and mismatched goods.",),
            facts_when_all=(
                (
                    ("bell_quest_accepted",),
                    ("The shrine bell theft is a live topic; the hero may confront Nib about it.",),
                ),
                (
                    ("bell_quest_accepted", "bell_acquired"),
                    ("The hero already obtained the shrine bell from Nib.",),
                ),
            ),
        ),
    ),
    "The Sunken Corridor": (
        NpcPresence(
            id="mara",
            name="Mara",
            role="lantern scavenger",
            personality="Practical survivor; dry humor under pressure.",
            temperament="Alert, candid; prefers warnings over small talk.",
            motivation="Stay alive while scavenging along the flooded corridor.",
            voice="Short sentences, low urgency until danger is near.",
            public_facts=(
                "Carries a lantern along the flooded corridor.",
                "Warns travelers that something follows the waterway.",
            ),
        ),
    ),
}


def _flags_satisfied(flags: dict[str, bool], required: tuple[str, ...]) -> bool:
    return all(flags.get(name) for name in required)


def _relationship_to_hero(npc_id: str, flags: dict[str, bool]) -> str:
    match npc_id:
        case "caldus":
            if flags.get("bell_quest_complete"):
                return "Grateful; trusts the hero after the bell was returned."
            if flags.get("bell_quest_accepted"):
                return "Hopeful the hero will recover the bell."
            return "Cautious but welcoming to respectful guests."
        case "nib":
            if flags.get("bell_acquired") or flags.get("bell_quest_complete"):
                return "Wary; knows the hero already confronted him about the bell."
            if flags.get("bell_quest_accepted"):
                return "Defensive; avoids the bell topic unless pressed."
            return "Indifferent merchant until given a reason to talk."
        case "mara":
            return "Neutral; shares warnings freely, owes no favors."
    return ""


def npc_presence_for_location(
    location: str,
    quest_flags: dict[str, bool],
) -> list[dict[str, Any]]:
    """NPC the narrator may reference here — no secrets beyond quest_flags."""
    entries = LOCATION_NPCS.get(location, ())
    flags = dict(quest_flags)
    dossier: list[dict[str, Any]] = []
    for npc in entries:
        known: list[str] = list(npc.public_facts)
        for required, snippets in npc.facts_when_all:
            if _flags_satisfied(flags, required):
                known.extend(snippets)
        block: dict[str, Any] = {
            "id": npc.id,
            "name": npc.name,
            "role": npc.role,
            "personality": npc.personality,
            "temperament": npc.temperament,
            "motivation": npc.motivation,
            "voice": npc.voice,
            "knows": known,
        }
        rel = _relationship_to_hero(npc.id, flags)
        if rel:
            block["relationship_to_hero"] = rel
        if location == "The Shrine of the Forgotten" and not flags.get("vault_hint_given"):
            block["does_not_know"] = ["Details of the Vault of Echoes before Caldus reveals them."]
        if location == "The Goblin Market" and not flags.get("bell_quest_accepted"):
            block["does_not_know"] = ["The shrine bell theft motive before the hero accepts Caldus's quest."]
        dossier.append(block)
    return dossier
