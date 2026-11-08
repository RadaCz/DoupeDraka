"""Health/readiness probes for orchestrators."""

from __future__ import annotations

import time

import httpx
from sqlalchemy import text

from .ai.gateway_metrics import snapshot as gateway_snapshot
from .ai.registry import get_chain_names, narration_gateway_for
from .db import Session
from .settings import get_settings
from .version import APP_VERSION

_PROCESS_START = time.monotonic()


def uptime_seconds() -> float:
    return round(time.monotonic() - _PROCESS_START, 2)


async def database_status() -> dict:
    try:
        async with Session() as session:
            await session.execute(text("SELECT 1"))
        url = get_settings().database_url
        dialect = "postgresql" if url.startswith("postgresql") else "sqlite" if url.startswith("sqlite") else "other"
        return {"status": "up", "dialect": dialect}
    except Exception as error:
        return {"status": "down", "error": str(error)}


def llm_providers_status() -> dict:
    settings = get_settings()
    chain = get_chain_names(settings)
    gateway = narration_gateway_for(settings)
    providers = {
        "ollama": {
            "configured": settings.llm_provider.lower() not in ("fallback", "offline", ""),
            "model": settings.ollama_model,
        },
        "nvidia": {"configured": bool(settings.nvidia_api_key), "model": settings.nvidia_model},
        "groq": {"configured": bool(settings.groq_api_key), "model": settings.groq_model},
        "cerebras": {"configured": bool(settings.cerebras_api_key), "model": settings.cerebras_model},
        "openrouter": {"configured": bool(settings.openrouter_api_key), "model": settings.openrouter_model},
    }
    return {
        "primary": settings.llm_provider,
        "chain": chain,
        "online_providers": [entry.name for entry in gateway.providers],
        "providers": providers,
        "gateway_metrics": gateway_snapshot(),
    }


async def probe_ollama_reachable() -> bool | None:
    settings = get_settings()
    if "ollama" not in get_chain_names(settings):
        return None
    url = f"{settings.ollama_url.rstrip('/')}/api/tags"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(3.0)) as client:
            response = await client.get(url)
            return response.status_code < 500
    except httpx.HTTPError:
        return False


async def build_health_payload() -> tuple[dict, int]:
    """Return JSON body and HTTP status (503 when the database is unreachable)."""
    try:
        db = await database_status()
    except Exception:
        return {"status": "unhealthy", "db": "disconnected"}, 503

    if db.get("status") != "up":
        return {"status": "unhealthy", "db": "disconnected"}, 503

    llm = llm_providers_status()
    ollama_up = await probe_ollama_reachable()
    if ollama_up is not None:
        llm["providers"]["ollama"]["responsive"] = ollama_up
    return {
        "status": "healthy",
        "version": APP_VERSION,
        "uptime_seconds": uptime_seconds(),
        "database": db,
        "llm": llm,
    }, 200
