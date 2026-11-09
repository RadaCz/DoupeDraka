"""Telegram initData verification — the project's only trusted identity source."""
import asyncio
import json
import time
from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import func, select

from app.auth.telegram import (
    DEFAULT_MAX_AGE_SECONDS,
    InitDataError,
    build_init_data,
    expected_hash,
    verify_init_data,
)
from app.api import app, limiter
from fastapi.testclient import TestClient
from app.settings import Settings

BOT_TOKEN = "123456:TEST-TOKEN-not-a-real-secret"
client = TestClient(app)


def make_init_data(user_id: int = 42, username: str = "valenok", auth_date: int | None = None, **extra):
    payload = {"id": user_id, "username": username, "first_name": "Val", "language_code": "ru"}
    payload.update(extra.pop("user", {}))
    fields = {"user": json.dumps(payload), "query_id": "AAF", **extra}
    return build_init_data(fields, BOT_TOKEN, auth_date=auth_date)


# --------------------------------------------------------------------------
# Happy path
# --------------------------------------------------------------------------

def test_valid_init_data_returns_the_user():
    user = verify_init_data(make_init_data(77, "grath"), BOT_TOKEN)
    assert user.id == 77
    assert user.username == "grath"
    assert user.display_name == "grath"


def test_display_name_falls_back_through_username_first_name_id():
    assert verify_init_data(make_init_data(username=""), BOT_TOKEN).display_name == "Val"
    no_name = json.dumps({"id": 99})
    data = build_init_data({"user": no_name}, BOT_TOKEN)
    assert verify_init_data(data, BOT_TOKEN).display_name == "player_99"


def test_extra_fields_are_signed_and_tolerated():
    """Telegram sends more than user/auth_date; extra signed fields must not break it."""
    data = make_init_data(extra={"chat_type": "private", "chat_instance": "abc"})
    assert verify_init_data(data, BOT_TOKEN).id == 42


def test_empty_optional_fields_survive():
    payload = {"id": 5, "username": ""}
    data = build_init_data({"user": json.dumps(payload), "query_id": ""}, BOT_TOKEN)
    assert verify_init_data(data, BOT_TOKEN).id == 5


# --------------------------------------------------------------------------
# Forgery — the reason this module exists
# --------------------------------------------------------------------------

def test_tampered_user_id_is_rejected():
    """The core attack: swap in someone else's id without re-signing."""
    data = make_init_data(42, "victim")
    forged = data.replace('"id": 42', '"id": 1')
    assert forged != data and '"id": 1' in forged
    with pytest.raises(InitDataError, match="signature"):
        verify_init_data(forged, BOT_TOKEN)


def test_wrong_bot_token_is_rejected():
    with pytest.raises(InitDataError, match="signature"):
        verify_init_data(make_init_data(), "999:OTHER-TOKEN")


def test_missing_hash_is_rejected():
    data = "&".join(part for part in make_init_data().split("&") if not part.startswith("hash="))
    with pytest.raises(InitDataError, match="hash"):
        verify_init_data(data, BOT_TOKEN)


def test_empty_hash_is_rejected():
    data = "&".join(part for part in make_init_data().split("&") if not part.startswith("hash="))
    with pytest.raises(InitDataError, match="hash"):
        verify_init_data(data, BOT_TOKEN)


def test_unsigned_user_field_is_rejected():
    """Appending an unsigned `user` must not let an attacker inject an identity.

    The duplicate-field guard catches this before the signature check, which is
    the stronger outcome: the payload is rejected either way.
    """
    data = make_init_data(42, "victim")
    with pytest.raises(InitDataError, match="duplicate|signature"):
        verify_init_data(data + "&user=" + json.dumps({"id": 1, "username": "attacker"}), BOT_TOKEN)


def test_duplicate_fields_are_rejected():
    data = make_init_data()
    with pytest.raises(InitDataError, match="duplicate"):
        verify_init_data(f"{data}&user=%7B%22id%22%3A+1%7D", BOT_TOKEN)


def test_unconfigured_bot_token_fails_closed():
    """No token means no verification, so nothing may be trusted."""
    with pytest.raises(InitDataError, match="not configured"):
        verify_init_data(make_init_data(), "")


def test_empty_init_data_is_rejected():
    with pytest.raises(InitDataError, match="empty"):
        verify_init_data("   ", BOT_TOKEN)


# --------------------------------------------------------------------------
# Freshness
# --------------------------------------------------------------------------

def test_expired_init_data_is_rejected():
    old = int(time.time()) - DEFAULT_MAX_AGE_SECONDS - 10
    with pytest.raises(InitDataError, match="expired"):
        verify_init_data(make_init_data(auth_date=old), BOT_TOKEN)


def test_replay_just_inside_the_window_is_accepted():
    fresh = int(time.time()) - DEFAULT_MAX_AGE_SECONDS + 30
    assert verify_init_data(make_init_data(auth_date=fresh), BOT_TOKEN).id == 42


def test_future_auth_date_is_rejected():
    future = int(time.time()) + 600
    with pytest.raises(InitDataError, match="future"):
        verify_init_data(make_init_data(auth_date=future), BOT_TOKEN)


def test_small_clock_skew_is_tolerated():
    skewed = int(time.time()) + 30
    assert verify_init_data(make_init_data(auth_date=skewed), BOT_TOKEN).id == 42


def test_missing_auth_date_is_rejected():
    signature = expected_hash({"user": json.dumps({"id": 1})}, BOT_TOKEN)
    with pytest.raises(InitDataError, match="auth_date"):
        verify_init_data(f"user=%7B%22id%22%3A+1%7D&hash={signature}", BOT_TOKEN)


# --------------------------------------------------------------------------
# Malformed payloads must raise InitDataError, never crash
# --------------------------------------------------------------------------

def test_missing_user_payload_is_rejected():
    data = build_init_data({"query_id": "x"}, BOT_TOKEN)
    with pytest.raises(InitDataError, match="user payload"):
        verify_init_data(data, BOT_TOKEN)


def test_non_json_user_payload_is_rejected():
    data = build_init_data({"user": "not-json"}, BOT_TOKEN)
    with pytest.raises(InitDataError, match="not valid JSON"):
        verify_init_data(data, BOT_TOKEN)


def test_non_object_user_payload_is_rejected():
    data = build_init_data({"user": "[1,2]"}, BOT_TOKEN)
    with pytest.raises(InitDataError, match="not an object"):
        verify_init_data(data, BOT_TOKEN)


@pytest.mark.parametrize("bad_id", ["0", "-3", '"42"', "null"])
def test_invalid_user_id_is_rejected(bad_id):
    data = build_init_data({"user": f'{{"id": {bad_id}}}'}, BOT_TOKEN)
    with pytest.raises(InitDataError, match="valid id"):
        verify_init_data(data, BOT_TOKEN)


def test_expected_hash_is_stable_and_hex():
    fields = {"user": '{"id": 1}', "auth_date": "1700000000"}
    digest = expected_hash(fields, BOT_TOKEN)
    assert digest == expected_hash(fields, BOT_TOKEN)
    assert digest == digest.lower()
    assert len(digest) == 64 and all(character in "0123456789abcdef" for character in digest)


def test_expected_hash_ignores_the_hash_field():
    fields = {"user": '{"id": 1}', "auth_date": "1700000000"}
    assert expected_hash(fields, BOT_TOKEN) == expected_hash({**fields, "hash": "whatever"}, BOT_TOKEN)


def test_telegram_auth_is_rate_limited():
    limiter.reset()
    responses = [
        client.post("/auth/telegram", json={"init_data": "invalid"})
        for _ in range(10)
    ]
    assert all(response.status_code == 401 for response in responses)

    limited = client.post("/auth/telegram", json={"init_data": "invalid"})
    assert limited.status_code == 429


def test_cors_requires_explicit_origins():
    settings = Settings(_env_file=None, cors_origins="https://mini.example")
    assert settings.origins == ["https://mini.example"]

    with pytest.raises(ValueError, match="explicit HTTP\\(S\\) origins"):
        Settings(_env_file=None, cors_origins="*")
    with pytest.raises(ValueError, match="explicit HTTP\\(S\\) origins"):
        Settings(_env_file=None, cors_origins="https://mini.example/game")


def test_cors_preflight_allows_only_configured_development_origin():
    allowed_origin = "http://localhost:5173"
    response = client.options(
        "/auth/telegram",
        headers={
            "Origin": allowed_origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == allowed_origin

    rejected = client.options(
        "/auth/telegram",
        headers={
            "Origin": "https://not-the-mini-app.example",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert rejected.status_code == 400


@pytest.fixture
def telegram_bot_token(monkeypatch):
    """Make /auth/telegram accept signed initData in tests."""
    from app.settings import get_settings

    monkeypatch.setenv("BOT_TOKEN", BOT_TOKEN)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_telegram_login_creates_user_and_token(telegram_bot_token):
    init_data = make_init_data(501_001, "login_once")
    response = client.post("/auth/telegram", json={"init_data": init_data})
    assert response.status_code == 200
    assert response.json()["access_token"]


def test_concurrent_telegram_login_same_new_user(telegram_bot_token):
    """React StrictMode can fire parallel /auth/telegram calls for the same initData."""
    init_data = make_init_data(501_002, "race_create")
    with ThreadPoolExecutor(max_workers=8) as pool:
        responses = list(pool.map(
            lambda _: client.post("/auth/telegram", json={"init_data": init_data}),
            range(8),
        ))
    assert all(item.status_code == 200 for item in responses), [item.text for item in responses if item.status_code != 200]

    async def one_telegram_account():
        from app.db import ApiKey, Session, User

        async with Session() as session:
            user = await session.scalar(select(User).where(User.telegram_id == 501_002))
            key_count = await session.scalar(
                select(func.count()).select_from(ApiKey).where(ApiKey.user_id == user.id)
            )
            return user, key_count

    user, key_count = asyncio.run(one_telegram_account())
    assert user is not None
    assert key_count == 5


def test_repeated_telegram_login_prunes_api_keys(telegram_bot_token):
    init_data = make_init_data(501_003, "repeat_login")
    for _ in range(9):
        assert client.post("/auth/telegram", json={"init_data": init_data}).status_code == 200

    async def keys_left():
        from app.db import ApiKey, Session, User

        async with Session() as session:
            user = await session.scalar(select(User).where(User.telegram_id == 501_003))
            return await session.scalar(
                select(func.count()).select_from(ApiKey).where(ApiKey.user_id == user.id)
            )

    assert asyncio.run(keys_left()) == 5


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_concurrent_telegram_login_existing_user(telegram_bot_token):
    init_data = make_init_data(501_004, "existing_user")
    bootstrap = client.post("/auth/telegram", json={"init_data": init_data})
    assert bootstrap.status_code == 200

    with ThreadPoolExecutor(max_workers=8) as pool:
        responses = list(pool.map(
            lambda _: client.post("/auth/telegram", json={"init_data": init_data}),
            range(8),
        ))
    assert all(item.status_code == 200 for item in responses), [item.text for item in responses if item.status_code != 200]

    tokens = [bootstrap.json()["access_token"], *[item.json()["access_token"] for item in responses]]
    working = [
        token for token in tokens
        if client.get("/characters", headers=_auth_headers(token)).status_code == 200
    ]
    assert len(working) == 5


def test_user_creation_race_both_tokens_authorize(telegram_bot_token):
    """Concurrent first logins exercise IntegrityError recovery; both tokens must work."""
    init_data = make_init_data(501_005, "integrity_recovery")
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(
            lambda _: client.post("/auth/telegram", json={"init_data": init_data}),
            range(2),
        ))
    assert all(item.status_code == 200 for item in responses)
    for item in responses:
        token = item.json()["access_token"]
        assert client.get("/characters", headers=_auth_headers(token)).status_code == 200


def test_get_or_create_existing_user_mints_working_api_key(telegram_bot_token):
    """Rollback-safe path: existing telegram row → ApiKey commit → bearer works."""
    import secrets

    from app.api import get_or_create_telegram_user, hash_token, prune_api_keys
    from app.db import ApiKey, Session

    init_data = make_init_data(501_007, "api_key_path")
    tg_user = verify_init_data(init_data, BOT_TOKEN)

    async def mint_token() -> str:
        async with Session() as session:
            user = await get_or_create_telegram_user(session, tg_user)
            token = secrets.token_urlsafe(32)
            session.add(ApiKey(token_hash=hash_token(token), user_id=user.id))
            await prune_api_keys(session, user.id)
            await session.commit()
            return token

    token = asyncio.run(mint_token())
    assert client.get("/characters", headers=_auth_headers(token)).status_code == 200


def test_pruned_api_key_returns_401(telegram_bot_token):
    init_data = make_init_data(501_006, "prune401")
    tokens: list[str] = []
    for _ in range(6):
        response = client.post("/auth/telegram", json={"init_data": init_data})
        assert response.status_code == 200
        tokens.append(response.json()["access_token"])

    assert client.get("/characters", headers=_auth_headers(tokens[0])).status_code == 401
    assert client.get("/characters", headers=_auth_headers(tokens[-1])).status_code == 200