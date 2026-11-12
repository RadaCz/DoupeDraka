"""Reactive spellcasting — Shield reaction window (Sprint 33, SRD 5.1 2014 slice)."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .combat_action_economy import FLAG_REACTION_USED, _flag, spend_reaction
from .equipment import refresh_armor_class
from .models import CharacterState
from .spells import CASTER_CLASSES, spell_level

if TYPE_CHECKING:
    from .models import MonsterState
    from .service import GameEngine

PENDING_SHIELD_VS_ATTACK = "shield_vs_attack"
SHIELD_SPELL_NAME = "Shield"
SHIELD_AC_BONUS = 5

REACTION_TURN = "reaction"


def shield_ac_bonus(character: CharacterState) -> int:
    return SHIELD_AC_BONUS if getattr(character, "shield_active", False) else 0


def clear_shield_buff(character: CharacterState) -> None:
    if getattr(character, "shield_active", False):
        character.shield_active = False
        refresh_armor_class(character)


def _has_shield_spell(character: CharacterState) -> bool:
    names = {n.casefold() for n in character.known_spells + character.prepared_spells}
    return SHIELD_SPELL_NAME.casefold() in names


def _has_shield_slot(character: CharacterState) -> bool:
    level = spell_level(SHIELD_SPELL_NAME) or 1
    slots = character.spell_slots or {}
    return any(int(k) >= level and int(v) > 0 for k, v in slots.items())


def shield_reaction_offer_available(character: CharacterState) -> bool:
    if not character.in_combat or _flag(character, FLAG_REACTION_USED):
        return False
    if character.character_class not in CASTER_CLASSES or not _has_shield_spell(character):
        return False
    if not _has_shield_slot(character):
        return False
    return True


def has_pending_reaction(character: CharacterState) -> bool:
    pending = character.combat_reaction_pending or {}
    return bool(pending.get("kind"))


def pending_blocks_unrelated_action(character: CharacterState) -> tuple[bool, str]:
    if not has_pending_reaction(character):
        return False, ""
    if not character.in_combat:
        clear_combat_reaction_pending(character)
        return False, ""
    return True, "Resolve the incoming attack first — cast Shield or decline the reaction."


def open_shield_reaction_window(character: CharacterState, pending: dict[str, Any]) -> list[str]:
    character.combat_reaction_pending = dict(pending)
    character.combat_turn = REACTION_TURN
    return [
        "An enemy attack is about to hit you. "
        "You may cast Shield as a reaction (+5 AC until your next turn) or decline."
    ]


def clear_combat_reaction_pending(character: CharacterState) -> None:
    character.combat_reaction_pending = {}


def attack_roll_hits(ac: int, *, natural: int, attack_total: int) -> bool:
    if natural == 1:
        return False
    if natural == 20:
        return True
    return attack_total >= ac


def spend_shield_slot(character: CharacterState) -> tuple[int | None, list[str]]:
    level = spell_level(SHIELD_SPELL_NAME) or 1
    slot_level: int | None = None
    for key in sorted((int(k) for k in character.spell_slots), reverse=False):
        if key >= level and character.spell_slots.get(key, 0) > 0:
            slot_level = key
            break
    if slot_level is None:
        return None, ["You have no spell slot available for Shield."]
    character.spell_slots[slot_level] -= 1
    if character.spell_slots[slot_level] <= 0:
        del character.spell_slots[slot_level]
    return slot_level, [f"Spell slot level {slot_level} spent; remaining slots: {character.spell_slots}."]


def activate_shield_buff(character: CharacterState) -> list[str]:
    character.shield_active = True
    refresh_armor_class(character)
    return [
        f"Shield raises your AC by {SHIELD_AC_BONUS} "
        f"(now {character.armor_class}) until the start of your next turn."
    ]


def apply_pending_attack_damage(
    engine: GameEngine,
    character: CharacterState,
    monster: MonsterState,
    pending: dict[str, Any],
) -> list[str]:
    from .conditions import player_paralyzed
    from .concentration import concentration_save_after_damage, end_concentration_if_incapacitated

    natural = int(pending["natural"])
    attack_total = int(pending["attack_total"])
    ac = character.armor_class
    if not attack_roll_hits(ac, natural=natural, attack_total=attack_total):
        label = pending.get("label") or "attack"
        name = pending.get("monster_name") or monster.name
        return [f"{name}'s {label} misses after your defenses (attack {attack_total} vs AC {ac})."]

    dice = str(pending["damage_dice"])
    bonus = int(pending.get("damage_bonus") or 0)
    critical = bool(pending.get("critical"))
    melee = bool(pending.get("melee"))
    events: list[str] = []
    if melee and player_paralyzed(character) and natural != 1 and natural != 20:
        critical = True
        events.append("Melee hit against a paralyzed foe — critical damage.")
    damage = engine.roll(dice, bonus, critical)
    character.hp = max(0, character.hp - damage.total)
    name = pending.get("monster_name") or monster.name
    label = pending.get("label") or "attack"
    events.append(
        f"{name}'s {label} hits you for {damage.total}. Your HP: {character.hp}/{character.max_hp}."
    )
    events.extend(concentration_save_after_damage(engine, character, damage.total))
    events.extend(end_concentration_if_incapacitated(character))
    return events


def build_pending_attack_payload(
    *,
    monster: MonsterState,
    monster_key: str,
    label: str,
    melee: bool,
    natural: int,
    attack_total: int,
    critical: bool,
    damage_dice: str,
    damage_bonus: int,
) -> dict[str, Any]:
    return {
        "kind": PENDING_SHIELD_VS_ATTACK,
        "monster_name": monster.name,
        "monster_key": monster_key,
        "label": label,
        "melee": melee,
        "natural": natural,
        "attack_total": attack_total,
        "critical": critical,
        "damage_dice": damage_dice,
        "damage_bonus": damage_bonus,
    }


def reaction_shield_facts(character: CharacterState) -> dict[str, Any]:
    pending = character.combat_reaction_pending or {}
    return {
        "pending": bool(pending.get("kind")),
        "kind": pending.get("kind"),
        "shield_active": bool(getattr(character, "shield_active", False)),
        "shield_bonus": shield_ac_bonus(character),
        "reaction_available": not _flag(character, FLAG_REACTION_USED),
        "offer_shield": shield_reaction_offer_available(character) and pending.get("kind") == PENDING_SHIELD_VS_ATTACK,
    }
