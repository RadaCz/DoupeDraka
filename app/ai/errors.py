"""Typed failures used by the narration gateway to decide when to fall back."""

from __future__ import annotations


class ProviderError(Exception):
    """Base class for provider failures that may trigger fallback."""

    def __init__(self, message: str, *, provider: str = "", status_code: int | None = None):
        super().__init__(message)
        self.provider = provider
        self.status_code = status_code


class ProviderRateLimitError(ProviderError):
    pass


class ProviderServerError(ProviderError):
    pass


class ProviderTimeoutError(ProviderError):
    pass


class ProviderStreamAbortedError(ProviderError):
    """Raised when streaming fails after at least one token was delivered."""

    def __init__(self, message: str, *, provider: str = "", partial: str = ""):
        super().__init__(message, provider=provider)
        self.partial = partial


RETRYABLE_PROVIDER_ERRORS: tuple[type[Exception], ...] = (
    ProviderRateLimitError,
    ProviderServerError,
    ProviderTimeoutError,
    ProviderStreamAbortedError,
)

# Imported lazily in gateway to avoid circular imports — extended at module load in gateway.py
