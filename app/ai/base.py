from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class NarrationContext:
    action: str
    events: tuple[str, ...]
    location: str
    memories: tuple[str, ...]
    difficulty: str = "normal"
    tone: str = "balanced"
    humor: str = "rare"
    verbose: bool = True
    language: str = "en"
    spell_facts: dict | None = None
    rest_facts: dict | None = None
    level_up_facts: dict | None = None
    defeat_facts: dict | None = None


@dataclass(frozen=True)
class NarrationRequest:
    context: NarrationContext
    system_prompt: str
    user_prompt: str


class NarrationProvider(Protocol):
    async def complete(self, request: NarrationRequest) -> str: ...

    def stream(self, request: NarrationRequest) -> AsyncIterator[str]: ...
