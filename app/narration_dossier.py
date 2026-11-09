"""Read-only scene dossier for the narrator — engine state, never AI authority."""

from __future__ import annotations

from typing import Any

from .engine.locations import LOCATIONS
from .engine.models import CharacterState, MonsterState
from .engine.npc_presence import npc_presence_for_location
from .engine.quests import CHAPTER_ONE_STEPS, SIDE_QUESTS


from .journal_prose import narration_beats_from_journal as _narration_beats_from_journal


def narration_beats_from_journal(entries: list[str], *, limit: int = 5) -> tuple[str, ...]:
    """Previous story beats without mechanical lines (implemented in journal_prose)."""
    return _narration_beats_from_journal(entries, limit=limit)


def _quest_hint_for_flags(step_id: str, hint: str, flags: dict[str, bool]) -> str:
    """Hints must not reveal engine-gated story beats (e.g. Vault before Caldus tells it)."""
    if step_id == "vault_hint_given" and not flags.get("vault_hint_given"):
        if flags.get("bell_quest_complete"):
            return "Return to the Shrine of the Forgotten and speak with Caldus again."
        return "Continue the bell quest before seeking Caldus's further counsel."
    return hint


def _quest_progress(flags: dict[str, bool]) -> dict[str, Any]:
    completed = [step.id for step in CHAPTER_ONE_STEPS if flags.get(step.id)]
    active = next((step for step in CHAPTER_ONE_STEPS if not flags.get(step.id)), None)
    side = [
        {
            "id": q.id,
            "title": q.title,
            "complete": bool(flags.get(q.reward_flag)),
            "location": q.location,
        }
        for q in SIDE_QUESTS
    ]
    block: dict[str, Any] = {
        "main_quest": "chapter_one",
        "completed_step_ids": completed,
        "side_quests": side,
    }
    if active:
        block["active_step"] = {
            "id": active.id,
            "label": active.label,
            "hint": _quest_hint_for_flags(active.id, active.hint, flags),
            "location": active.location,
        }
    return block


def _combat_snapshot(character: CharacterState) -> dict[str, Any] | None:
    if not character.in_combat or not character.combatant:
        return None
    foe = MonsterState(**character.combatant)
    return {
        "enemy_name": foe.name,
        "enemy_hp": foe.hp,
        "enemy_max_hp": foe.max_hp,
        "enemy_ac": foe.armor_class,
        "combat_turn": character.combat_turn,
        "round": character.combat_round,
    }


def scene_dossier_for_character(character: CharacterState) -> dict[str, Any]:
    """Structured, read-only RPG context the model may describe but not override."""
    loc = LOCATIONS.get(character.location)
    visit_count = sum(1 for name in character.visited_locations if name == character.location)
    first_visit = visit_count <= 1 and character.location in character.visited_locations
    loc_block: dict[str, Any] = {
        "name": character.location,
        "atmosphere": loc.arrival_beat if loc else "",
        "first_visit_here": first_visit,
        "times_visited": visit_count,
    }
    if loc and not first_visit:
        loc_block["familiarity"] = "The hero has been here before."
    dossier: dict[str, Any] = {
        "hero": {
            "name": character.name,
            "race": character.race,
            "class": character.character_class,
            "level": character.level,
            "hp": character.hp,
            "max_hp": character.max_hp,
            "gold": character.gold,
            "death_state": character.death_state,
        },
        "location": loc_block,
        "quests": _quest_progress(dict(character.quest_flags)),
        "inventory_highlights": list(character.inventory[:8]),
        "in_combat": character.in_combat,
    }
    combat = _combat_snapshot(character)
    if combat:
        dossier["combat"] = combat
    if character.visited_locations:
        dossier["recently_visited"] = list(character.visited_locations[-5:])
    npcs = npc_presence_for_location(character.location, dict(character.quest_flags))
    if npcs:
        dossier["npcs_present"] = npcs
    return dossier
