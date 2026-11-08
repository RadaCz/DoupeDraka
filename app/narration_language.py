"""Supported narrator output languages (UI + engine mechanics stay separate)."""

LANGUAGE_NAMES: dict[str, str] = {
    "en": "English",
    "cs": "Czech",
    "ru": "Russian",
}

SUPPORTED_NARRATION_LANGUAGES = frozenset(LANGUAGE_NAMES)


def normalize_narration_language(code: str | None) -> str:
    if not code:
        return "en"
    base = code.strip().lower().split("-", 1)[0]
    return base if base in SUPPORTED_NARRATION_LANGUAGES else "en"


def language_output_instruction(language_code: str) -> str:
    """System-prompt fragment: prose language vs English mechanic lines."""
    lang = normalize_narration_language(language_code)
    language = LANGUAGE_NAMES[lang]
    parts = [
        f"You are a D&D narrator. Write every sentence of story prose strictly in {language} ({lang}). ",
        "Do not translate game mechanics: keep ability names, roll labels, and engine fact lines ",
        "(such as 'Dexterity check' or 'Attack roll') in English — the journal below repeats them verbatim.",
    ]
    if lang == "cs":
        parts.append(
            " Output the story strictly in Czech (cs). Do not use English for prose — "
            "only mechanic terms may stay in English."
        )
    return "".join(parts)
