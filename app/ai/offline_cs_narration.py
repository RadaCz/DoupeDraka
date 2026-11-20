"""Narrator V2 Lite — výběr kategorie podle faktů enginu a vykreslení cs šablon."""

from __future__ import annotations

import re

from ..display_localization import display_creature, display_npc
from .offline_variety import capitalize_cs_sentences
from .base import NarrationContext
from .offline_cs_catalog import (
    BATTLE_B11,
    BATTLE_B12,
    BATTLE_B13_ADVANCE,
    BATTLE_B13_RETREAT,
    BATTLE_CATEGORIES,
    CALDUS_RELATIONSHIP_KEY,
    CHAPTER_ONE_LOCATIONS,
    LOCATION_CS,
    LOCATION_SECONDARY_EXPLORE,
    MARA_RELATIONSHIP_KEY,
    NPC_CALDUS,
    NPC_NIB,
    NPC_MARA,
    NIB_RELATIONSHIP_KEY,
    SECONDARY_LOCATIONS,
)
from .offline_prose import _enemy_from_appears, _enemy_label
from .offline_variety import choose_variety, familiarity_lead, last_variant_index, variety_seed

_PLAYER_ATTACK_RE = re.compile(r":\s*(\d+)\s*\(d20\s*([+-]\d+)\)", re.IGNORECASE)
_HP_LINE_RE = re.compile(r"your hp:\s*(\d+)\s*/\s*(\d+)", re.IGNORECASE)


def _place_key(context: NarrationContext) -> str:
    dossier = context.scene_dossier or {}
    loc = dossier.get("location") or {}
    return (loc.get("name") or context.location or "").strip()


def _quest_flags(context: NarrationContext) -> dict[str, bool]:
    dossier = context.scene_dossier or {}
    quests = dossier.get("quests") or {}
    flags: dict[str, bool] = {}
    for step_id in quests.get("completed_step_ids") or []:
        flags[str(step_id)] = True
    active = quests.get("active_step") or {}
    if active.get("id"):
        flags[str(active["id"])] = True
    # Dossier may also carry engine quest_flags when injected in tests.
    extra = dossier.get("quest_flags") or {}
    if isinstance(extra, dict):
        flags.update({k: bool(v) for k, v in extra.items()})
    return flags


def _foe_cs(context: NarrationContext) -> str:
    raw = _enemy_from_appears(context.events) or _enemy_label(context, context.events)
    resolution = context.resolution or {}
    for beat in reversed(resolution.get("beats") or []):
        enemy = beat.get("enemy") or {}
        name = enemy.get("name")
        if name:
            raw = str(name)
            break
    dossier = context.scene_dossier or {}
    combat = dossier.get("combat") or {}
    if combat.get("enemy_name"):
        raw = str(combat["enemy_name"])
    if raw in ("your foe", "nepřítel"):
        return "nepřítel"
    creature = display_creature(raw, "cs")
    if creature == raw:
        creature = display_creature(raw.title(), "cs")
    if creature == raw and raw.casefold() in ("goblin", "orc"):
        return display_creature(raw.title(), "cs")
    return creature


def _render_category(
    context: NarrationContext,
    category: str,
    *,
    foe: str,
    lead: str,
    options: tuple[str, ...] | None = None,
) -> str:
    templates = options or BATTLE_CATEGORIES[category]
    seed = variety_seed(context)
    last = last_variant_index(context, category)
    text, _ = choose_variety(templates, seed, last_index=last)
    rendered = text.replace("{foe}", foe).replace("{lead}", lead)
    return capitalize_cs_sentences(rendered)


def _player_attack_natural(events: tuple[str, ...]) -> int | None:
    for event in events:
        low = event.lower()
        if "attack with" not in low and "attack roll" not in low:
            continue
        match = _PLAYER_ATTACK_RE.search(event)
        if match:
            return int(match.group(1)) - int(match.group(2))
    return None


def _hero_hp_fraction_from_context(context: NarrationContext) -> float | None:
    for event in reversed(context.events):
        match = _HP_LINE_RE.search(event)
        if match:
            hp = int(match.group(1))
            max_hp = int(match.group(2))
            if max_hp <= 0:
                return None
            return hp / max_hp
    dossier = context.scene_dossier or {}
    hero = dossier.get("hero") or {}
    hp = hero.get("hp")
    max_hp = hero.get("max_hp")
    if hp is not None and max_hp:
        return float(hp) / float(max_hp)
    return None


def _has_player_attack(facts: str) -> bool:
    return "attack roll" in facts or "attack with" in facts


def classify_combat_category(context: NarrationContext) -> str | None:
    """Mapování faktů enginu → kategorie B1–B13 (bez B1 otevírání boje)."""
    resolution = context.resolution or {}
    beats = resolution.get("beats") or []
    if beats:
        from ..narration_layers import classify_combat_category_from_beats

        mapped = classify_combat_category_from_beats(beats)
        if mapped:
            return mapped

    joined = " ".join(context.events)
    facts = joined.lower()

    if context.defeat_facts or "your hp: 0/" in facts:
        return "B10"
    if "break away and escape" in facts:
        return "B11"
    if "fail to break away" in facts:
        return "B12"
    if "you advance " in facts:
        return "B13-advance"
    if "you retreat " in facts:
        return "B13-retreat"
    if "you dodge and gain disadvantage" in facts:
        return "B5"
    if " is defeated" in facts or "defeated. you gain" in facts:
        return "B9"
    if _has_player_attack(facts):
        if " is defeated" in facts or "defeated. you gain" in facts or " has 0 hp" in facts:
            return "B9"
        if "critical miss" in facts or "— miss" in facts or " — miss." in facts:
            return "B3"
        natural = _player_attack_natural(context.events)
        if natural == 20 and ("— hit" in facts or " hit." in facts):
            return "B4"
        if "— hit" in facts or (" hit." in facts and "damage" in facts):
            return "B2"
        if "— miss" in facts or " miss." in facts:
            return "B3"

    if "hits you for" in facts:
        fraction = _hero_hp_fraction_from_context(context)
        if fraction is not None and fraction <= 0.25:
            return "B8"
        return "B6"
    if " misses" in facts and ("attack" in facts or "strike" in facts):
        return "B7"

    return None


def combat_prose_v2_cs(context: NarrationContext) -> str | None:
    category = classify_combat_category(context)
    if category is None:
        return None
    foe = _foe_cs(context)
    lead = familiarity_lead(context, language="cs")
    if category == "B13-advance":
        return _render_category(context, "B13", foe=foe, lead=lead, options=BATTLE_B13_ADVANCE)
    if category == "B13-retreat":
        return _render_category(context, "B13", foe=foe, lead=lead, options=BATTLE_B13_RETREAT)
    if category == "B11":
        return _render_category(context, "B11", foe=foe, lead=lead, options=BATTLE_B11)
    if category == "B12":
        return _render_category(context, "B12", foe=foe, lead=lead, options=BATTLE_B12)
    return _render_category(context, category, foe=foe, lead=lead)


def combat_opening_v2_cs(context: NarrationContext) -> str | None:
    joined = " ".join(context.events).lower()
    if "attack roll" in joined or "attack with" in joined:
        return None
    if not any("an enemy appears:" in event.lower() for event in context.events):
        if "initiative:" not in joined:
            return None
    foe = _foe_cs(context)
    lead = familiarity_lead(context, language="cs")
    return _render_category(context, "B1", foe=foe, lead=lead)


def _shrine_explore_options(context: NarrationContext) -> tuple[str, ...]:
    loc = LOCATION_CS["The Shrine of the Forgotten"]["explore"]
    flags = _quest_flags(context)
    if flags.get("bell_quest_complete"):
        return tuple(line for line in loc if "prázdné místo po zvonu" not in line.lower())
    return loc


def location_scene_type(context: NarrationContext, *, breath: bool = False, explore: bool = False) -> str | None:
    if breath:
        return "breath"
    if explore:
        dossier = context.scene_dossier or {}
        loc = dossier.get("location") or {}
        if loc.get("first_visit_here", True) is False:
            return "revisit"
        return "explore"
    dossier = context.scene_dossier or {}
    loc = dossier.get("location") or {}
    if loc.get("first_visit_here", True) is False:
        return "revisit"
    return "explore"


def location_prose_v2_cs(
    context: NarrationContext,
    *,
    breath: bool = False,
    explore: bool = False,
) -> str | None:
    key = _place_key(context)
    scene = location_scene_type(context, breath=breath, explore=explore)
    if scene is None:
        return None

    if key in CHAPTER_ONE_LOCATIONS:
        lead = familiarity_lead(context, language="cs")
        if key == "The Shrine of the Forgotten" and scene == "explore":
            options = _shrine_explore_options(context)
        else:
            options = LOCATION_CS[key][scene]
        seed = variety_seed(context)
        category = f"C-{key}-{scene}"
        last = last_variant_index(context, category)
        text, _ = choose_variety(options, seed, last_index=last)
        return capitalize_cs_sentences(f"{lead}{text}")

    if key in SECONDARY_LOCATIONS and explore and scene == "explore":
        lead = familiarity_lead(context, language="cs")
        seed = variety_seed(context)
        category = f"C-secondary-{key}"
        last = last_variant_index(context, category)
        text, _ = choose_variety(LOCATION_SECONDARY_EXPLORE, seed, last_index=last)
        return capitalize_cs_sentences(f"{lead}{text}")

    return None


def npc_talk_prose_v2_cs(context: NarrationContext) -> str | None:
    if (context.scene_kind or "") != "talk":
        return None
    action = context.action.casefold()
    flags = _quest_flags(context)
    dossier = context.scene_dossier or {}
    present = list(dossier.get("npcs_present") or [])
    targets: list[dict] = []
    for npc in present:
        npc_id = npc.get("id") or ""
        name = (npc.get("name") or "").casefold()
        if name and (name in action or npc_id in action):
            targets.append(npc)
    if not targets and len(present) == 1:
        targets = present
    for npc in targets:
        npc_id = npc.get("id") or ""
        rel = npc.get("relationship_to_hero") or ""
        seed = variety_seed(context)
        category = f"D-{npc_id}"
        last = last_variant_index(context, category)
        if npc_id == "caldus":
            if flags.get("vault_hint_given") and any(
                word in action for word in ("vault", "komnata", "ozvěn", "echo", "strážce")
            ):
                options = NPC_CALDUS["vault"]
            else:
                options = NPC_CALDUS[CALDUS_RELATIONSHIP_KEY.get(rel, "cautious")]
        elif npc_id == "nib":
            options = NPC_NIB[NIB_RELATIONSHIP_KEY.get(rel, "indifferent")]
        elif npc_id == "mara":
            options = NPC_MARA[MARA_RELATIONSHIP_KEY.get(rel, "neutral")]
        else:
            continue
        text, _ = choose_variety(options, seed, last_index=last)
        lead = familiarity_lead(context, language="cs")
        display_name = display_npc(str(npc.get("name") or npc_id), "cs")
        line = f"{lead}{display_name} řekne: „{text}“"
        return capitalize_cs_sentences(line)
    return None