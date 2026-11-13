"""Client IP for SlowAPI behind trusted reverse proxies (nginx, Vite dev)."""

from __future__ import annotations

import ipaddress

from starlette.requests import Request


def _peer_is_trusted_proxy(host: str) -> bool:
    if not host:
        return False
    if host in ("127.0.0.1", "::1", "localhost"):
        return True
    try:
        return ipaddress.ip_address(host).is_private
    except ValueError:
        return False


def client_ip_for_rate_limit(request: Request) -> str:
    """Use forwarded headers only when the immediate peer is a trusted private proxy."""
    peer = request.client.host if request.client else ""
    if _peer_is_trusted_proxy(peer):
        forwarded = request.headers.get("X-Forwarded-For", "").strip()
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = request.headers.get("X-Real-IP", "").strip()
        if real_ip:
            return real_ip
    return peer or "127.0.0.1"
