"""Mock paid provider must receive Czech narration instructions for cs characters."""

from __future__ import annotations

import asyncio

import pytest

from app.ai.base import NarrationRequest
from app.ai.gateway import NamedProvider, NarrationGateway
from app.ai.offline import narrate_offline
from app.api import build_narration_context
from app.engine.models import CharacterState
from app.engine.service import GameEngine
from app.narrator import Narrator
from tests.test_api_systems import _mock_online_gateway, client  # noqa: F401
from tests.test_concurrency import auth, setup_db  # noqa: F401


class _CapturingProvider:
    requests: list[NarrationRequest] = []

    async def complete(self, request: NarrationRequest) -> str:
        self.requests.append(request)
        return "Caldus ti prozradí cestu do krypta."

    async def stream(self, request: NarrationRequest):
        self.requests.append(request)
        yield "Caldus "


@pytest.mark.asyncio
async def test_normal_tier_passes_czech_into_provider_request(monkeypatch):
    CapturingProvider = _CapturingProvider()
    CapturingProvider.requests.clear()
    gateway = NarrationGateway([NamedProvider("MockNIM", CapturingProvider)])

    monkeypatch.setattr("app.narrator.narration_gateway_for", lambda _s: gateway)

    hero = GameEngine().create_character(1, "Lyra", "elf", "wizard")
    hero.narration_language = "cs"
    context = build_narration_context(hero, "prohledat sklep", ("Exploration roll: 4 on a six-sided die.",), [])

    narration, status = await Narrator().narrate_detailed(context, billing_tier="normal")
    assert status == "narrated"
    assert narration
    assert CapturingProvider.requests
    req = CapturingProvider.requests[0]
    assert req.context.language == "cs"
    assert "Czech" in req.system_prompt or "cs" in req.system_prompt.lower()
    assert "Narration language" in req.user_prompt


def test_existing_character_language_respected_on_action(auth, monkeypatch):
    CapturingProvider = _CapturingProvider()
    CapturingProvider.requests.clear()
    gateway = NarrationGateway([NamedProvider("MockNIM", CapturingProvider)])

    _mock_online_gateway(monkeypatch)
    monkeypatch.setattr("app.ai.registry.narration_gateway_for", lambda _s: gateway)

    en_char = client.post(
        "/characters",
        headers={**auth, "Content-Type": "application/json"},
        json={"name": "English", "race": "human", "character_class": "fighter", "language": "en"},
    ).json()
    cs_char = client.post(
        "/characters",
        headers={**auth, "Content-Type": "application/json"},
        json={"name": "Czech", "race": "human", "character_class": "fighter", "language": "cs"},
    ).json()

    async def narrated(_self, context, **_kwargs):
        CapturingProvider.requests.append(
            NarrationRequest(
                context=context,
                system_prompt=Narrator.system_prompt(context),
                user_prompt="probe",
            )
        )
        return "done", "narrated"

    monkeypatch.setattr("app.narrator.Narrator.narrate_detailed", narrated)
    assert client.post("/economy/tier", json={"tier": "normal"}, headers=auth).status_code == 200

    client.post(f"/characters/{en_char['id']}/actions", json={"action": "look"}, headers=auth)
    client.post(f"/characters/{cs_char['id']}/actions", json={"action": "look"}, headers=auth)

    langs = [req.context.language for req in CapturingProvider.requests]
    assert "en" in langs
    assert "cs" in langs

    en_after = client.get(f"/characters/{en_char['id']}", headers=auth).json()
    assert en_after["narration_language"] == "en"


def test_settings_patch_changes_narration_language_only_when_requested(auth):
    character = client.post("/characters/presets/tank", headers=auth).json()
    assert character["narration_language"] == "en"
    patch = client.patch(
        f"/characters/{character['id']}/settings",
        json={"language": "cs"},
        headers=auth,
    )
    assert patch.status_code == 200
    assert patch.json()["narration_language"] == "cs"
    again = client.get(f"/characters/{character['id']}", headers=auth).json()
    assert again["narration_language"] == "cs"


def test_offline_fallback_stays_czech_for_cs_character():
    hero = CharacterState(
        id="00000000-0000-0000-0000-000000000099",
        owner_id=1,
        name="T",
        race="human",
        character_class="fighter",
        abilities={"strength": 10, "dexterity": 10, "constitution": 10, "intelligence": 10, "wisdom": 10, "charisma": 10},
        hp=10,
        max_hp=10,
        armor_class=10,
        level=1,
        xp=0,
        gold=0,
        inventory=[],
        location="The Whispering Cellar",
        narration_language="cs",
    )
    context = build_narration_context(hero, "hledat", ("You take a moment to catch your breath. No new threat appears.",), [])
    text = narrate_offline(context)
    assert "catch your breath" not in text.lower()
    assert any(word in text.lower() for word in ("dech", "klid", "zastav"))
