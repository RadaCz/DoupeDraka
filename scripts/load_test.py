#!/usr/bin/env python3
"""Concurrent HTTP load test for turn resolution + narration.

Example:

    # API with LOAD_TEST_ENABLED=true for --mock-llm (skips LLM, no API credits)
    python scripts/load_test.py --base-url http://127.0.0.1:8000 --users 20 --turns 5 --mock-llm
"""

from __future__ import annotations

import argparse
import asyncio
import statistics
import sys
import time
import uuid
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def percentile(samples: list[float], pct: float) -> float:
    if not samples:
        return 0.0
    ordered = sorted(samples)
    index = max(0, min(len(ordered) - 1, int(round((pct / 100) * (len(ordered) - 1)))))
    return ordered[index]


def summarize(label: str, samples: list[float]) -> None:
    if not samples:
        print(f"{label}: no samples")
        return
    print(
        f"{label}: n={len(samples)} min={min(samples)*1000:.0f}ms "
        f"p50={percentile(samples, 50)*1000:.0f}ms p95={percentile(samples, 95)*1000:.0f}ms "
        f"max={max(samples)*1000:.0f}ms"
    )


async def register_and_login(client: httpx.AsyncClient, username: str, password: str) -> str:
    await client.post("/auth/register", json={"username": username, "password": password})
    login = await client.post("/auth/login", json={"username": username, "password": password})
    login.raise_for_status()
    return login.json()["access_token"]


async def create_character(client: httpx.AsyncClient, token: str, name: str) -> str:
    headers = {"Authorization": f"Bearer {token}"}
    body = {
        "name": name,
        "race": "human",
        "character_class": "fighter",
        "difficulty": "normal",
        "tone": "balanced",
        "humor": "rare",
    }
    response = await client.post("/characters", json=body, headers=headers)
    response.raise_for_status()
    return response.json()["id"]


ACTIONS = ["look around", "explore the cellar", "rest", "search the area", "travel to The Sunken Corridor"]


async def play_stream_turn(
    client: httpx.AsyncClient,
    token: str,
    character_id: str,
    action: str,
    *,
    mock_llm: bool,
) -> tuple[float, float, str]:
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "text/event-stream",
        "Idempotency-Key": str(uuid.uuid4()),
    }
    if mock_llm:
        headers["X-Load-Test-Mock"] = "1"

    engine_s = 0.0
    narration_s = 0.0
    narration_status = "unknown"
    started = time.perf_counter()
    turn_seen_at: float | None = None

    async with client.stream(
        "POST",
        f"/characters/{character_id}/actions/stream",
        json={"action": action},
        headers=headers,
        timeout=120.0,
    ) as response:
        response.raise_for_status()
        event_name = None
        buffer = ""
        async for line in response.aiter_lines():
            if line.startswith("event:"):
                event_name = line.split(":", 1)[1].strip()
            elif line.startswith("data:") and event_name:
                if event_name == "turn" and turn_seen_at is None:
                    turn_seen_at = time.perf_counter()
                    engine_s = turn_seen_at - started
                if event_name == "complete":
                    import json

                    payload = json.loads(line.split(":", 1)[1].strip())
                    narration_status = payload.get("narration_status", "unknown")
                    narration_s = time.perf_counter() - (turn_seen_at or started)
                event_name = None
            buffer = line

    if turn_seen_at is None:
        engine_s = time.perf_counter() - started
    return engine_s, narration_s, narration_status


async def user_session(
    base_url: str,
    user_index: int,
    turns: int,
    mock_llm: bool,
    engine_samples: list[float],
    narration_samples: list[float],
    status_counts: dict[str, int],
) -> None:
    username = f"load_user_{user_index}"
    password = "load-test-password"
    async with httpx.AsyncClient(base_url=base_url, timeout=120.0) as client:
        token = await register_and_login(client, username, password)
        character_id = await create_character(client, token, f"LoadHero{user_index}")
        for turn in range(turns):
            action = ACTIONS[(user_index + turn) % len(ACTIONS)]
            engine_s, narration_s, status = await play_stream_turn(
                client, token, character_id, action, mock_llm=mock_llm,
            )
            engine_samples.append(engine_s)
            narration_samples.append(narration_s)
            status_counts[status] = status_counts.get(status, 0) + 1


async def main_async(args: argparse.Namespace) -> None:
    health = httpx.get(f"{args.base_url.rstrip('/')}/health", timeout=10.0)
    health.raise_for_status()
    print(f"Target health: {health.json().get('status')} version={health.json().get('version')}")

    engine_samples: list[float] = []
    narration_samples: list[float] = []
    status_counts: dict[str, int] = {}

    started = time.perf_counter()
    await asyncio.gather(*[
        user_session(
            args.base_url.rstrip("/"),
            index,
            args.turns,
            args.mock_llm,
            engine_samples,
            narration_samples,
            status_counts,
        )
        for index in range(args.users)
    ])
    elapsed = time.perf_counter() - started

    print(f"\nCompleted {args.users * args.turns} turns in {elapsed:.1f}s "
          f"({args.users * args.turns / max(elapsed, 0.001):.1f} turns/s)")
    summarize("Engine commit (to SSE turn)", engine_samples)
    summarize("Narration (turn → complete)", narration_samples)
    print("Narration status counts:", status_counts)

    health_after = httpx.get(f"{args.base_url.rstrip('/')}/health", timeout=10.0)
    if health_after.status_code == 200:
        gateway = health_after.json().get("llm", {}).get("gateway_metrics", {})
        print("\nGateway metrics (since API process start):")
        print("  provider_hits:", gateway.get("provider_hits", {}))
        print("  fallback_paths:", gateway.get("fallback_paths", {}))
    if args.mock_llm:
        print("\n(--mock-llm: set LOAD_TEST_ENABLED=true on the API and use X-Load-Test-Mock header)")


def main() -> None:
    parser = argparse.ArgumentParser(description="A.U.R.I.O.N. concurrent load test")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--users", type=int, default=20)
    parser.add_argument("--turns", type=int, default=5)
    parser.add_argument(
        "--mock-llm",
        action="store_true",
        help="Send X-Load-Test-Mock header (requires LOAD_TEST_ENABLED on API)",
    )
    args = parser.parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
