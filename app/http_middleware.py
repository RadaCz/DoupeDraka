"""Shared HTTP middleware for API URL compatibility."""

from fastapi import Request


async def strip_api_and_v1_prefix(request: Request, call_next):
    """Support /api proxy paths (nginx, Vite) and the stable /v1 URL contract."""
    path = request.scope.get("path", "")
    if path.startswith("/v1/"):
        request.scope["path"] = path[3:]
    elif path.startswith("/api/"):
        request.state.api_proxy_stripped = True
        request.scope["path"] = "/" + path[5:]
    elif path == "/api":
        request.state.api_proxy_stripped = True
        request.scope["path"] = "/"
    return await call_next(request)