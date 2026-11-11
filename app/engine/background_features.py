"""Engine-authoritative SRD background features for Chapter One (Sprint 24)."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import TYPE_CHECKING

from .character_creation import MVP_BACKGROUNDS
from .models import TurnResult

if TYPE_CHECKING:
    from .service import GameEngine

FLAG_ACOLYTE = "bg_acolyte_shelter_used"
FLAG_CRIMINAL = "bg_criminal_contact_used"
FLAG_FOLK_HERO = "bg_folk_hero_hospitality_used"
FLAG_SAGE = "bg_sage_researcher_used"
FLAG_SOLDIER = "bg_soldier_rank_used"
FLAG_HERMIT = "bg_hermit_discovery_used"


@dataclass(frozen=True)
class BackgroundFeatureSpec:
    background_key: str
    location: str
    flag: str
    action_pattern: re.Pattern[str]
    chip_action: str


FEATURES: tuple[BackgroundFeatureSpec, ...] = (
    BackgroundFeatureSpec(
        "acolyte",
        "The Shrine of the Forgotten",
        FLAG_ACOLYTE,
        re.compile(
            r"\b(?:seek|request|use)\b.{0,40}\b(?:shelter of the faithful|temple shelter|útočiště víry)\b",
            re.IGNORECASE,
        ),
        "seek shelter of the faithful",
    ),
    BackgroundFeatureSpec(
        "criminal",
        "The Goblin Market",
        FLAG_CRIMINAL,
        re.compile(
            r"\b(?:use|call on|contact)\b.{0,32}\b(?:criminal contact|underworld contact|kontakt z podsvětí)\b",
            re.IGNORECASE,
        ),
        "use criminal contact",
    ),
    BackgroundFeatureSpec(
        "folk_hero",
        "The Sunken Corridor",
        FLAG_FOLK_HERO,
        re.compile(
            r"\b(?:call on|invoke|use)\b.{0,32}\b(?:rustic hospitality|lidovou pohostinnost)\b",
            re.IGNORECASE,
        ),
        "call on rustic hospitality",
    ),
    BackgroundFeatureSpec(
        "sage",
        "The Vault of Echoes",
        FLAG_SAGE,
        re.compile(
            r"\b(?:use|apply)\b.{0,32}\b(?:researcher training|researcher|výzkumník|výzkum)\b",
            re.IGNORECASE,
        ),
        "use researcher training",
    ),
    BackgroundFeatureSpec(
        "soldier",
        "The Bandit Camp",
        FLAG_SOLDIER,
        re.compile(
            r"\b(?:invoke|use|claim)\b.{0,32}\b(?:military rank|vojenskou hodnost)\b",
            re.IGNORECASE,
        ),
        "invoke military rank",
    ),
    BackgroundFeatureSpec(
        "hermit",
        "The Underground River",
        FLAG_HERMIT,
        re.compile(
            r"\b(?:share|invoke|recall)\b.{0,40}\b(?:hermit discovery|your discovery|poustevnické zjevení)\b",
            re.IGNORECASE,
        ),
        "share hermit discovery",
    ),
)


def feature_for_action(action: str) -> BackgroundFeatureSpec | None:
    folded = re.sub(r"\s+", " ", action.strip())
    for spec in FEATURES:
        if spec.action_pattern.search(folded) or folded.casefold() == spec.chip_action.casefold():
            return spec
    return None


def feature_catalog_for_character(background: str) -> dict | None:
    bg = MVP_BACKGROUNDS.get(background)
    if bg is None:
        return None
    spec = next((s for s in FEATURES if s.background_key == background), None)
    if spec is None:
        return None
    feat = bg.get("feature") or {}
    return {
        "background": background,
        "name": feat.get("name", ""),
        "location": spec.location,
        "chip_action": spec.chip_action,
        "flag": spec.flag,
    }


def try_background_feature(character, action: str) -> TurnResult | None:
    if character.in_combat or not action.strip():
        return None
    spec = feature_for_action(action)
    if spec is None:
        return None
    if character.location != spec.location:
        return TurnResult(
            action,
            [f"That background ability only helps at {spec.location}."],
            False,
            costs_adventure_mana=False,
        )
    bg = (character.background or "").casefold().replace(" ", "_")
    if bg != spec.background_key:
        name = MVP_BACKGROUNDS.get(spec.background_key, {}).get("name", spec.background_key)
        return TurnResult(
            action,
            [f"Only a {name} background can use that gift here."],
            False,
            costs_adventure_mana=False,
        )
    flags = character.quest_flags
    if flags.get(spec.flag):
        return TurnResult(
            action,
            ["You already drew on that background gift in this chapter."],
            False,
            costs_adventure_mana=False,
        )
    flags[spec.flag] = True
    return _resolve_feature(spec, character, action)


def _resolve_feature(spec: BackgroundFeatureSpec, character, action: str) -> TurnResult:
    flags = character.quest_flags
    facts = {"background_feature": spec.background_key, "flag": spec.flag}

    if spec.background_key == "acolyte":
        flags["acolyte_shrine_sanctuary_lore"] = True
        if not flags.get("shrine_trail_noted"):
            flags["shrine_trail_noted"] = True
        return TurnResult(
            action,
            [
                "Caldus recognizes your devotion and shares what the faithful know: "
                "boot prints from the theft lead toward the Goblin Market, and the Sunken Corridor still floods below.",
                "New discovery: Temple shelter — the shrine's network remembers the thief's route.",
            ],
            True,
            save_facts=facts,
            costs_adventure_mana=False,
        )

    if spec.background_key == "criminal":
        if not flags.get("bell_market_rumor"):
            flags["bell_market_rumor"] = True
        return TurnResult(
            action,
            [
                "A hooded contact slips you a scrap: Nib fenced the stolen shrine bell through this market.",
                "New discovery: Your underworld contact confirms the bell passed through Nib's stall.",
            ],
            True,
            save_facts=facts,
            costs_adventure_mana=False,
        )

    if spec.background_key == "folk_hero":
        flags["mara_warned"] = True
        flags["heard_waterway_danger"] = True
        flags["folk_hero_mara_bond"] = True
        return TurnResult(
            action,
            [
                "Mara claps you on the shoulder — common folk remember you. "
                "She warns that something hunts the flooded corridor toward the shrine light.",
                "New discovery: Rustic hospitality — Mara trusts you with the waterway's danger.",
            ],
            True,
            save_facts=facts,
            costs_adventure_mana=False,
        )

    if spec.background_key == "sage":
        flags["sage_vault_toll_lore"] = True
        return TurnResult(
            action,
            [
                "Your researcher training deciphers the echoing inscriptions: "
                "the Bell Warden collects a toll in steel — expect saving throws and heavy blows in the pit.",
                "New discovery: Vault lore — the Warden's toll is inscribed in the echoing stone.",
            ],
            True,
            save_facts=facts,
            costs_adventure_mana=False,
        )

    if spec.background_key == "soldier":
        if not flags.get("bandit_bounty_read"):
            flags["bandit_bounty_read"] = True
        flags["soldier_bandit_layout"] = True
        return TurnResult(
            action,
            [
                "You straighten your insignia; a nervous lookout salutes. "
                "They mutter that stolen shrine goods are logged in the captain's tent before sale at the Goblin Market.",
                "New discovery: Military bearing — the bandits' ledger sits with their captain.",
            ],
            True,
            save_facts=facts,
            costs_adventure_mana=False,
        )

    if spec.background_key == "hermit":
        flags["hermit_river_revelation"] = True
        if not flags.get("disc_clue_underground_river"):
            from .discoveries import clue_flag, location_slug

            flags[clue_flag(location_slug("The Underground River"))] = True
        return TurnResult(
            action,
            [
                "Your solitary discovery resurfaces: the broken ferry chain marks a path toward the Forgotten Crypt.",
                "New discovery: Hermit insight — the river's broken chain links to deeper graves.",
            ],
            True,
            save_facts=facts,
            costs_adventure_mana=False,
        )

    return TurnResult(action, ["That background gift cannot be used here."], False, costs_adventure_mana=False)
