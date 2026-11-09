from __future__ import annotations

from .gateway import NamedProvider, NarrationGateway
from .ollama import DEFAULT_READ_TIMEOUT_S, OllamaProvider
from .openai_chat import OpenAIChatProvider
from app.settings import Settings


def get_chain_names(settings: Settings) -> list[str]:
    """Ordered LLM provider names for the configured primary + chain (public API)."""
    primary = settings.llm_provider.strip().lower()
    if primary in ("fallback", "offline", ""):
        return []
    configured = [name.strip().lower() for name in settings.llm_provider_chain.split(",") if name.strip()]
    if primary in {"auto", "gateway"}:
        return configured or ["nvidia", "groq", "cerebras", "ollama"]
    names = [primary]
    for name in configured:
        if name not in names:
            names.append(name)
    return names


def _provider_for_name(name: str, settings: Settings) -> NamedProvider | None:
    match name:
        case "ollama":
            if settings.llm_provider.lower() == "fallback":
                return None
            return NamedProvider(
                "Ollama",
                OllamaProvider(
                    settings.ollama_url,
                    settings.ollama_model,
                    read_timeout=float(getattr(settings, "ollama_timeout_s", DEFAULT_READ_TIMEOUT_S)),
                ),
            )
        case "nvidia" | "nim":
            if not settings.nvidia_api_key:
                return None
            return NamedProvider(
                "NVIDIA NIM",
                OpenAIChatProvider(
                    "nvidia",
                    settings.nvidia_base_url,
                    settings.nvidia_api_key,
                    settings.nvidia_model,
                    read_timeout=settings.llm_read_timeout_s,
                ),
            )
        case "groq":
            if not settings.groq_api_key:
                return None
            return NamedProvider(
                "Groq",
                OpenAIChatProvider(
                    "groq",
                    settings.groq_base_url,
                    settings.groq_api_key,
                    settings.groq_model,
                    read_timeout=settings.llm_read_timeout_s,
                ),
            )
        case "cerebras":
            if not settings.cerebras_api_key:
                return None
            return NamedProvider(
                "Cerebras",
                OpenAIChatProvider(
                    "cerebras",
                    settings.cerebras_base_url,
                    settings.cerebras_api_key,
                    settings.cerebras_model,
                    read_timeout=settings.llm_read_timeout_s,
                ),
            )
        case "openrouter":
            if not settings.openrouter_api_key:
                return None
            return NamedProvider(
                "OpenRouter",
                OpenAIChatProvider(
                    "openrouter",
                    settings.openrouter_base_url,
                    settings.openrouter_api_key,
                    settings.openrouter_model,
                    read_timeout=settings.llm_read_timeout_s,
                ),
            )
    return None


def has_external_paid_narration_provider(settings: Settings) -> bool:
    """True when a configured provider can incur off-machine API cost (not local Ollama)."""
    for name in get_chain_names(settings):
        if name == "ollama":
            continue
        if _provider_for_name(name, settings) is not None:
            return True
    return False


def narration_gateway_for(settings: Settings) -> NarrationGateway:
    providers: list[NamedProvider] = []
    for name in get_chain_names(settings):
        provider = _provider_for_name(name, settings)
        if provider is not None:
            providers.append(provider)
    return NarrationGateway(providers)


def external_paid_providers(settings: Settings) -> list[NamedProvider]:
    """Configured external APIs for Normal billing (never Ollama)."""
    providers: list[NamedProvider] = []
    for name in get_chain_names(settings):
        if name == "ollama":
            continue
        provider = _provider_for_name(name, settings)
        if provider is not None:
            providers.append(provider)
    return providers


def paid_narration_gateway_for(settings: Settings) -> NarrationGateway:
    """Provider chain for Normal billing — external APIs only, never local Ollama."""
    providers = external_paid_providers(settings)
    if settings.paid_narration_strict and providers:
        providers = providers[:1]
    return NarrationGateway(providers, paid_strict=settings.paid_narration_strict)


def provider_for(settings: Settings):
    """Legacy hook: first online provider, if any."""
    gateway = narration_gateway_for(settings)
    if not gateway.providers:
        return None
    return gateway.providers[0].provider
