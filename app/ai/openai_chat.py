"""OpenAI-compatible chat providers (NVIDIA NIM, Groq, Cerebras, OpenRouter)."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

import httpx

from .base import NarrationRequest
from .errors import (
    ProviderError,
    ProviderRateLimitError,
    ProviderServerError,
    ProviderStreamAbortedError,
    ProviderTimeoutError,
)

CONNECT_TIMEOUT_S = 5.0
DEFAULT_READ_TIMEOUT_S = 120.0


def _map_http_error(name: str, error: httpx.HTTPStatusError) -> ProviderError:
    status = error.response.status_code
    if status == 429:
        return ProviderRateLimitError(str(error), provider=name, status_code=status)
    if status >= 500:
        return ProviderServerError(str(error), provider=name, status_code=status)
    return ProviderError(str(error), provider=name, status_code=status)


class OpenAIChatProvider:
    """Minimal chat-completions client for OpenAI-shaped HTTP APIs."""

    def __init__(
        self,
        name: str,
        base_url: str,
        api_key: str,
        model: str,
        read_timeout: float = DEFAULT_READ_TIMEOUT_S,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self.name = name
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.read_timeout = read_timeout
        self.transport = transport

    def _timeout(self) -> httpx.Timeout:
        return httpx.Timeout(
            connect=CONNECT_TIMEOUT_S,
            read=self.read_timeout,
            write=CONNECT_TIMEOUT_S,
            pool=CONNECT_TIMEOUT_S,
        )

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _payload(self, request: NarrationRequest, stream: bool) -> dict:
        return {
            "model": self.model,
            "stream": stream,
            "temperature": 0.7,
            "max_tokens": 400,
            "messages": [
                {"role": "system", "content": request.system_prompt},
                {"role": "user", "content": request.user_prompt},
            ],
        }

    async def complete(self, request: NarrationRequest) -> str:
        url = f"{self.base_url}/chat/completions"
        try:
            async with httpx.AsyncClient(timeout=self._timeout(), transport=self.transport) as client:
                response = await client.post(url, headers=self._headers(), json=self._payload(request, False))
                response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError(str(exc), provider=self.name) from exc
        except httpx.HTTPStatusError as exc:
            raise _map_http_error(self.name, exc) from exc
        data = response.json()
        try:
            return data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderServerError(f"Malformed response from {self.name}", provider=self.name) from exc

    async def stream(self, request: NarrationRequest) -> AsyncIterator[str]:
        url = f"{self.base_url}/chat/completions"
        partial: list[str] = []
        try:
            async with httpx.AsyncClient(timeout=self._timeout(), transport=self.transport) as client:
                async with client.stream(
                    "POST",
                    url,
                    headers=self._headers(),
                    json=self._payload(request, True),
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line or not line.startswith("data:"):
                            continue
                        payload_text = line[5:].strip()
                        if payload_text == "[DONE]":
                            break
                        payload = json.loads(payload_text)
                        delta = (
                            payload.get("choices", [{}])[0]
                            .get("delta", {})
                            .get("content", "")
                        )
                        if delta:
                            partial.append(delta)
                            yield delta
        except httpx.TimeoutException as exc:
            if partial:
                raise ProviderStreamAbortedError(
                    str(exc), provider=self.name, partial="".join(partial),
                ) from exc
            raise ProviderTimeoutError(str(exc), provider=self.name) from exc
        except httpx.HTTPStatusError as exc:
            mapped = _map_http_error(self.name, exc)
            if partial:
                raise ProviderStreamAbortedError(
                    str(mapped), provider=self.name, partial="".join(partial),
                ) from mapped
            raise mapped from exc
        except (json.JSONDecodeError, KeyError, TypeError) as exc:
            if partial:
                raise ProviderStreamAbortedError(str(exc), provider=self.name, partial="".join(partial)) from exc
            raise ProviderServerError(str(exc), provider=self.name) from exc
