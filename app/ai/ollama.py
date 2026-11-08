from collections.abc import AsyncIterator
import json

import httpx

from .base import NarrationRequest
from .openai_chat import _map_http_error
from .errors import ProviderTimeoutError

CONNECT_TIMEOUT_S = 5.0
DEFAULT_READ_TIMEOUT_S = 180.0
PROVIDER_ERRORS = (httpx.HTTPError, KeyError, TypeError, ValueError)


class OllamaProvider:
    name = "ollama"

    def __init__(
        self,
        base_url: str,
        model: str,
        read_timeout: float = DEFAULT_READ_TIMEOUT_S,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self.base_url = base_url.rstrip("/")
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

    def _payload(self, request: NarrationRequest, stream: bool) -> dict:
        return {
            "model": self.model,
            "stream": stream,
            "messages": [
                {"role": "system", "content": request.system_prompt},
                {"role": "user", "content": request.user_prompt},
            ],
            "options": {"temperature": 0.7, "num_predict": 220},
        }

    async def complete(self, request: NarrationRequest) -> str:
        try:
            async with httpx.AsyncClient(timeout=self._timeout(), transport=self.transport) as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json=self._payload(request, stream=False),
                )
                response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError(str(exc), provider=self.name) from exc
        except httpx.HTTPStatusError as exc:
            raise _map_http_error(self.name, exc) from exc
        return response.json()["message"]["content"].strip()

    async def stream(self, request: NarrationRequest) -> AsyncIterator[str]:
        from .errors import ProviderStreamAbortedError

        partial: list[str] = []
        try:
            async with httpx.AsyncClient(timeout=self._timeout(), transport=self.transport) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/chat",
                    json=self._payload(request, stream=True),
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        payload = json.loads(line)
                        chunk = payload.get("message", {}).get("content", "")
                        if chunk:
                            partial.append(chunk)
                            yield chunk
                        if payload.get("done"):
                            break
        except httpx.TimeoutException as exc:
            if partial:
                raise ProviderStreamAbortedError(str(exc), provider=self.name, partial="".join(partial)) from exc
            raise ProviderTimeoutError(str(exc), provider=self.name) from exc
        except httpx.HTTPStatusError as exc:
            mapped = _map_http_error(self.name, exc)
            if partial:
                raise ProviderStreamAbortedError(str(mapped), provider=self.name, partial="".join(partial)) from mapped
            raise mapped from exc
