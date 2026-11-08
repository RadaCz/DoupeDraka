import pytest
import asyncio
import time
from fastapi.testclient import TestClient
from app.api import app
from app.db import Session, User, ApiKey, init_db
from sqlalchemy import text
import hashlib

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


def test_register_user(setup_db):
    """Test successful user registration."""
    response = client.post(
        "/auth/register",
        json={"username": "testuser", "password": "password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "testuser"
    assert "id" in data


def test_register_duplicate_username(setup_db):
    """Test registration fails for existing username."""
    client.post("/auth/register", json={"username": "dupuser", "password": "password123"})
    time.sleep(0.1)  # Small delay to avoid rate limiting
    response = client.post(
        "/auth/register",
        json={"username": "dupuser", "password": "differentpass"}
    )
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


def test_login_success(setup_db):
    """Test successful login returns token."""
    client.post("/auth/register", json={"username": "loginuser", "password": "password123"})
    response = client.post(
        "/auth/login",
        json={"username": "loginuser", "password": "password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert len(data["access_token"]) >= 32


def test_login_invalid_credentials(setup_db):
    """Test login fails with wrong password."""
    client.post("/auth/register", json={"username": "failuser", "password": "password123"})
    response = client.post(
        "/auth/login",
        json={"username": "failuser", "password": "wrongpassword"}
    )
    assert response.status_code == 401
    assert "Invalid credentials" in response.json()["detail"]


def test_api_token_hashing(setup_db):
    """Test that API tokens are hashed in database."""
    
    # Login to get token
    client.post("/auth/register", json={"username": "hashuser", "password": "password123"})
    login_response = client.post(
        "/auth/login",
        json={"username": "hashuser", "password": "password123"}
    )
    token = login_response.json()["access_token"]
    
    # Check database for hashed token
    async def check_hash():
        async with Session() as session:
            result = await session.execute(text("SELECT token_hash FROM api_keys"))
            token_hash = result.scalar_one()
            expected_hash = hashlib.sha256(token.encode()).hexdigest()
            return token_hash == expected_hash
    
    is_hashed = asyncio.run(check_hash())
    assert is_hashed, "API token should be hashed in database"


def test_protected_endpoint_with_token(setup_db):
    """Test protected endpoint accepts valid token."""
    # Register and login
    client.post("/auth/register", json={"username": "protuser", "password": "password123"})
    login_response = client.post(
        "/auth/login",
        json={"username": "protuser", "password": "password123"}
    )
    token = login_response.json()["access_token"]
    
    # Try to create character with token
    response = client.post(
        "/characters",
        json={"name": "TestChar", "race": "human", "character_class": "fighter"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 201
    assert response.json()["name"] == "TestChar"


def test_protected_endpoint_without_token(setup_db):
    """Test protected endpoint rejects request without token."""
    response = client.post(
        "/characters",
        json={"name": "TestChar", "race": "human", "character_class": "fighter"}
    )
    assert response.status_code == 401
