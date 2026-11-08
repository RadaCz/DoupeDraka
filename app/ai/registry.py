from .base import NarrationProvider
from .ollama import DEFAULT_READ_TIMEOUT_S, OllamaProvider
from app.settings import Settings


def provider_for(settings: Settings) -> NarrationProvider | None:
    if settings.llm_provider.lower() != "ollama":
        return None
    return OllamaProvider(
        settings.ollama_url,
        settings.ollama_model,
        read_timeout=float(getattr(settings, "ollama_timeout_s", DEFAULT_READ_TIMEOUT_S)),
    )
