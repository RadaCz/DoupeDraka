from pydantic import BaseModel, Field

class UserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=32)
    password: str = Field(min_length=6, max_length=128)

class UserResponse(BaseModel):
    id: int
    username: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TelegramAuthRequest(BaseModel):
    """The raw initData query string produced by Telegram.WebApp.initData."""
    init_data: str = Field(min_length=1, max_length=8192)

class CharacterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=48)
    race: str
    character_class: str
    abilities: dict[str, int] | None = None
    background: str | None = None
    class_skills: list[str] | None = Field(default=None, max_length=6)
    equipment_package: str | None = None
    cantrips: list[str] | None = Field(default=None, max_length=6)
    level_one_spells: list[str] | None = Field(default=None, max_length=8)
    alignment: str | None = Field(default=None, max_length=48)
    ideal: str | None = Field(default=None, max_length=256)
    bond: str | None = Field(default=None, max_length=256)
    flaw: str | None = Field(default=None, max_length=256)
    backstory: str | None = Field(default=None, max_length=2048)
    fighting_style: str | None = Field(default=None, max_length=16)
    expertise_skills: list[str] | None = Field(default=None, max_length=4)
    divine_domain: str | None = Field(default=None, max_length=24)
    # Optional campaign settings applied at creation time.
    difficulty: str | None = None
    tone: str | None = None
    humor: str | None = None
    language: str | None = Field(default=None, max_length=8)

class CharacterSettings(BaseModel):
    """Partial update: every field is optional, absent means "leave as is"."""
    difficulty: str | None = None
    tone: str | None = None
    humor: str | None = None
    verbose: bool | None = None
    language: str | None = Field(default=None, max_length=8)

class CharacterTier(BaseModel):
    """Switch the model tier that priced each turn. Validated against economy.MODEL_TIERS."""
    tier: str = Field(max_length=16)

class ActionRequest(BaseModel):
    action: str = Field(min_length=1, max_length=1000)

class ActionResponse(BaseModel):
    events: list[str]
    narration: str
    character: dict
    # Paid-currency fields. Defaulted so clients written before the ledger work.
    energy_tenths: int = 0
    energy: float = 0.0
    tier: str = "normal"
    # "narrated" when the LLM wrote the prose, "fallback" when it was
    # unreachable and deterministic framing was used instead. The turn itself is
    # committed either way.
    narration_status: str = "narrated"
    spell_facts: dict | None = None
    rest_facts: dict | None = None
    level_up_facts: dict | None = None
    class_facts: dict | None = None

class TopUpRequest(BaseModel):
    package: str = Field(default="starter", max_length=32)

class CombatCalculatorRequest(BaseModel):
    party_levels: list[int] = Field(min_length=1, max_length=8)
    monsters: list[str] = Field(min_length=1, max_length=12)


class ShopItemStat(BaseModel):
    item_name: str
    purchases: int


class AdminStatsResponse(BaseModel):
    total_active_characters: int
    total_deaths: int
    average_deaths_per_character: float
    top_shop_items: list[ShopItemStat]
    llm_narration_turns: int
    llm_narration_fallback_turns: int
    llm_gateway_fallback_events: int
    llm_fallback_rate: float