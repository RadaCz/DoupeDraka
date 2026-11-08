from functools import lru_cache
from urllib.parse import urlparse

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict, NoDecode

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        # Pydantic reserves the model_ prefix, so llm_provider would never
        # read MODEL_PROVIDER. Opening the namespace lets BOTH spellings land
        # on the same field, which is what local-LLM docs actually use.
        protected_namespaces=(),
    )
    database_url: str = "sqlite+aiosqlite:///./data/dnd.db"
    api_url: str = "http://127.0.0.1:8000"
    mini_app_url: str = Field(default="", validation_alias=AliasChoices("MINI_APP_URL", "mini_app_url"))
    bot_token: str = ""
    bot_api_token: str = ""
    openrouter_api_key: str = ""
    openrouter_model: str = "openai/gpt-4o-mini"
    # Canonical name is llm_provider / LLM_PROVIDER, but the validation alias
    # also accepts the widely used MODEL_PROVIDER. Both spellings work.
    llm_provider: str = Field(default="fallback", validation_alias=AliasChoices(
        "LLM_PROVIDER", "llm_provider", "MODEL_PROVIDER", "model_provider"))
    ollama_url: str = Field(default="http://127.0.0.1:11434", validation_alias=AliasChoices(
        "OLLAMA_URL", "ollama_url", "OLLAMA_BASE_URL", "ollama_base_url"))
    ollama_model: str = Field(default="qwen2.5:7b", validation_alias=AliasChoices(
        "OLLAMA_MODEL", "ollama_model", "MODEL_NAME", "model_name"))
    # Seconds to wait for the local model before the offline storyteller takes
    # over. The connect step stays short; this is the READ budget, and an 8B
    # model on CPU needs a generous one (30-90s per turn is normal).
    ollama_timeout_s: float = 180.0
    llm_max_concurrency: int = 1

    @model_validator(mode="before")
    @classmethod
    def _apply_legacy_aliases(cls, data):
        """Honour the short env names people actually put in `.env`.

        Canonical keys are LLM_PROVIDER / OLLAMA_URL / OLLAMA_MODEL. Older docs
        and many setups use MODEL_PROVIDER / MODEL_NAME / OLLAMA_BASE_URL; those
        are read as fallbacks so an existing `.env` configured for Ollama
        actually reaches the narrator instead of being silently ignored.
        Canonical names always win.
        """
        import os

        def _env(*names: str) -> str | None:
            for env_name in names:
                value = os.getenv(env_name)
                if value is not None and value.strip() != "":
                    return value.strip()
            return None

        # `data` holds what the settings sources already parsed (env + .env).
        values = dict(data) if isinstance(data, dict) else {}

        def _set(field: str, canonical: str, *legacy: str) -> None:
            if values.get(field) or _env(canonical):
                return
            for name in legacy:
                from_env = _env(name)
                if from_env:
                    values[field] = from_env
                    return
            for name in legacy:
                if values.get(name):
                    values[field] = values[name]
                    return

        _set("llm_provider", "LLM_PROVIDER", "MODEL_PROVIDER")
        _set("ollama_url", "OLLAMA_URL", "OLLAMA_BASE_URL")
        _set("ollama_model", "OLLAMA_MODEL", "MODEL_NAME")
        return values

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    auth_rate_limit: str = "10/minute"
    action_rate_limit: str = "30/minute"
    # Empty by default: with no token configured, admin-only routes stay closed.
    admin_token: str = ""

    @field_validator("cors_origins")
    @classmethod
    def validate_cors_origins(cls, value: str) -> str:
        origins = [origin.strip() for origin in value.split(",") if origin.strip()]
        for origin in origins:
            parsed = urlparse(origin)
            if (
                origin == "*"
                or parsed.scheme not in {"http", "https"}
                or not parsed.netloc
                or parsed.path not in {"", "/"}
                or parsed.query
                or parsed.fragment
            ):
                raise ValueError("CORS_ORIGINS must contain explicit HTTP(S) origins, not paths or wildcards")
        return value

    @property
    def origins(self) -> list[str]: return [x.strip() for x in self.cors_origins.split(",") if x.strip()]

@lru_cache
def get_settings() -> Settings: return Settings()
