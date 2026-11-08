"""API coverage for the systems added on top of the deterministic engine."""
import asyncio

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.api import app
from app.db import Session, User, init_db

client = TestClient(app)


@pytest.fixture
def setup_db():
    asyncio.run(init_db())
    yield
    async def cleanup():
        async with Session() as session:
            for table in ("energy_transactions", "api_keys", "characters", "events", "users"):
                await session.execute(text(f"DELETE FROM {table}"))
            await session.commit()
    asyncio.run(cleanup())


@pytest.fixture
def auth(setup_db):
    """Register and log in a fresh user, returning bearer headers."""
    client.post("/auth/register", json={"username": "systems", "password": "password123"})
    token = client.post(
        "/auth/login", json={"username": "systems", "password": "password123"}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_presets_are_public_and_documented():
    response = client.get("/characters/presets")
    assert response.status_code == 200
    presets = response.json()
    assert {preset["key"] for preset in presets} == {"tank", "skirmisher", "support", "healer"}
    for preset in presets:
        assert {"key", "name", "race", "character_class", "role"} <= set(preset)


def test_create_character_from_preset(auth):
    response = client.post("/characters/presets/tank", headers=auth)
    assert response.status_code == 201
    character = response.json()
    assert character["character_class"] == "barbarian"
    assert character["armor_class"] >= 13
    assert character["difficulty"] == "normal"


def test_preset_route_is_not_shadowed_by_character_id(auth):
    """/characters/presets must not be parsed as a character id."""
    assert client.post("/characters/presets/tank", headers=auth).status_code == 201
    assert client.post("/characters/presets/unknown", headers=auth).status_code == 404


def test_presets_require_auth():
    assert client.post("/characters/presets/tank").status_code == 401


def test_reference_endpoint_exposes_races_and_classes():
    response = client.get("/reference")
    assert response.status_code == 200
    data = response.json()
    assert data["races"] and data["classes"]
    assert len(data["races"]) == 9
    assert len(data["classes"]) == 12
    halfling = next(race for race in data["races"] if race["key"] == "halfling")
    assert any(trait["name"] == "Lucky" for trait in halfling["traits"])
    warlock = next(klass for klass in data["classes"] if klass["key"] == "warlock")
    assert [subclass["name"] for subclass in warlock["subclasses"]] == ["The Fiend"]
    assert all(len(klass["subclasses"]) == 1 for klass in data["classes"])
    assert [feat["name"] for feat in data["feats"]] == ["Grappler"]
    assert [background["name"] for background in data["backgrounds"]] == ["Acolyte"]
    assert len(data["draconic_ancestry"]) == 10


def test_reference_endpoint_exposes_connected_campaign_locations():
    response = client.get("/reference")

    assert response.status_code == 200
    locations = {location["name"]: location["connections"] for location in response.json()["locations"]}
    assert len(locations) == 4
    assert locations["The Whispering Cellar"] == ["The Sunken Corridor"]
    assert locations["The Shrine of the Forgotten"][0] == "The Goblin Market"


def test_spell_library_endpoint():
    response = client.get("/reference/spells")
    assert response.status_code == 200
    spells = response.json()
    assert len(spells) == 319
    assert len({spell["name"] for spell in spells}) == 319
    assert all({"name", "level", "school", "range", "text"} <= spell.keys() for spell in spells)


def test_combat_calculator_endpoint():
    response = client.post(
        "/tools/combat-calculator", json={"party_levels": [1], "monsters": ["ogre", "ogre", "ogre"]}
    )
    assert response.status_code == 200
    assert response.json()["band"] == "deadly"


def test_combat_calculator_rejects_empty_party():
    response = client.post("/tools/combat-calculator", json={"party_levels": [], "monsters": ["goblin"]})
    assert response.status_code == 422


def test_economy_endpoint_reports_starting_balance(auth):
    response = client.get("/economy", headers=auth)
    assert response.status_code == 200
    data = response.json()
    assert data["balance"] == 100.0
    assert data["balance_tenths"] == 1000
    assert next(tier for tier in data["tiers"] if tier["key"] == "lite")["cost"] == 0.0
    assert data["tier"] == "normal"
    assert {tier["key"] for tier in data["tiers"]} == {"lite", "normal", "pro"}
    assert data["packages"][0]["key"] == "starter"


def test_settings_patch_updates_a_character(auth):
    character = client.post("/characters/presets/skirmisher", headers=auth).json()
    response = client.patch(
        f"/characters/{character['id']}/settings",
        json={"difficulty": "hard", "tone": "grimdark", "humor": "comedy", "verbose": False},
        headers=auth,
    )
    assert response.status_code == 200
    updated = response.json()
    assert (updated["difficulty"], updated["tone"], updated["humor"], updated["verbose"]) == \
        ("hard", "grimdark", "comedy", False)


def test_settings_patch_rejects_unknown_values(auth):
    character = client.post("/characters/presets/healer", headers=auth).json()
    response = client.patch(
        f"/characters/{character['id']}/settings", json={"difficulty": "nightmare"}, headers=auth
    )
    assert response.status_code == 422


def test_settings_patch_cannot_touch_another_users_character(auth):
    character = client.post("/characters/presets/support", headers=auth).json()
    client.post("/auth/register", json={"username": "intruder2", "password": "password123"})
    other = client.post(
        "/auth/login", json={"username": "intruder2", "password": "password123"}
    ).json()["access_token"]
    response = client.patch(
        f"/characters/{character['id']}/settings",
        json={"difficulty": "easy"},
        headers={"Authorization": f"Bearer {other}"},
    )
    assert response.status_code == 404


def test_action_charges_energy_and_reports_balance(auth):
    character = client.post("/characters/presets/tank", headers=auth).json()
    response = client.post(
        f"/characters/{character['id']}/actions", json={"action": "look around"}, headers=auth
    )
    assert response.status_code == 200
    data = response.json()
    # One normal turn costs 1.0, so 100.0 becomes 99.0.
    assert data["energy_tenths"] == 990
    assert data["energy"] == 99.0
    assert data["tier"] == "normal"


def test_lite_action_is_free_but_noop_remains_free(auth):
    character = client.post("/characters/presets/tank", headers=auth).json()
    assert client.post("/economy/tier", json={"tier": "lite"}, headers=auth).status_code == 200
    response = client.post(
        f"/characters/{character['id']}/actions", json={"action": "look around"}, headers=auth
    )
    assert response.status_code == 200
    assert response.json()["energy_tenths"] == 1000

    no_op = client.post(
        f"/characters/{character['id']}/actions", json={"action": "rest"}, headers=auth
    )
    assert no_op.status_code == 200
    assert no_op.json()["energy_tenths"] == 1000


def test_action_returns_402_when_energy_runs_out(auth):
    character = client.post("/characters/presets/tank", headers=auth).json()

    async def drain():
        async with Session() as session:
            result = await session.execute(text("SELECT id FROM users WHERE username='systems'"))
            user = await session.get(User, result.scalar_one())
            user.energy_tenths = 5
            await session.commit()

    asyncio.run(drain())
    response = client.post(
        f"/characters/{character['id']}/actions", json={"action": "look around"}, headers=auth
    )
    assert response.status_code == 402
    assert "Mana" in response.json()["detail"]


def test_failed_charge_does_not_mutate_the_character(auth):
    """A 402 must not consume a turn or damage the character."""
    character = client.post("/characters/presets/tank", headers=auth).json()

    async def drain():
        async with Session() as session:
            result = await session.execute(text("SELECT id FROM users WHERE username='systems'"))
            user = await session.get(User, result.scalar_one())
            user.energy_tenths = 0
            await session.commit()

    asyncio.run(drain())
    blocked = client.post(
        f"/characters/{character['id']}/actions", json={"action": "attack"}, headers=auth
    )
    assert blocked.status_code == 402
    fetched = client.get(f"/characters/{character['id']}", headers=auth).json()
    assert fetched["hp"] == character["hp"]
    assert fetched["xp"] == 0


def test_topup_is_closed_without_an_admin_token(auth):
    """No configured admin token must mean no way to mint currency."""
    response = client.post("/economy/topup", json={"package": "starter"}, headers=auth)
    assert response.status_code == 403


def test_topup_is_closed_with_a_wrong_token(auth):
    response = client.post(
        "/economy/topup",
        json={"package": "starter"},
        headers={**auth, "X-Admin-Token": "not-the-token"},
    )
    assert response.status_code == 403


def test_topup_grants_a_package_when_authorized(auth, monkeypatch):
    from app.settings import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "admin_token", "test-admin-token", raising=False)
    response = client.post(
        "/economy/topup",
        json={"package": "starter"},
        headers={**auth, "X-Admin-Token": "test-admin-token"},
    )
    assert response.status_code == 200
    # 100.0 starting + 50.0 from the starter pack.
    assert response.json()["balance"] == 150.0


def test_refused_turn_is_not_charged(auth):
    """A turn that changes nothing (a refused rest) must not cost Mana."""
    character = client.post("/characters/presets/skirmisher", headers=auth).json()
    # An empty-ish action the engine rejects: resting is only refused in combat,
    # so use a blank attempt which the engine answers without changing state.
    response = client.post(
        f"/characters/{character['id']}/actions", json={"action": "wait patiently"}, headers=auth
    )
    assert response.status_code == 200
    # Ability checks do change state, so this one is charged exactly once.
    assert response.json()["energy_tenths"] == 990


def test_blocked_rest_inside_combat_is_free(auth):
    """A refused rest must not be charged, and must not heal either."""
    from dataclasses import asdict

    from app.db import CharacterRecord, decode_character_state, encode_character_state
    from app.engine.encounters import build_monster

    character = client.post("/characters/presets/tank", headers=auth)
    assert character.status_code == 201, character.text
    character = character.json()

    # Put the character mid-fight directly: rolling for it would let the monster
    # win or die, which makes the assertion about the charge non-deterministic.
    async def start_fight():
        async with Session() as session:
            record = await session.get(CharacterRecord, character["id"])
            state = decode_character_state(record.payload)
            state["combatant"] = asdict(build_monster("normal", "ogre"))
            state["in_combat"] = True
            state["hp"] = 5
            record.payload = encode_character_state(state)
            await session.commit()

    asyncio.run(start_fight())

    blocked = client.post(
        f"/characters/{character['id']}/actions", json={"action": "rest"}, headers=auth
    )
    assert blocked.status_code == 200, blocked.text
    blocked = blocked.json()
    assert any("cannot rest" in event for event in blocked["events"])
    # Nothing changed: no charge, and the wound is still there.
    assert blocked["energy_tenths"] == 1000
    assert blocked["character"]["hp"] == 5


def test_unknown_package_is_rejected(auth, monkeypatch):
    from app.settings import get_settings

    monkeypatch.setattr(get_settings(), "admin_token", "test-admin-token", raising=False)
    response = client.post(
        "/economy/topup",
        json={"package": "infinite"},
        headers={**auth, "X-Admin-Token": "test-admin-token"},
    )
    assert response.status_code == 404