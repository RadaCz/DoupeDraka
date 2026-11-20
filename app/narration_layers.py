"""Tři vrstvy Lite odpovědi: Příběh / Výsledek / Co dál (Úkol 17, AC17-3)."""

from __future__ import annotations

from typing import Any

from .ai.base import NarrationContext

_OUTCOME_CS = {
    "hit": "zásah",
    "miss": "minutí",
    "critical_hit": "kritický zásah",
}

_ABILITY_CS = {
    "strength": "Síla",
    "dexterity": "Obratnost",
    "constitution": "Odolnost",
    "intelligence": "Inteligence",
    "wisdom": "Moudrost",
    "charisma": "Charisma",
}

_REACTION_CS = {
    "shield": "Štít",
    "opportunity_attack": "Příležitostný útok",
}

_SIGNIFICANT_BEAT_KINDS = frozenset({"attack", "flee", "defend", "movement", "spell_damage", "healing"})


def _outcome_label_cs(outcome: str) -> str:
    key = outcome or ""
    if key == "critical_miss":
        key = "miss"
    return _OUTCOME_CS.get(key, key)


def _ability_label_cs(ability: str | None) -> str | None:
    if not ability:
        return None
    return _ABILITY_CS.get(str(ability).lower())


def _hero_hp_fraction(beat: dict[str, Any]) -> float | None:
    hero = beat.get("hero") or {}
    current = hero.get("hp_current")
    maximum = hero.get("hp_max")
    if current is None or not maximum:
        return None
    return float(current) / float(maximum)


def classify_combat_category_from_beats(beats: list[dict[str, Any]]) -> str | None:
    """Mapování resolution.beats → kategorie B1–B13 (priorita posledního významného beatu)."""
    if not beats:
        return None
    pool = [b for b in beats if b.get("kind") in _SIGNIFICANT_BEAT_KINDS] or list(beats)
    beat = pool[-1]
    kind = beat.get("kind")

    if kind == "flee":
        return "B11" if beat.get("success") else "B12"
    if kind == "defend":
        return "B5"
    if kind == "movement":
        dist = beat.get("distance_ft") or {}
        before = int(dist.get("from", 0))
        after = int(dist.get("to", 0))
        if after < before:
            return "B13-advance"
        if after > before:
            return "B13-retreat"
        return "B13-advance"

    if kind == "attack":
        actor = beat.get("actor")
        outcome = beat.get("outcome") or ""
        enemy = beat.get("enemy") or {}
        if actor == "hero":
            if enemy.get("hp_current") == 0:
                return "B9"
            if outcome == "critical_hit":
                return "B4"
            if outcome in {"miss", "critical_miss"}:
                return "B3"
            if outcome == "hit":
                return "B2"
        if actor == "enemy":
            if outcome in {"miss", "critical_miss"}:
                return "B7"
            if outcome in {"hit", "critical_hit"}:
                fraction = _hero_hp_fraction(beat)
                if fraction is not None and fraction <= 0.25:
                    return "B8"
                return "B6"

    if kind == "spell_damage":
        enemy = beat.get("enemy") or {}
        if beat.get("actor") == "hero" and enemy.get("hp_current") == 0:
            return "B9"
        return "B2"

    return None


def format_beat_outcome_cs(beat: dict[str, Any]) -> str:
    kind = beat.get("kind")
    if kind == "attack":
        roll = beat.get("attack_roll") or {}
        natural = roll.get("natural")
        modifier = roll.get("modifier", 0)
        total = roll.get("total", 0)
        ac = beat.get("target_ac")
        outcome = _outcome_label_cs(beat.get("outcome") or "")
        parts = [f"Útočný hod: {total} (d20{modifier:+d}) vs AC {ac} — {outcome}"]
        damage = beat.get("damage")
        if isinstance(damage, dict) and damage.get("total") is not None:
            parts.append(f"Poškození: {damage['total']}")
        elif isinstance(damage, (int, float)):
            parts.append(f"Poškození: {int(damage)}")
        return " · ".join(parts)

    if kind == "movement":
        dist = beat.get("distance_ft") or {}
        return f"Vzdálenost: {dist.get('from')} → {dist.get('to')} ft"

    if kind == "defend":
        return "Obrana: kryt zvednut"

    if kind == "flee":
        roll = beat.get("roll") or {}
        label = "Útěk poveden" if beat.get("success") else "Útěk nevyšel"
        return f"{label} · hod {roll.get('total')} vs DC {beat.get('dc')}"

    if kind == "healing":
        return f"Léčení: +{beat.get('healing')} HP"

    if kind == "spell_damage":
        spell = beat.get("spell_name") or "Kouzlo"
        dmg = beat.get("damage")
        if isinstance(dmg, dict):
            dmg = dmg.get("total")
        return f"{spell}: poškození {dmg}"

    if kind == "saving_throw":
        roll = beat.get("roll") or {}
        ok = "úspěch" if beat.get("success") else "neúspěch"
        ability = _ability_label_cs(beat.get("ability"))
        if ability:
            return f"Záchranný hod ({ability}): {roll.get('total')} vs DC {beat.get('dc')} — {ok}"
        return f"Záchranný hod: {roll.get('total')} vs DC {beat.get('dc')} — {ok}"

    if kind == "reaction":
        raw = beat.get("name") or ""
        label = _REACTION_CS.get(raw)
        if label:
            return f"Reakce: {label}"
        return "Reakce" if raw else ""

    return ""


def format_resolution_outcome(context: NarrationContext) -> str:
    resolution = context.resolution or {}
    beats = resolution.get("beats") or []
    if not beats:
        return ""
    language = (context.language or "en").lower()
    lines: list[str] = []
    for beat in beats:
        if language == "cs":
            line = format_beat_outcome_cs(beat)
        else:
            line = format_beat_outcome_en(beat)
        if line:
            lines.append(line)
    return "\n".join(lines)


def format_beat_outcome_en(beat: dict[str, Any]) -> str:
    kind = beat.get("kind")
    if kind == "attack":
        roll = beat.get("attack_roll") or {}
        total = roll.get("total", 0)
        modifier = roll.get("modifier", 0)
        ac = beat.get("target_ac")
        outcome = beat.get("outcome") or ""
        parts = [f"Attack roll {total} (d20{modifier:+d}) vs AC {ac} — {outcome}"]
        damage = beat.get("damage")
        if isinstance(damage, dict) and damage.get("total") is not None:
            parts.append(f"Damage {damage['total']}")
        return " · ".join(parts)
    if kind == "movement":
        dist = beat.get("distance_ft") or {}
        return f"Distance {dist.get('from')} → {dist.get('to')} ft"
    if kind == "defend":
        return "Defense: guard up"
    if kind == "flee":
        roll = beat.get("roll") or {}
        label = "Flee success" if beat.get("success") else "Flee failed"
        return f"{label} · roll {roll.get('total')} vs DC {beat.get('dc')}"
    if kind == "healing":
        return f"Healing: +{beat.get('healing')} HP"
    if kind == "spell_damage":
        spell = beat.get("spell_name") or "Spell"
        dmg = beat.get("damage")
        if isinstance(dmg, dict):
            dmg = dmg.get("total")
        return f"{spell}: damage {dmg}"
    return ""


def quest_next_hint(context: NarrationContext) -> str:
    dossier = context.scene_dossier or {}
    quests = dossier.get("quests") or {}
    active = quests.get("active_step") or {}
    hint = (active.get("hint") or "").strip()
    return hint


def compose_narration_layers(context: NarrationContext, story_prose: str) -> dict[str, str]:
    """Vrací tři oddělené vrstvy; próza ve story bez čísel, výsledek může čísla obsahovat."""
    outcome = format_resolution_outcome(context)
    nxt = quest_next_hint(context)
    return {
        "story": story_prose.strip(),
        "outcome": outcome.strip(),
        "next": nxt.strip(),
    }