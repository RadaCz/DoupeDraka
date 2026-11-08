import pytest
import asyncio
from fastapi.testclient import TestClient
from app.api import app
from app.db import (
    CharacterRecord,
    Session,
    decode_character_state,
    encode_character_state,
    init_db,
)
from sqlalchemy import text

client = TestClient(app)


@pytest.fixture
def setup_db():
    """Initialize database for tests."""
    asyncio.run(init_db())
    yield
    # Cleanup: drop all tables after tests
    async def cleanup():
        async with Session() as session:
            await session.execute(text("DELETE FROM energy_transactions"))
            await session.execute(text("DELETE FROM api_keys"))
            await session.execute(text("DELETE FROM characters"))
            await session.execute(text("DELETE FROM events"))
            await session.execute(text("DELETE FROM users"))
            await session.commit()
    asyncio.run(cleanup())


def test_health_check(setup_db):
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_full_character_flow(setup_db):
    """Test complete character creation and action flow."""
    # Register and login
    client.post("/auth/register", json={"username": "flowuser", "password": "password123"})
    login = client.post("/auth/login", json={"username": "flowuser", "password": "password123"})
    token = login.json()["access_token"]
    
    # Create character
    create = client.post(
        "/characters",
        json={"name": "TestHero", "race": "human", "character_class": "fighter"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert create.status_code == 201
    char = create.json()
    assert char["name"] == "TestHero"
    
    # Get character
    get = client.get(
        f"/characters/{char['id']}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert get.status_code == 200
    
    # Perform action
    action = client.post(
        f"/characters/{char['id']}/actions",
        json={"action": "attack goblin"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert action.status_code == 200
    assert "events" in action.json()
    assert "narration" in action.json()

def test_character_payload_has_schema_version(setup_db):
    client.post("/auth/register", json={"username": "schemauser", "password": "password123"})
    token = client.post(
        "/auth/login", json={"username": "schemauser", "password": "password123"}
    ).json()["access_token"]
    created = client.post(
        "/characters",
        json={"name": "VersionedHero", "race": "human", "character_class": "fighter"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    async def read_payload():
        async with Session() as session:
            record = await session.get(CharacterRecord, created["id"])
            return record.payload

    payload = asyncio.run(read_payload())
    assert '"schema_version": 1' in payload
    assert decode_character_state(payload)["name"] == "VersionedHero"

def test_list_characters_is_scoped_to_authenticated_user(setup_db):
    client.post("/auth/register", json={"username": "listowner", "password": "password123"})
    owner_token = client.post(
        "/auth/login", json={"username": "listowner", "password": "password123"}
    ).json()["access_token"]
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    first = client.post(
        "/characters",
        json={"name": "FirstHero", "race": "human", "character_class": "fighter"},
        headers=owner_headers,
    ).json()
    second = client.post(
        "/characters",
        json={"name": "SecondHero", "race": "elf", "character_class": "wizard"},
        headers=owner_headers,
    ).json()
    listed = client.get("/characters", headers=owner_headers)
    assert listed.status_code == 200
    assert {character["id"] for character in listed.json()} == {first["id"], second["id"]}

    client.post("/auth/register", json={"username": "listother", "password": "password123"})
    other_token = client.post(
        "/auth/login", json={"username": "listother", "password": "password123"}
    ).json()["access_token"]
    other_list = client.get(
        "/characters", headers={"Authorization": f"Bearer {other_token}"}
    )
    assert other_list.status_code == 200
    assert other_list.json() == []

    assert client.get("/characters").status_code == 401


def test_character_journal_is_owned_ordered_and_bounded(setup_db):
    client.post("/auth/register", json={"username": "journalowner", "password": "password123"})
    owner_token = client.post(
        "/auth/login", json={"username": "journalowner", "password": "password123"}
    ).json()["access_token"]
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    character = client.post(
        "/characters",
        json={"name": "JournalHero", "race": "human", "character_class": "fighter"},
        headers=owner_headers,
    ).json()

    for action_text in ("inspect the old door", "inspect again", "inspect the door"):
        response = client.post(
            f"/characters/{character['id']}/actions",
            json={"action": action_text},
            headers=owner_headers,
        )
        assert response.status_code == 200

    events = client.get(
        f"/characters/{character['id']}/events?limit=2", headers=owner_headers
    )
    assert events.status_code == 200
    assert [event["action"] for event in events.json()] == ["inspect again", "inspect the door"]
    assert all({"id", "action", "result", "created_at"} <= event.keys() for event in events.json())
    assert "Intelligence check:" in events.json()[0]["result"]
    assert client.get(f"/characters/{character['id']}/events?limit=0", headers=owner_headers).status_code == 422

    client.post("/auth/register", json={"username": "journalother", "password": "password123"})
    other_token = client.post(
        "/auth/login", json={"username": "journalother", "password": "password123"}
    ).json()["access_token"]
    hidden = client.get(
        f"/characters/{character['id']}/events",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert hidden.status_code == 404


def test_missing_token(setup_db):
    """Test that missing token returns 401."""
    response = client.post(
        "/characters",
        json={"name": "Test", "race": "human", "character_class": "fighter"}
    )
    assert response.status_code == 401


def test_other_users_character_is_not_reachable(setup_db):
    """Test that a character belonging to another user cannot be read or acted on."""
    # Owner creates a character
    client.post("/auth/register", json={"username": "owner1", "password": "password123"})
    owner_token = client.post(
        "/auth/login", json={"username": "owner1", "password": "password123"}
    ).json()["access_token"]
    create = client.post(
        "/characters",
        json={"name": "OwnerHero", "race": "human", "character_class": "fighter"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    char_id = create.json()["id"]

    # Second user must not read or act on it
    client.post("/auth/register", json={"username": "intruder1", "password": "password123"})
    intruder_token = client.post(
        "/auth/login", json={"username": "intruder1", "password": "password123"}
    ).json()["access_token"]
    intruder_headers = {"Authorization": f"Bearer {intruder_token}"}

    read = client.get(f"/characters/{char_id}", headers=intruder_headers)
    assert read.status_code == 404

    action = client.post(
        f"/characters/{char_id}/actions",
        json={"action": "attack"},
        headers=intruder_headers,
    )
    assert action.status_code == 404


def test_dead_character_cannot_act(setup_db):
    """Test that a fallen character is rejected with 409."""
    # Register, login, create character
    client.post("/auth/register", json={"username": "deaduser", "password": "password123"})
    token = client.post(
        "/auth/login", json={"username": "deaduser", "password": "password123"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    create = client.post(
        "/characters",
        json={"name": "Doomed", "race": "human", "character_class": "fighter"},
        headers=headers,
    )
    char_id = create.json()["id"]

    # Force the stored character to 0 HP
    async def set_zero_hp():
        async with Session() as session:
            record = await session.get(CharacterRecord, char_id)
            state = decode_character_state(record.payload)
            state["hp"] = 0
            record.payload = encode_character_state(state)
            await session.commit()

    asyncio.run(set_zero_hp())

    response = client.post(
        f"/characters/{char_id}/actions", json={"action": "attack"}, headers=headers
    )
    assert response.status_code == 409


def test_empty_action(setup_db):
    """Test that empty action is rejected."""
    # Register and login
    client.post("/auth/register", json={"username": "emptyuser", "password": "password123"})
    login = client.post("/auth/login", json={"username": "emptyuser", "password": "password123"})
    token = login.json()["access_token"]
    
    # Create character first
    create = client.post(
        "/characters",
        json={"name": "EmptyChar", "race": "human", "character_class": "fighter"},
        headers={"Authorization": f"Bearer {token}"}
    )
    char_id = create.json()["id"]
    
    # Try empty action
    response = client.post(
        f"/characters/{char_id}/actions",
        json={"action": "   "},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 400


def test_e2e_fallen_hook_is_hidden_in_normal_runs(setup_db):
    client.post("/auth/register", json={"username": "e2ehook", "password": "password123"})
    token = client.post(
        "/auth/login", json={"username": "e2ehook", "password": "password123"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    char_id = client.post(
        "/characters",
        json={"name": "Hook", "race": "human", "character_class": "fighter"},
        headers=headers,
    ).json()["id"]
    assert client.post(f"/characters/{char_id}/__e2e/fallen", headers=headers).status_code == 404


def test_e2e_fallen_hook_sets_hp_and_revive_works(setup_db, monkeypatch):
    from app import api as api_module

    client.post("/auth/register", json={"username": "e2erev", "password": "password123"})
    token = client.post(
        "/auth/login", json={"username": "e2erev", "password": "password123"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    char_id = client.post(
        "/characters",
        json={"name": "Rev", "race": "human", "character_class": "fighter"},
        headers=headers,
    ).json()["id"]

    async def give_gold():
        async with Session() as session:
            record = await session.get(CharacterRecord, char_id)
            state = decode_character_state(record.payload)
            state["gold"] = 12
            record.payload = encode_character_state(state)
            await session.commit()

    asyncio.run(give_gold())
    monkeypatch.setattr(api_module, "e2e_hooks_enabled", lambda: True)
    fallen = client.post(f"/characters/{char_id}/__e2e/fallen", headers=headers)
    assert fallen.status_code == 200
    assert fallen.json()["character"]["hp"] == 0
    revived = client.post(f"/characters/{char_id}/revive", headers=headers)
    assert revived.status_code == 200
    body = revived.json()
    assert body["character"]["hp"] == 1
    assert body["gold_lost"] >= 1
