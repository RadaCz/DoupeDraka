from starlette.requests import Request

from app.rate_limit_client import client_ip_for_rate_limit


def _request(peer: str, headers: list[tuple[str, str]] | None = None) -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": headers or [],
        "client": (peer, 12345),
        "server": ("test", 80),
        "scheme": "http",
        "http_version": "1.1",
        "query_string": b"",
    }
    return Request(scope)


def test_trusted_proxy_uses_x_forwarded_for():
    req = _request("172.18.0.2", [(b"x-forwarded-for", b"203.0.113.10, 172.18.0.1")])
    assert client_ip_for_rate_limit(req) == "203.0.113.10"


def test_untrusted_peer_ignores_forwarded_headers():
    req = _request("8.8.8.8", [(b"x-forwarded-for", b"1.2.3.4")])
    assert client_ip_for_rate_limit(req) == "8.8.8.8"


def test_trusted_proxy_falls_back_to_x_real_ip():
    req = _request("127.0.0.1", [(b"x-real-ip", b"198.51.100.7")])
    assert client_ip_for_rate_limit(req) == "198.51.100.7"
