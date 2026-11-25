"""Serve a Vite production build from the API process (single-container deploy)."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles


def default_frontend_dist() -> Path:
    return Path(os.environ.get("FRONTEND_DIST", "/app/frontend/dist")).expanduser()


def frontend_base_path() -> str:
    """Must match Vite `base` when non-default (trailing slash stripped)."""
    raw = os.environ.get("FRONTEND_BASE_PATH", "/").strip() or "/"
    if not raw.startswith("/"):
        raw = "/" + raw
    return raw.rstrip("/") or ""


def safe_dist_file(dist_dir: Path, spa_path: str) -> Path | None:
    """Return a file under *dist_dir* or None (caller serves index.html)."""
    if not spa_path or spa_path.endswith("/"):
        return None
    candidate = (dist_dir / spa_path).resolve()
    if not candidate.is_relative_to(dist_dir):
        return None
    if candidate.is_file():
        return candidate
    return None


def resolve_frontend_dist(dist: Path | None = None) -> Path | None:
    root = (dist or default_frontend_dist()).resolve()
    if (root / "index.html").is_file():
        return root
    return None


def mount_frontend_app(app: FastAPI, dist_dir: Path) -> None:
    dist_dir = dist_dir.resolve()
    index_path = dist_dir / "index.html"
    if not index_path.is_file():
        return

    assets_dir = dist_dir / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="frontend-assets")

    base = frontend_base_path()

    @app.get(base or "/")
    async def frontend_root() -> FileResponse:
        return FileResponse(index_path, media_type="text/html")

    prefix = f"{base}/" if base else ""

    @app.get(f"{prefix}{{spa_path:path}}")
    async def spa_fallback(spa_path: str, request: Request):
        if request.method != "GET":
            raise HTTPException(status_code=405, detail="Method Not Allowed")
        if getattr(request.state, "api_proxy_stripped", False):
            return JSONResponse(status_code=404, content={"detail": "Not Found"})
        if spa_path.startswith("api/") or spa_path == "api":
            return JSONResponse(status_code=404, content={"detail": "Not Found"})
        safe = safe_dist_file(dist_dir, spa_path)
        if safe is not None:
            return FileResponse(safe)
        return FileResponse(index_path, media_type="text/html")