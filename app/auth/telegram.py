"""Telegram Mini App identity verification.

The Mini App proves who the player is by sending `initData` — a query string
Telegram signed with our bot token. Verifying it is the whole point of this
module: without it, anyone can POST a made-up username to `/auth/register` and
play as somebody else.

Algorithm (per Telegram's documented WebApp `validateWebAppData`):
    secret_key = HMAC_SHA256(key=b"WebAppData", msg=bot_token)
    check_hash = HMAC_SHA256(key=secret_key, msg=data_check_string)
where `data_check_string` is every field except `hash`, sorted by key and joined
as `key=value` with newlines.

This module is deliberately pure: no FastAPI, no database. It is easy to test and
impossible to accidentally bypass from a route.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from urllib.parse import parse_qsl

# Telegram's own guidance is "a day"; we are stricter because a stale initData is
# only useful for replaying a session that is almost certainly over.
DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60


class InitDataError(ValueError):
    """Raised when initData is malformed, forged, or too old."""


@dataclass(frozen=True)
class TelegramUser:
    id: int
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    language_code: str | None = None

    @property
    def display_name(self) -> str:
        """A stable, human-readable handle usable as a local username."""
        for candidate in (self.username, self.first_name, f"player_{self.id}"):
            if candidate:
                return candidate[:32]
        return f"player_{self.id}"


def _secret_key(bot_token: str) -> bytes:
    return hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()


def expected_hash(fields: dict[str, str], bot_token: str) -> str:
    """Compute the hash Telegram would have signed for these fields."""
    check_string = "\n".join(f"{key}={fields[key]}" for key in sorted(fields) if key != "hash")
    return hmac.new(_secret_key(bot_token), check_string.encode(), hashlib.sha256).hexdigest()


def verify_init_data(
    init_data: str,
    bot_token: str,
    *,
    now: float | None = None,
    max_age_seconds: int = DEFAULT_MAX_AGE_SECONDS,
) -> TelegramUser:
    """Verify a Mini App `initData` string and return the authenticated user.

    Raises `InitDataError` for anything untrusted. Never returns a partially
    verified user: if this function returns, the signature was correct.
    """
    if not bot_token:
        # Failing closed is essential: with no token configured we cannot verify
        # anything, so we must not pretend the caller is authenticated.
        raise InitDataError("Telegram bot token is not configured")
    if not init_data or not init_data.strip():
        raise InitDataError("initData is empty")

    # keep_blank_values matters: Telegram can send empty optional fields.
    pairs = parse_qsl(init_data, keep_blank_values=True, strict_parsing=False)
    fields = dict(pairs)
    if len(fields) != len(pairs):
        raise InitDataError("initData contains duplicate fields")

    received = fields.pop("hash", None)
    if not received:
        raise InitDataError("initData is missing the hash field")

    if not hmac.compare_digest(expected_hash(fields, bot_token), received.lower()):
        raise InitDataError("initData signature is invalid")

    # Signature is good; now the payload must also be fresh and usable.
    timestamp = fields.get("auth_date")
    if timestamp is None:
        raise InitDataError("initData is missing auth_date")
    try:
        signed_at = int(timestamp)
    except ValueError as error:
        raise InitDataError("auth_date is not a number") from error

    current = time.time() if now is None else now
    if signed_at > current + 60:
        # A clock skew of a minute is tolerable; a future date is not.
        raise InitDataError("auth_date is in the future")
    if current - signed_at > max_age_seconds:
        raise InitDataError("initData has expired")

    raw_user = fields.get("user")
    if not raw_user:
        raise InitDataError("initData has no user payload")
    try:
        payload = json.loads(raw_user)
    except json.JSONDecodeError as error:
        raise InitDataError("user payload is not valid JSON") from error
    if not isinstance(payload, dict):
        raise InitDataError("user payload is not an object")

    user_id = payload.get("id")
    if not isinstance(user_id, int) or user_id <= 0:
        raise InitDataError("user payload has no valid id")

    return TelegramUser(
        id=user_id,
        username=payload.get("username"),
        first_name=payload.get("first_name"),
        last_name=payload.get("last_name"),
        language_code=payload.get("language_code"),
    )


def build_init_data(
    fields: dict[str, str],
    bot_token: str,
    *,
    auth_date: int | None = None,
) -> str:
    """Produce a signed initData string. Used by tests and local tooling only."""
    data = {key: str(value) for key, value in fields.items() if key != "hash"}
    data["auth_date"] = str(auth_date if auth_date is not None else int(time.time()))
    signature = expected_hash(data, bot_token)
    parts = [f"{key}={data[key]}" for key in data]
    parts.append(f"hash={signature}")
    return "&".join(parts)