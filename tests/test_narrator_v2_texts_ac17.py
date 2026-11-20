"""Regresní testy Úkol 17 texty (Designer SPEC_17_texts_designer a–g)."""

from __future__ import annotations

import re

import pytest

from app.ai.base import NarrationContext
from app.ai.offline import narrate_offline
from app.ai.offline_cs_catalog import LOCATION_CS
from app.ai.offline_cs_narration import (
    combat_prose_v2_cs,
    location_prose_v2_cs,
    npc_talk_prose_v2_cs,
)
from app.ai.offline_variety import familiarity_lead, variety_seed
from app.ai.offline_variety import choose_variety
from app.display_localization import (
    catalog_for_tests,
    display_location_gen_cs,
    display_location_in,
    display_location_to,
    display_quest_hint,
    embed_catalog_names,
)
from app.engine.quests import CHAPTER_ONE_STEPS, SIDE_QUESTS
from app.narration_layers import compose_narration_layers, format_beat_outcome_cs, quest_next_hint


def _ctx(**kwargs) -> NarrationContext:
    defaults = {"language": "cs", "location": "The Shrine of the Forgotten", "events": (), "memories": (), "action": ""}
    defaults.update(kwargs)
    return NarrationContext(**defaults)


# --- a) hint_cs (Designer DOPLNĚK: všech 7 kroků z quests.py) ---

_QUEST_HINT_CS_EXPECTED: dict[str, str] = {
    "bell_quest_accepted": "Ve Svatyni zapomenutých si promluv s Caldem o zvonu.",
    "bell_acquired": "Vydej se na Gobliní trh a zeptej se Niba na chrámový zvon.",
    "bell_quest_complete": "Vrať se do svatyně a odevzdej zvon Caldovi.",
    "vault_hint_given": (
        "Vrať se do Svatyně zapomenutých a znovu promluv s Caldem. "
        "Teď, když má zvon zpátky, ti prozradí cestu do Komnaty ozvěn."
    ),
    "vault_first_descent": (
        "Sestup do Komnaty ozvěn, Caldus varoval před nebezpečím. Přežij první sestup "
        "a než se postavíš Strážci zvonu, dosáhni alespoň 3. úrovně."
    ),
    "chapter_one_complete": (
        "Až budeš mít alespoň 3. úroveň, vstup do Jámy strážce zvonu a postav se Strážci."
    ),
    "crypt_echo_relic": "Prohledej Zapomenutou kryptu. Za puklým sarkofágem je ukrytá relikvie.",
}


def _all_quest_hint_ids() -> tuple[str, ...]:
    ids = [step.id for step in CHAPTER_ONE_STEPS]
    ids.extend(q.id for q in SIDE_QUESTS)
    return tuple(ids)


@pytest.mark.parametrize("step_id", _all_quest_hint_ids())
def test_ac17_texts_quest_hint_cs_exact(step_id: str):
    expected = _QUEST_HINT_CS_EXPECTED[step_id]
    assert display_quest_hint(step_id, "cs") == expected


def test_ac17_texts_quest_next_layer_uses_cs_catalog():
    ctx = _ctx(
        scene_dossier={
            "quests": {
                "active_step": {
                    "id": "bell_quest_accepted",
                    "hint": "At the Shrine of the Forgotten, talk to Caldus about the bell.",
                }
            }
        }
    )
    assert quest_next_hint(ctx) == "Ve Svatyni zapomenutých si promluv s Caldem o zvonu."
    layers = compose_narration_layers(ctx, "Příběh.")
    assert "At the Shrine" not in layers["next"]


# --- b) prázdný Výsledek u rozhovoru ---


def test_ac17_texts_talk_outcome_empty():
    ctx = _ctx(
        scene_kind="talk",
        action="promluvit s Caldusem",
        scene_dossier={
            "location": {"name": "The Shrine of the Forgotten"},
            "npcs_present": [{"id": "caldus", "name": "Caldus", "relationship_to_hero": "cautious"}],
            "quests": {"active_step": {"id": "bell_quest_accepted", "hint": "…"}},
        },
    )
    story = narrate_offline(ctx)
    layers = compose_narration_layers(ctx, story)
    assert layers["outcome"] == ""


# --- c) NPC formát ---


def test_ac17_texts_npc_reply_format():
    ctx = _ctx(
        scene_kind="talk",
        action="promluvit s Caldusem",
        events=("You speak with Caldus.",),
        scene_dossier={
            "location": {"name": "The Shrine of the Forgotten", "first_visit_here": True},
            "npcs_present": [
                {
                    "id": "caldus",
                    "name": "Caldus",
                    "relationship_to_hero": "Cautious but welcoming to respectful guests.",
                }
            ],
        },
    )
    line = npc_talk_prose_v2_cs(ctx)
    assert line
    assert re.match(r"^Caldus řekne: „.+“$", line)


# --- d) in_cs / to_cs ---


@pytest.mark.parametrize(
    "name,expected_in,expected_to",
    [
        ("The Shrine of the Forgotten", "ve Svatyni zapomenutých", "do Svatyně zapomenutých"),
        ("The Goblin Market", "na Gobliním trhu", "na Gobliní trh"),
    ],
)
def test_ac17_texts_location_in_to_cs(name: str, expected_in: str, expected_to: str):
    assert display_location_in(name, "cs") == expected_in
    assert display_location_to(name, "cs") == expected_to


def test_ac17_texts_familiarity_lead_shrine_in_cs():
    ctx = _ctx(
        location="The Shrine of the Forgotten",
        scene_dossier={"location": {"name": "The Shrine of the Forgotten", "first_visit_here": False}},
    )
    lead = familiarity_lead(ctx, language="cs")
    assert lead
    assert " v svatyni " not in lead.lower()
    assert "goblińího" not in lead
    assert any(
        phrase in lead
        for phrase in (
            "ve Svatyni zapomenutých",
            "Svatyně zapomenutých",
            "do Svatyně zapomenutých",
        )
    )


def test_ac17_texts_all_chapter_one_locations_have_in_to_cs():
    locs = catalog_for_tests().get("locations", {})
    for key in LOCATION_CS:
        entry = locs.get(key, {})
        assert entry.get("in_cs"), key
        assert entry.get("to_cs"), key


_LOCATION_GEN_CS_EXPECTED: dict[str, str] = {
    "The Whispering Cellar": "Šeptajícího sklepa",
    "The Sunken Corridor": "Potopené chodby",
    "The Shrine of the Forgotten": "Svatyně zapomenutých",
    "The Goblin Market": "Gobliního trhu",
    "The Vault of Echoes": "Komnaty ozvěn",
    "The Bell Warden's Pit": "Jámy strážce zvonu",
    "The Forgotten Crypt": "Zapomenuté krypty",
    "The Underground River": "Podzemní řeky",
    "The Bandit Camp": "Tábora loupežníků",
}


@pytest.mark.parametrize("name,expected", list(_LOCATION_GEN_CS_EXPECTED.items()))
def test_ac17_texts_location_gen_cs(name: str, expected: str):
    assert display_location_gen_cs(name, "cs") == expected
    assert expected[0].isupper()


def test_ac17_texts_every_catalog_location_has_gen_cs():
    """Přesné gen_cs v chapter_one_display.json — Designer tabulka (9 lokací)."""
    locs = catalog_for_tests().get("locations", {})
    assert len(_LOCATION_GEN_CS_EXPECTED) == 9
    for name, expected in _LOCATION_GEN_CS_EXPECTED.items():
        entry = locs.get(name)
        assert isinstance(entry, dict), name
        gen = entry.get("gen_cs")
        assert gen == expected, f"{name}: očekáváno {expected!r}, v katalogu {gen!r}"


def test_ac17_texts_familiarity_walls_lead_uses_gen_cs():
    for salt in range(120):
        ctx = _ctx(
            location="The Sunken Corridor",
            events=(f"revisit-salt-{salt}",),
            scene_dossier={"location": {"name": "The Sunken Corridor", "first_visit_here": False}},
        )
        lead = familiarity_lead(ctx, language="cs")
        if lead.startswith("Známé stěny"):
            assert "Potopené chodby" in lead
            assert "Potopená chodba" not in lead
            return
    raise AssertionError("seed nevybral variantu Známé stěny")


def test_ac17_texts_embed_catalog_skips_goblin_inside_goblini():
    text = "Vracíš se na Gobliní trh a prostor ti odpovídá tíhou vzpomínek."
    assert embed_catalog_names(text, "cs") == text


def _english_creature_labels_pattern() -> re.Pattern[str]:
    creatures = catalog_for_tests().get("creatures", {})
    keys = sorted(
        (k for k in creatures if re.search(r"[A-Za-z]", k)),
        key=len,
        reverse=True,
    )
    return re.compile(r"\b(?:" + "|".join(re.escape(k) for k in keys) + r")\b")


# --- e) {foe} nominativ + velká písmena ---


def test_ac17_texts_foe_goblin_cs_catalog_in_combat_prose():
    beats = [
        {
            "kind": "spell_damage",
            "subtype": "spell_attack",
            "actor": "hero",
            "spell_name": "Fire Bolt",
            "damage": 8,
            "hero": {"hp_current": 18, "hp_max": 20},
            "enemy": {"hp_current": 12, "hp_max": 20, "name": "Goblin"},
        }
    ]
    ctx = _ctx(
        scene_kind="combat",
        action="cast Fire Bolt at Goblin",
        events=("Fire Bolt hits.",),
        resolution={"beats": beats},
        scene_dossier={"location": {"name": "The Whispering Cellar"}, "combat": {"enemy_name": "Goblin"}},
    )
    prose = combat_prose_v2_cs(ctx)
    assert prose
    assert "Gobliní zvěd" in prose
    assert _english_creature_labels_pattern().search(prose) is None


def test_ac17_texts_cs_combat_prose_no_english_creature_catalog_names():
    pattern = _english_creature_labels_pattern()
    scenarios: list[NarrationContext] = [
        _ctx(
            scene_kind="combat",
            action="cast Fire Bolt at Goblin",
            events=("Fire Bolt hits.",),
            resolution={
                "beats": [
                    {
                        "kind": "spell_damage",
                        "actor": "hero",
                        "spell_name": "Fire Bolt",
                        "damage": 8,
                        "enemy": {"hp_current": 12, "hp_max": 20, "name": "Goblin"},
                    }
                ]
            },
            scene_dossier={"location": {"name": "The Whispering Cellar"}, "combat": {"enemy_name": "Goblin"}},
        ),
        _ctx(
            scene_kind="combat",
            events=("Orc misses.",),
            resolution={
                "beats": [
                    {
                        "kind": "attack",
                        "actor": "enemy",
                        "outcome": "miss",
                        "enemy": {"name": "Orc", "hp_current": 14, "hp_max": 20},
                    }
                ]
            },
            scene_dossier={"location": {"name": "The Whispering Cellar"}, "combat": {"enemy_name": "Orc"}},
        ),
    ]
    for ctx in scenarios:
        prose = combat_prose_v2_cs(ctx)
        assert prose
        assert pattern.search(prose) is None, f"anglické jméno tvora v: {prose!r}"


def test_ac17_texts_foe_from_creature_catalog():
    beats = [
        {
            "kind": "attack",
            "actor": "enemy",
            "outcome": "miss",
            "enemy": {"name": "Orc", "hp_current": 14, "hp_max": 20},
        }
    ]
    ctx = _ctx(
        scene_kind="combat",
        events=("Orc misses.",),
        resolution={"beats": beats},
        scene_dossier={"location": {"name": "The Whispering Cellar"}, "combat": {"enemy_name": "Orc"}},
    )
    prose = combat_prose_v2_cs(ctx)
    assert prose
    assert "Orčí nájezdník" in prose
    assert "nepřítel" not in prose.casefold()


def test_ac17_texts_sentence_capitalization_after_lead():
    ctx = _ctx(
        scene_kind="combat",
        events=("Goblin misses.",),
        resolution={
            "beats": [
                {
                    "kind": "attack",
                    "actor": "enemy",
                    "outcome": "miss",
                    "enemy": {"name": "Orc marauder", "hp_current": 10, "hp_max": 20},
                }
            ]
        },
        scene_dossier={
            "location": {"name": "The Shrine of the Forgotten", "first_visit_here": False},
            "combat": {"enemy_name": "Orc marauder"},
        },
    )
    prose = combat_prose_v2_cs(ctx)
    assert prose
    for sentence in [s.strip() for s in prose.split(".") if s.strip()]:
        assert sentence[0].isupper(), sentence


# --- f) kouzlo ve Výsledku ---


def test_ac17_texts_spell_name_in_outcome_layer():
    beat = {
        "kind": "spell_damage",
        "spell_name": "Fire Bolt",
        "damage": 8,
    }
    line = format_beat_outcome_cs(beat)
    assert line.startswith("Ohnivý paprsek:")
    assert "Fire Bolt" not in line


def test_ac17_texts_outcome_layer_uses_oc_and_st_not_ac_dc():
    attack = format_beat_outcome_cs(
        {
            "kind": "attack",
            "outcome": "hit",
            "attack_roll": {"natural": 15, "modifier": 3, "total": 18},
            "target_ac": 13,
        }
    )
    assert "vs OČ 13" in attack
    assert " vs AC " not in attack
    save = format_beat_outcome_cs(
        {
            "kind": "saving_throw",
            "ability": "wisdom",
            "dc": 15,
            "roll": {"total": 14},
            "success": False,
        }
    )
    assert "vs ST 15" in save
    assert " vs DC " not in save
    flee = format_beat_outcome_cs(
        {
            "kind": "flee",
            "success": True,
            "dc": 12,
            "roll": {"total": 16},
        }
    )
    assert "vs ST 12" in flee


# --- g) AC17-5 dvě návštěvy Svatyně ---


def test_ac17_texts_ac17_5_two_consecutive_shrine_revisit_explore_variants():
    key = "The Shrine of the Forgotten"
    base = {
        "location": {"name": key, "first_visit_here": False},
        "narrator_variety": {},
    }
    ctx1 = _ctx(
        events=("You explore the shrine.",),
        action="prozkoumat svatyni",
        scene_kind="explore",
        location=key,
        scene_dossier=base,
    )
    text1 = location_prose_v2_cs(ctx1, explore=True)
    assert text1
    category = f"C-{key}-revisit"
    options = LOCATION_CS[key]["revisit"]
    seed = variety_seed(ctx1)
    _, idx1 = choose_variety(options, seed)
    ctx2 = _ctx(
        events=("You explore the shrine again.",),
        action="prozkoumat svatyni",
        scene_kind="explore",
        location=key,
        scene_dossier={**base, "narrator_variety": {category: idx1}},
    )
    text2 = location_prose_v2_cs(ctx2, explore=True)
    assert text2
    assert text1 != text2