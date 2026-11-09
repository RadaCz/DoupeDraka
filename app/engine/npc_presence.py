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
    # Unlock extra read-only facts only when ALL listed flags are true.
    facts_when_all: tuple[tuple[tuple[str, ...], tuple[str, ...]], ...] = ()


LOCATION_NPCS: dict[str, tuple[NpcPresence, ...]] = {
    "The Shrine of the Forgotten": (
        NpcPresence(
            id="caldus",
            name="Caldus",
            role="shrine caretaker",
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
            public_facts=(
                "Carries a lantern along the flooded corridor.",
                "Warns travelers that something follows the waterway.",
            ),
        ),
    ),
}


def _flags_satisfied(flags: dict[str, bool], required: tuple[str, ...]) -> bool:
    return all(flags.get(name) for name in required)


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
            "knows": known,
        }
        if location == "The Shrine of the Forgotten" and not flags.get("vault_hint_given"):
            block["does_not_know"] = ["Details of the Vault of Echoes before Caldus reveals them."]
        if location == "The Goblin Market" and not flags.get("bell_quest_accepted"):
            block["does_not_know"] = ["The shrine bell theft motive before the hero accepts Caldus's quest."]
        dossier.append(block)
    return dossier
