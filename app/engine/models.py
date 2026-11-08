from dataclasses import dataclass, field

TONES = ("light", "balanced", "dark", "grimdark")
HUMORS = ("serious", "rare", "frequent", "comedy")
DIFFICULTIES = ("easy", "normal", "hard")

@dataclass
class CharacterState:
    id: str; owner_id: int; name: str; race: str; character_class: str
    level: int = 1; abilities: dict[str, int] = field(default_factory=dict)
    max_hp: int = 10; hp: int = 10; armor_class: int = 10
    mana: int = 0; max_mana: int = 0; xp: int = 0; gold: int = 0
    inventory: list[str] = field(default_factory=lambda: ["traveler's clothes", "shortsword"])
    item_instances: list[dict] = field(default_factory=list)
    combat_turn: str = "player"
    combat_round: int = 0
    location: str = "The Whispering Cellar"; in_combat: bool = False
    visited_locations: list[str] = field(default_factory=list)
    quest_flags: dict[str, bool] = field(default_factory=dict)
    combatant: dict | None = None
    exploration_cooldown: int = 0
    spell_slots: dict[int, int] = field(default_factory=dict)
    max_spell_slots: dict[int, int] = field(default_factory=dict)
    known_spells: list[str] = field(default_factory=list)
    prepared_spells: list[str] = field(default_factory=list)
    spellcasting_ability: str = ""
    invisible: bool = False
    # Explicit state for recovery/UX. Existing payloads default to alive.
    death_state: str = "alive"
    dodging: bool = False
    memory_summary: str = ""
    # Campaign settings. Every field is defaulted so character payloads stored
    # before these existed still decode cleanly.
    difficulty: str = "normal"; tone: str = "balanced"; humor: str = "rare"; verbose: bool = True
    narration_language: str = "en"

@dataclass
class MonsterState:
    name: str = "Goblin scout"; hp: int = 7; max_hp: int = 7; armor_class: int = 13
    attack_bonus: int = 4; damage: str = "1d6+2"
    # Defaulted so combatants persisted before rewards existed still decode.
    reward_xp: int = 50
    saving_throws: dict[str, int] = field(default_factory=dict)

@dataclass(frozen=True)
class RollResult:
    dice: str; values: tuple[int, ...]; modifier: int; total: int; critical: bool = False

@dataclass
class TurnResult:
    action: str; events: list[str]; state_changed: bool; combat_over: bool = False
    spell_facts: dict = field(default_factory=dict)
    rest_facts: dict = field(default_factory=dict)
    level_up_facts: dict = field(default_factory=dict)
    costs_adventure_mana: bool = True
