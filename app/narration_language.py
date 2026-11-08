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
    return (
        f"You are a D&D narrator. Write every sentence of story prose strictly in {language}. "
        f"Do not translate game mechanics: keep ability names, roll labels, and engine fact lines "
        f"(such as 'Dexterity check' or 'Attack roll') in English — the journal below repeats them verbatim."
    )
