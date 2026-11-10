#!/usr/bin/env python3
"""Validate staging env files before deploy (names and policy only — never print secrets)."""

from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]

PLACEHOLDER_MARKERS = (
    "your_telegram_bot_token_here",
    "your_api_token_for_bot_auth",
    "change-me",
    "your-mini-app.example",
    "your_openrouter",
)

REQUIRED_STAGING_KEYS = (
    "DATABASE_URL",
    "BOT_TOKEN",
    "BOT_API_TOKEN",
    "MINI_APP_URL",
    "CORS_ORIGINS",
    "DB_BOOTSTRAP",
    "LLM_PROVIDER",
)

OPTIONAL_KEYS = (
    "ADMIN_API_KEY",
    "VITE_TELEGRAM_BOT_USERNAME",
    "VITE_API_URL",
    "POSTGRES_PASSWORD",
    "POSTGRES_USER",
    "POSTGRES_DB",
)


def parse_env_file(path: Path) -> dict[str, str]:
    data: dict[str, str] = {}
    if not path.is_file():
        return data
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line.removeprefix("export ").strip()
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        data[key.strip()] = value.strip().strip('"').strip("'")
    return data


def origin_from_url(url: str) -> str | None:
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}"


def check_lite_staging_env(env: dict[str, str], *, label: str) -> list[str]:
    errors: list[str] = []
    for key in REQUIRED_STAGING_KEYS:
        if not env.get(key, "").strip():
            errors.append(f"{label}: missing {key}")

    db_url = env.get("DATABASE_URL", "")
    if db_url and not db_url.startswith("postgresql"):
        errors.append(f"{label}: DATABASE_URL must use postgresql+asyncpg for staging")

    bootstrap = env.get("DB_BOOTSTRAP", "").strip().lower()
    if bootstrap and bootstrap != "none":
        errors.append(f"{label}: DB_BOOTSTRAP must be none for staging")

    provider = env.get("LLM_PROVIDER", "").strip().lower()
    if provider and provider != "fallback":
        errors.append(f"{label}: Lite-first staging expects LLM_PROVIDER=fallback")

    mini = env.get("MINI_APP_URL", "").strip()
    if mini and not mini.startswith("https://"):
        errors.append(f"{label}: MINI_APP_URL must be HTTPS")

    for key, value in env.items():
        lower = value.lower()
        for marker in PLACEHOLDER_MARKERS:
            if marker in lower:
                errors.append(f"{label}: {key} still contains placeholder text")
                break

    cors_raw = env.get("CORS_ORIGINS", "")
    cors_origins = [o.strip() for o in cors_raw.split(",") if o.strip()]
    mini_origin = origin_from_url(mini) if mini else None
    if mini_origin and cors_origins and mini_origin not in cors_origins:
        errors.append(
            f"{label}: CORS_ORIGINS must include MINI_APP_URL origin ({mini_origin})"
        )

    # Frontend build: relative /api is OK when nginx proxies (default Docker image).
    vite = env.get("VITE_API_URL", "/api").strip()
    if vite and not vite.startswith("/") and not vite.startswith("https://"):
        errors.append(f"{label}: VITE_API_URL must be /api or absolute HTTPS API URL")

    return errors


def check_docker_compose_policy() -> list[str]:
    """Static checks on committed compose — no cluster access required."""
    warnings: list[str] = []
    compose = ROOT / "docker-compose.yml"
    if not compose.is_file():
        return ["docker-compose.yml not found"]
    text = compose.read_text(encoding="utf-8")
    if re.search(r'ports:\s*\n\s*-\s*"5432:5432"', text):
        warnings.append(
            "docker-compose.yml publishes PostgreSQL 5432 — remove host mapping on public staging"
        )
    if 'restart: unless-stopped' not in text:
        warnings.append("docker-compose.yml missing restart: unless-stopped on services")
    return warnings


def main() -> int:
    paths = [ROOT / ".env.docker"]
    if len(sys.argv) > 1:
        paths = [Path(p) for p in sys.argv[1:]]

    errors: list[str] = []
    for path in paths:
        label = path.name
        if not path.is_file():
            errors.append(f"{label}: file not found (copy from .env.docker.example)")
            continue
        env = parse_env_file(path)
        errors.extend(check_lite_staging_env(env, label=label))

    warnings = check_docker_compose_policy()

    if warnings:
        print("Staging preflight warnings:")
        for w in warnings:
            print(f"  ! {w}")

    if errors:
        print("Staging preflight failed:")
        for e in errors:
            print(f"  - {e}")
        return 1

    print("Staging preflight: OK (policy checks only — run /health and /ready after deploy)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
