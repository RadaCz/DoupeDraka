"""SQLite bootstrap must stay safe when init_db is invoked from many event loops."""

from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor

from app.db import init_db


def test_init_db_survives_parallel_calls():
    def run() -> None:
        asyncio.run(init_db())

    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(lambda _: run(), range(12)))
