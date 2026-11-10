#!/usr/bin/env python3
"""Validate staging env and Compose exposure before deploy (never print secrets)."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
BASE_COMPOSE = ROOT / "docker-compose.yml"
STAGING_COMPOSE = ROOT / "docker-compose.staging.yml"

PLACEHOLDER_MARKERS = (
    "your_telegram_bot_token_here",
    "your_api_token_for_bot_auth",
    "change-me",
    "your-mini-app.example",
    "your_openrouter",
)

REQUIRED_STAGING_KEYS = (
    "DATABASE_URL",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "POSTGRES_DB",
    "BOT_TOKEN",
    "BOT_API_TOKEN",
    "MINI_APP_URL",
    "CORS_ORIGINS",
    "DB_BOOTSTRAP",
    "LLM_PROVIDER",
)

LOCALHOST_HTTP_ORIGINS = frozenset(
    {
        "http://localhost",
        "http://127.0.0.1",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    }
)


@dataclass(frozen=True)
class PortPublish:
    host_ip: str
    host_port: int
    container_port: int


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


def parse_postgres_async_url(url: str) -> tuple[str, str, str, str, int] | None:
    """Return user, password, host, db, port."""
    if not url.startswith("postgresql+asyncpg://"):
        return None
    normalized = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    parsed = urlparse(normalized)
    if not parsed.hostname or not parsed.path:
        return None
    user = unquote(parsed.username or "")
    password = unquote(parsed.password or "")
    db = parsed.path.lstrip("/")
    port = parsed.port or 5432
    return user, password, parsed.hostname, db, port


def _parse_port_entry(entry: str) -> PortPublish | None:
    entry = entry.strip().strip('"').strip("'")
    if not entry:
        return None
    parts = entry.split(":")
    if len(parts) == 2:
        host_ip, host_port_s, container_port_s = "0.0.0.0", parts[0], parts[1]
    elif len(parts) == 3:
        host_ip, host_port_s, container_port_s = parts[0], parts[1], parts[2]
    else:
        return None
    try:
        return PortPublish(host_ip, int(host_port_s), int(container_port_s))
    except ValueError:
        return None


def _service_block(text: str, service: str) -> str:
    pattern = rf"(?ms)^  {re.escape(service)}:\n(.*?)(?=^  [a-z].*:$|\nvolumes:|\Z)"
    match = re.search(pattern, text)
    return match.group(1) if match else ""


def _ports_from_block(block: str) -> tuple[bool, list[PortPublish]]:
    if "!reset" in block:
        if re.search(r"ports:\s*!reset\s*\[\s*\]", block):
            return True, []
        entries: list[PortPublish] = []
        in_ports = False
        for line in block.splitlines():
            stripped = line.strip()
            if stripped.startswith("ports:") and "!reset" in stripped:
                in_ports = True
                if "[]" in stripped:
                    return True, []
                continue
            if in_ports:
                if stripped.startswith("- "):
                    pub = _parse_port_entry(stripped[2:].strip())
                    if pub:
                        entries.append(pub)
                    continue
                if stripped and not stripped.startswith("#"):
                    break
        return True, entries
    ports_section = re.search(r"(?ms)^    ports:\s*\n(.*?)(?=^    [a-z]|\Z)", block)
    if not ports_section:
        return False, []
    entries = []
    for line in ports_section.group(1).splitlines():
        stripped = line.strip()
        if stripped.startswith("- "):
            pub = _parse_port_entry(stripped[2:].strip())
            if pub:
                entries.append(pub)
    return False, entries


def merge_compose_port_bindings(
    base_text: str,
    overlay_text: str,
    *,
    services: tuple[str, ...] = ("postgres", "api", "frontend", "bot"),
) -> dict[str, list[PortPublish]]:
    result: dict[str, list[PortPublish]] = {}
    for service in services:
        base_block = _service_block(base_text, service)
        overlay_block = _service_block(overlay_text, service)
        reset, overlay_ports = _ports_from_block(overlay_block)
        if reset:
            result[service] = overlay_ports
            continue
        _, base_ports = _ports_from_block(base_block)
        extra, overlay_only = _ports_from_block(overlay_block)
        if overlay_only:
            result[service] = base_ports + overlay_only
        else:
            result[service] = base_ports
    return result


def run_docker_compose_config() -> dict | None:
    if not shutil.which("docker"):
        return None
    cmd = [
        "docker",
        "compose",
        "-f",
        str(BASE_COMPOSE),
        "-f",
        str(STAGING_COMPOSE),
        "config",
        "--format",
        "json",
    ]
    try:
        proc = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, check=True, timeout=120)
    except (subprocess.CalledProcessError, OSError, subprocess.TimeoutExpired):
        return None
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        return None


def ports_from_compose_json(config: dict) -> dict[str, list[PortPublish]]:
    out: dict[str, list[PortPublish]] = {}
    services = config.get("services") or {}
    for name, spec in services.items():
        publishes: list[PortPublish] = []
        for raw in spec.get("ports") or []:
            if isinstance(raw, str):
                pub = _parse_port_entry(raw)
                if pub:
                    publishes.append(pub)
            elif isinstance(raw, dict):
                host_ip = raw.get("host_ip") or "0.0.0.0"
                published = raw.get("published")
                target = raw.get("target")
                if published is not None and target is not None:
                    publishes.append(PortPublish(str(host_ip), int(published), int(target)))
        out[name] = publishes
    return out


def check_lite_staging_env(env: dict[str, str], *, label: str, mode: str) -> list[str]:
    errors: list[str] = []
    for key in REQUIRED_STAGING_KEYS:
        if not env.get(key, "").strip():
            errors.append(f"{label}: missing {key}")

    db_url = env.get("DATABASE_URL", "").strip()
    if db_url.startswith("sqlite"):
        errors.append(f"{label}: DATABASE_URL must not use SQLite on staging")
    elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+asyncpg://"):
        errors.append(f"{label}: DATABASE_URL must use postgresql+asyncpg:// (not bare postgresql://)")
    elif db_url and not db_url.startswith("postgresql+asyncpg://"):
        errors.append(f"{label}: DATABASE_URL must use postgresql+asyncpg for staging")

    parsed = parse_postgres_async_url(db_url) if db_url else None
    if db_url and parsed is None:
        errors.append(f"{label}: DATABASE_URL is not a valid postgresql+asyncpg URL")
    elif parsed:
        user, password, host, db, port = parsed
        if mode == "staging":
            if host != "postgres":
                errors.append(f"{label}: DATABASE_URL host must be postgres (Compose service name)")
            if db != env.get("POSTGRES_DB", "").strip():
                errors.append(f"{label}: DATABASE_URL database must match POSTGRES_DB")
            if user != env.get("POSTGRES_USER", "").strip():
                errors.append(f"{label}: DATABASE_URL user must match POSTGRES_USER")
            if password != env.get("POSTGRES_PASSWORD", "").strip():
                errors.append(f"{label}: DATABASE_URL password must match POSTGRES_PASSWORD")
            if port != 5432:
                errors.append(f"{label}: DATABASE_URL port must be 5432 for Compose postgres service")

    bootstrap = env.get("DB_BOOTSTRAP", "").strip().lower()
    if bootstrap and bootstrap != "none":
        errors.append(f"{label}: DB_BOOTSTRAP must be none for staging")

    provider = env.get("LLM_PROVIDER", "").strip().lower()
    if provider and provider != "fallback":
        errors.append(f"{label}: Lite-first staging expects LLM_PROVIDER=fallback")

    mini = env.get("MINI_APP_URL", "").strip()
    mini_parsed = urlparse(mini) if mini else None
    if mini and not mini.startswith("https://"):
        errors.append(f"{label}: MINI_APP_URL must be HTTPS")
    if mini_parsed and (mini_parsed.username or mini_parsed.password or mini_parsed.query or mini_parsed.fragment):
        errors.append(f"{label}: MINI_APP_URL must not include userinfo, query, or fragment")

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
        errors.append(f"{label}: CORS_ORIGINS must include MINI_APP_URL origin ({mini_origin})")

    if mode == "staging":
        for origin in cors_origins:
            if origin.startswith("http://") and origin not in LOCALHOST_HTTP_ORIGINS:
                errors.append(f"{label}: staging CORS must not use public HTTP origin {origin}")

    vite = env.get("VITE_API_URL", "/api").strip()
    if vite.startswith("/"):
        if vite != "/api":
            errors.append(f"{label}: relative VITE_API_URL should be /api when using nginx proxy")
    elif vite:
        vp = urlparse(vite)
        if vp.scheme != "https" or not vp.netloc:
            errors.append(f"{label}: VITE_API_URL must be /api or absolute HTTPS API URL")

    return errors


def _is_wildcard_host(ip: str) -> bool:
    return ip in {"", "0.0.0.0", "::"}


def check_staging_network_bindings(
    bindings: dict[str, list[PortPublish]],
    *,
    label: str = "compose",
) -> list[str]:
    errors: list[str] = []
    pg = bindings.get("postgres") or []
    api = bindings.get("api") or []
    fe = bindings.get("frontend") or []
    bot = bindings.get("bot") or []

    if pg:
        errors.append(f"{label}: postgres must not publish host ports on public staging")
    if api:
        errors.append(f"{label}: api must not publish host ports on public staging")
    if bot:
        errors.append(f"{label}: bot must not publish host ports on public staging")

    if not fe:
        errors.append(f"{label}: frontend must publish 127.0.0.1:5173 for host TLS proxy")
    else:
        for pub in fe:
            if pub.host_port != 5173 or pub.container_port != 80:
                errors.append(
                    f"{label}: frontend must bind 127.0.0.1:5173:80 (got {pub.host_ip}:{pub.host_port})"
                )
            elif not pub.host_ip.startswith("127.0.0.1"):
                errors.append(f"{label}: frontend must bind loopback only (got host {pub.host_ip})")
            elif _is_wildcard_host(pub.host_ip):
                errors.append(f"{label}: frontend must not bind all interfaces")

    return errors


def check_staging_compose_files(*, docker_config: dict | None) -> tuple[list[str], str]:
    """Return (errors, validation_source)."""
    if not STAGING_COMPOSE.is_file():
        return ["docker-compose.staging.yml is missing"], "missing"

    overlay = STAGING_COMPOSE.read_text(encoding="utf-8")
    for service in ("postgres", "api", "bot"):
        block = _service_block(overlay, service)
        if "!reset" not in block or "ports:" not in block:
            return [f"docker-compose.staging.yml: {service} must use ports: !reset []"], "static"

    fe_block = _service_block(overlay, "frontend")
    if "127.0.0.1:5173:80" not in fe_block.replace(" ", ""):
        return ["docker-compose.staging.yml: frontend must map 127.0.0.1:5173:80"], "static"

    if docker_config is not None:
        bindings = ports_from_compose_json(docker_config)
        source = "docker compose config"
    else:
        base = BASE_COMPOSE.read_text(encoding="utf-8")
        bindings = merge_compose_port_bindings(base, overlay)
        source = "static merge (docker not available)"

    return check_staging_network_bindings(bindings, label=source), source


def check_local_compose_warnings() -> list[str]:
    warnings: list[str] = []
    if not BASE_COMPOSE.is_file():
        return ["docker-compose.yml not found"]
    text = BASE_COMPOSE.read_text(encoding="utf-8")
    if re.search(r'ports:\s*\n\s*-\s*"5432:5432"', text):
        warnings.append("docker-compose.yml publishes PostgreSQL 5432 — use docker-compose.staging.yml on VPS")
    if re.search(r'ports:\s*\n\s*-\s*"8000:8000"', text):
        warnings.append("docker-compose.yml publishes API 8000 — use staging overlay for public deploy")
    return warnings


def main() -> int:
    parser = argparse.ArgumentParser(description="Staging preflight (env + Compose exposure)")
    parser.add_argument(
        "env_files",
        nargs="*",
        default=[str(ROOT / ".env.docker")],
        help="Env files to validate (default: .env.docker)",
    )
    parser.add_argument(
        "--mode",
        choices=("staging", "local"),
        default="staging",
        help="staging = fail-closed public deploy; local = env only with compose warnings",
    )
    args = parser.parse_args()

    errors: list[str] = []
    for path_str in args.env_files:
        path = Path(path_str)
        label = path.name
        if not path.is_file():
            errors.append(f"{label}: file not found (copy from .env.docker.example)")
            continue
        env = parse_env_file(path)
        errors.extend(check_lite_staging_env(env, label=label, mode=args.mode))

    docker_config = run_docker_compose_config() if args.mode == "staging" else None
    if args.mode == "staging":
        compose_errors, compose_source = check_staging_compose_files(docker_config=docker_config)
        errors.extend(compose_errors)
        if docker_config is None:
            print("Compose validation: static merge (docker compose NOT RUN on this host)")
        else:
            print(f"Compose validation: {compose_source}")
    else:
        for w in check_local_compose_warnings():
            print(f"Local dev warning: {w}")

    if errors:
        print("Staging preflight failed:")
        for e in errors:
            print(f"  - {e}")
        return 1

    print("Staging preflight: OK")
    print("Next: run /health and /ready after deploy; Telegram smoke on device.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
