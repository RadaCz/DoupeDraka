"""Player-facing saving throw triggers: enemy abilities, hazards, enemy spells."""

from __future__ import annotations

from dataclasses import dataclass

from .models import CharacterState
from .saving_throws import SavingThrowRequest, SavingThrowResult, format_saving_throw_lines

if False:  # TYPE_CHECKING without import cycle
    from .service import GameEngine

OnFail = str  # "full" | "half" | "none"
OnSuccess = str  # "full" | "half" | "none"


@dataclass(frozen=True)
class SaveEffectDefinition:
    ability: str
    dc: int
    damage_dice: str
    damage_bonus: int
    on_fail: OnFail
    on_success: OnSuccess
    source: str
    source_id: str
    context_en: str
    outcome_success_en: str
    outcome_fail_en: str


@dataclass(frozen=True)
class EnemySaveAbility(SaveEffectDefinition):
    monster_key: str
    trigger: str  # every_turn | on_hit


LOCATION_HAZARDS: dict[str, SaveEffectDefinition] = {
    "The Vault of Echoes": SaveEffectDefinition(
        ability="dexterity",
        dc=13,
        damage_dice="2d6",
        damage_bonus=0,
        on_fail="full",
        on_success="none",
        source="trap",
        source_id="vault_falling_stones",
        context_en="Loose stones shake free from the vault ceiling — dodge!",
        outcome_success_en="You leap aside as rubble crashes where you stood.",
        outcome_fail_en="The stones slam into you.",
    ),
}

ENEMY_SAVE_ABILITIES: dict[str, EnemySaveAbility] = {
    "ghoul": EnemySaveAbility(
        monster_key="ghoul",
        trigger="on_hit",
        ability="constitution",
        dc=10,
        damage_dice="1d4",
        damage_bonus=0,
        on_fail="full",
        on_success="none",
        source="enemy ability",
        source_id="ghoul_paralyzing_claws",
        context_en="The ghoul's claws leave a grave-cold sting — resist!",
        outcome_success_en="You shake off the paralysis.",
        outcome_fail_en="Necrotic cold wracks your body.",
    ),
    "kobold": EnemySaveAbility(
        monster_key="kobold",
        trigger="on_hit",
        ability="dexterity",
        dc=11,
        damage_dice="1d4",
        damage_bonus=0,
        on_fail="full",
        on_success="none",
        source="enemy spell",
        source_id="kobold_caustic_spittle",
        context_en="The kobold spits alchemical froth — dodge or burn!",
        outcome_success_en="You avoid the worst of the spittle.",
        outcome_fail_en="Burning acid spatters your armor gaps.",
    ),
}

ONCE_PER_COMBAT_SAVE_IDS = frozenset({"kobold_caustic_spittle"})

VAULT_HAZARD_FLAG = "vault_falling_stones_triggered"


def _apply_damage_multiplier(base: int, mode: str) -> int:
    if mode == "none":
        return 0
    if mode == "half":
        return max(0, base // 2)
    return max(0, base)


def _combat_save_flag(definition: SaveEffectDefinition) -> str:
    return f"combat_save_used_{definition.source_id}"


def resolve_save_effect(
    engine: "GameEngine",
    character: CharacterState,
    definition: SaveEffectDefinition,
) -> tuple[SavingThrowResult, int, list[str]]:
    request = SavingThrowRequest(
        ability=definition.ability,
        dc=definition.dc,
        source=definition.source,
        source_id=definition.source_id,
    )
    result = engine.resolve_saving_throw(character, request)
    rolled = engine.roll(definition.damage_dice, definition.damage_bonus)
    if result.success:
        damage = _apply_damage_multiplier(rolled.total, definition.on_success)
        tail = definition.outcome_success_en
    else:
        damage = _apply_damage_multiplier(rolled.total, definition.on_fail)
        tail = definition.outcome_fail_en

    events = format_saving_throw_lines(result, context=definition.context_en)
    if damage > 0:
        character.hp = max(0, character.hp - damage)
        events.append(f"{tail} You take {damage} damage. Your HP: {character.hp}/{character.max_hp}.")
    else:
        events.append(f"{tail} You take no damage.")

    if character.hp == 0:
        if character.in_combat and character.combatant:
            character.hp = 1
            events.append("You drop to one knee but force yourself upright — the fight continues.")
        else:
            events.extend(engine._recover_from_combat_defeat(character))  # type: ignore[attr-defined]

    return result, damage, events


def try_vault_hazard(
    engine: "GameEngine",
    character: CharacterState,
    action: str,
) -> tuple[list[str], dict] | None:
    if character.location != "The Vault of Echoes":
        return None
    if character.quest_flags.get(VAULT_HAZARD_FLAG):
        return None
    lowered = action.casefold()
    if not any(word in lowered for word in ("explore", "look", "search", "investigate", "scout")):
        return None
    character.quest_flags[VAULT_HAZARD_FLAG] = True
    definition = LOCATION_HAZARDS["The Vault of Echoes"]
    result, damage, events = resolve_save_effect(engine, character, definition)
    facts = {
        "save": result.to_facts(),
        "damage": damage,
        "hazard_id": definition.source_id,
    }
    return events, facts
