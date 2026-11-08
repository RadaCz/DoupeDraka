"""Narration orchestration: providers receive resolved facts and return prose only.

Every number in a turn is decided by `app.engine` before this module runs. The
prompt below is built from the character's campaign settings, but it never gains
the authority to change a fact — it only chooses how to describe one.
"""
from collections.abc import AsyncIterator
import json
from .ai.base import NarrationContext, NarrationRequest
from .ai.offline import OfflineProvider, narrate_offline as render_offline
from .ai.ollama import PROVIDER_ERRORS
from .ai.registry import provider_for
from .engine.models import SAFE_RESPAWN_LOCATION
from .narration_language import LANGUAGE_NAMES, language_output_instruction, normalize_narration_language
from .settings import get_settings
import asyncio

# Directive fragments keyed by the campaign settings the player controls.
TONE_DIRECTIVES = {
    "light": "Keep the tone hopeful and adventurous; peril is survivable.",
    "balanced": "Balance wonder and danger; keep stakes believable.",
    "dark": "Lean into dread and moral compromise; victory should cost something.",
    "grimdark": "The world is cruel and indifferent. Describe decay, fear and hard choices plainly.",
}

HUMOR_DIRECTIVES = {
    "serious": "No jokes. Play the scene straight.",
    "rare": "Only a rare dry aside, never slapstick.",
    "frequent": "Light banter and wry observations are welcome.",
    "comedy": "Comedic timing throughout; absurd situations are fine.",
}

LENGTH_DIRECTIVES = {
    True: "Write 3–5 evocative sentences.",
    False: "Write 1–2 tight sentences; report only what matters.",
}

# The GDD keeps mechanics in English and localizes narrative flavor. The engine
# emits English facts; the narrator describes them in the player's chosen language.

# Spells out the hard boundary so a chatty model cannot narrate a win it did not earn.
FACT_RULE = ("Narrate ONLY the supplied facts. Never invent or alter dice, hit points, damage, "
             "rewards, rule outcomes, or locations. You may describe what the facts imply, "
             "never what they contradict. Do not mention being an AI.")


class Narrator:
    """LLM boundary: model gets resolved facts and returns prose only."""

    @staticmethod
    def system_prompt(context: NarrationContext) -> str:
        language_code = normalize_narration_language(context.language)
        parts = [
            language_output_instruction(language_code),
            FACT_RULE,
            TONE_DIRECTIVES.get(context.tone, TONE_DIRECTIVES["balanced"]),
            HUMOR_DIRECTIVES.get(context.humor, HUMOR_DIRECTIVES["rare"]),
            LENGTH_DIRECTIVES[bool(context.verbose)],
        ]
        defeat = Narrator._defeat_scene_instruction(context)
        if defeat:
            parts.append(defeat)
        return " ".join(parts)

    @staticmethod
    def _defeat_scene_instruction(context: NarrationContext) -> str:
        if not context.defeat_facts:
            return ""
        location = context.defeat_facts.get("respawn_location", SAFE_RESPAWN_LOCATION)
        return (
            f"The player just experienced a defeat and woke at {location} with 1 HP. "
            "Describe this transition dramatically. Do not describe the fight continuing."
        )

    @staticmethod
    def _structured_facts(context: NarrationContext) -> str:
        facts = {
            "spell": context.spell_facts,
            "rest": context.rest_facts,
            "level_up": context.level_up_facts,
            "defeat": context.defeat_facts,
        }
        return json.dumps(
            {key: value for key, value in facts.items() if value},
            ensure_ascii=False,
        ) if any(facts.values()) else "(none)"

    async def narrate(self, context: NarrationContext) -> str:
        return (await self.narrate_detailed(context))[0]

    async def narrate_detailed(self, context: NarrationContext) -> tuple[str, str]:
        """Return (prose, status) so callers can tell narration from fallback.

        The status is what lets the API report honestly whether the model
        actually answered, instead of labelling fallback prose as narration.
        """
        settings = get_settings()
        provider = provider_for(settings)
        if provider is not None:
            try:
                async with _provider_gate(settings.llm_max_concurrency):
                    narration = await provider.complete(self._request(context))
                return narration, "narrated"
            except PROVIDER_ERRORS:
                # A local model that is slow, missing or misconfigured must never
                # take the turn down: the offline storyteller answers instead.
                pass
        request = self._request(context)
        return await OfflineProvider().complete(request), "fallback"

    async def stream(self, context: NarrationContext) -> AsyncIterator[str]:
        """Yield narration chunks after mechanics have already been committed."""
        settings = get_settings()
        provider = provider_for(settings)
        request = self._request(context)
        if provider is None:
            async for chunk in OfflineProvider().stream(request):
                yield chunk
            return
        async with _provider_gate(settings.llm_max_concurrency):
            async for chunk in provider.stream(request):
                yield chunk

    @staticmethod
    def narrate_offline(context: NarrationContext) -> str:
        """Deterministic prose with no network access, for the CLI and tests."""
        return render_offline(context)

    def _request(self, context: NarrationContext) -> NarrationRequest:
        facts = "\n".join(f"- {event}" for event in context.events)
        memories = "\n".join(f"- {memory}" for memory in context.memories[-5:]) or "(none)"
        language_code = normalize_narration_language(context.language)
        language_name = LANGUAGE_NAMES[language_code]
        defeat_line = self._defeat_scene_instruction(context)
        prompt = (
            f"Location: {context.location}\nPlayer action: {context.action}\n"
            f"Narration language: {language_name} ({language_code}); prose only — mechanics stay English.\n"
            f"Engine result:\n{facts}\n"
            f"Structured engine facts: {self._structured_facts(context)}\n"
            f"Previous beats:\n{memories}"
        )
        if defeat_line:
            prompt += f"\nScene directive: {defeat_line}"
        return NarrationRequest(
            context=context,
            system_prompt=self.system_prompt(context),
            user_prompt=prompt,
        )


_gates: dict[tuple[int, int], asyncio.Semaphore] = {}

def _provider_gate(limit: int):
    loop = asyncio.get_running_loop()
    key = (id(loop), max(1, int(limit)))
    gate = _gates.setdefault(key, asyncio.Semaphore(key[1]))
    return gate
