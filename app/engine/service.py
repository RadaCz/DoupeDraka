import random, re, uuid
from . import catalog
from .catalog import ABILITY_ORDER, CLASSES, RACES, standard_abilities
from .encounters import (
    MONSTERS,
    build_monster,
    filter_encounter_pool,
    monster_allowed_for_character,
    monster_key_from_phrase,
    monster_template_key,
)
from .equipment import (
    STARTING_INVENTORY_BY_CLASS,
    apply_starting_equipment,
    attack_modifier,
    damage_modifier,
    default_item_instances,
    equip_item_from_query,
    equipped_weapon,
    item_attack_bonus,
    migrate_item_instances,
    refresh_armor_class,
    set_equipped_weapon,
    sync_item_instances,
    unequip_item,
)
from .character_creation import (
    CreationChoices,
    EXPLORE_SKILL_CUES,
    SKILL_ABILITIES,
    assemble_skill_proficiencies,
    racial_speed,
    resolve_creation_options,
    saving_throw_proficiencies,
)
from .combat_effects import ENEMY_SAVE_ABILITIES, try_vault_hazard, resolve_save_effect
from .saving_throws import SavingThrowRequest, perform_saving_throw, roll_result_compat
from .ruleset_v1 import MAX_MVP_LEVEL
from .intent import (
    AMBIGUOUS,
    ATTACK,
    CAST,
    DEFEND,
    EXPLORE,
    FLEE,
    QUEST,
    REJECTED,
    REST,
    SHOP,
    TALK,
    TRAVEL,
    UNKNOWN,
    USE_ITEM,
    EQUIP,
    parse_action_intent,
)
from .locations import LOCATIONS, is_travel_action, travel_allowed, travel_destination, visible_connections
from .shop import SHOP_LOCATION, match_shop_listing, shop_catalog_message
from .models import (
    DIFFICULTIES,
    HUMORS,
    SAFE_RESPAWN_LOCATION,
    TONES,
    CharacterState,
    MonsterState,
    RollResult,
    TurnResult,
)
from .spells import (
    CLASS_SPELL_LISTS,
    MODELED_SPELL_EFFECTS,
    SPELLCASTING_ABILITIES,
    advance_spellcasting,
    apply_creation_spell_choices,
    ensure_spellcasting,
    initialize_spellcasting,
    learn_level_up_spells,
    spell_level,
)
XP_THRESHOLD = 100  # XP needed per level
MANA_REGEN = 1  # mana restored after any costly turn

# Verbs the engine understands. Free text is mapped onto this closed set so a
# model can suggest an intent but can never invent a new mechanic.
ATTACK_VERBS = ("attack", "strike", "hit", "útok", "zaútoč")
ATTACK_TARGET_PATTERN = re.compile(
    r"\b(?:attack|strike|hit|útok|zaútoč\w*)\b\s*(?:the\s+)?(.+)$",
    re.IGNORECASE,
)
CAST_VERBS = ("cast", "kouzl")
REST_VERBS = ("rest", "sleep", "odpočiň", "odpočívat")
SHORT_REST_VERBS = ("short rest", "take a breather", "brief rest", "kratky odpocinek", "kratky oddech")
DEFEND_VERBS = ("dodge", "defend", "brace", "uhni", "bran", "on guard", "guard up")
ITEM_VERBS = ("use potion", "drink potion", "use item", "pouzij lektvar", "vypij lektvar")
SHOP_VERBS = ("buy", "purchase", "kup", "nakup")
FLEE_VERBS = ("flee", "retreat", "run away", "utek", "útěk")
EXPLORE_PHRASES = (
    "look around", "look for", "explore", "search", "investigate",
    "scout", "travel", "go to", "head to", "move to", "journey", "prowl",
    "jdi do", "vydej se", "průzkum", "prozkoumej",
    "rozhléd", "hledej", "prohledej", "cestuj", "putuj",
)
FLEE_DC = 10
ENCOUNTER_TRIGGER = 1
NARRATION_LANGUAGES = ("en", "cs")


def _mentions_token(text: str, tokens: tuple[str, ...]) -> bool:
    return any(re.search(rf"\b{re.escape(token)}\b", text) for token in tokens)

ACTION_ABILITIES = (
    ("strength", ("lift", "push", "pull", "break", "force", "shove", "climb", "grapple", "zved", "zatlac", "rozbij", "rozlom", "vypac")),
    ("dexterity", ("sneak", "hide", "dodge", "pick lock", "lockpick", "steal", "balance", "jump", "pliz", "schovej", "uhni", "zamek", "skoc")),
    ("constitution", ("endure", "resist", "hold breath", "withstand", "survive", "vydrz", "prezij", "odol")),
    ("intelligence", ("inspect", "investigate", "recall", "remember", "decipher", "solve", "analyze", "study", "examine", "prozkoumej", "prohliz", "prohled", "zanalyz")),
    ("wisdom", ("notice", "listen", "spot", "perceive", "track", "sense", "watch", "observe", "vsim", "poslouch", "naslouchej", "sleduj", "pozor")),
    ("charisma", ("talk", "persuade", "convince", "deceive", "lie", "intimidate", "perform", "negotiate", "mluv", "presved", "domluv", "lzi", "zastras", "vyjedn", "zazpivej")),
)


class GameEngine:
    """Rules only — no database, Telegram, or LLM calls here."""
    def __init__(self, rng: random.Random | None = None): self.rng = rng or random.Random()
    @staticmethod
    def modifier(score: int) -> int: return (score - 10) // 2

    def create_character(
        self,
        owner_id: int,
        name: str,
        race: str,
        character_class: str,
        abilities: dict[str, int] | None = None,
        *,
        background: str | None = None,
        class_skills: list[str] | None = None,
        equipment_package: str | None = None,
        cantrips: list[str] | None = None,
        level_one_spells: list[str] | None = None,
        personality: CreationChoices | None = None,
    ) -> CharacterState:
        if race not in RACES or character_class not in CLASSES:
            raise ValueError("Unknown race or class")

        base_scores, choices, inventory, gold = resolve_creation_options(
            race,
            character_class,
            abilities,
            background=background,
            class_skills=class_skills,
            equipment_package=equipment_package,
            cantrips=cantrips,
            level_one_spells=level_one_spells,
            personality=personality,
        )
        scores = catalog.apply_racial_ability_increases(race, base_scores)
        spec = CLASSES[character_class]
        hp = max(1, spec.hit_die + self.modifier(scores["constitution"]))
        mana = spec.mana + max(0, self.modifier(scores[spec.primary])) if spec.mana else 0
        if not inventory:
            inventory = list(STARTING_INVENTORY_BY_CLASS.get(character_class, ["traveler's clothes"]))

        character = CharacterState(
            str(uuid.uuid4()),
            owner_id,
            name.strip()[:48],
            race,
            character_class,
            abilities=scores,
            max_hp=hp,
            hp=hp,
            armor_class=10,
            mana=mana,
            max_mana=mana,
            inventory=inventory,
            gold=gold,
            background=choices.background,
            equipment_package=choices.equipment_package,
            skill_proficiencies=assemble_skill_proficiencies(
                race, character_class, choices.background, choices.class_skills
            ),
            saving_throw_proficiencies=saving_throw_proficiencies(character_class),
            speed=racial_speed(race),
            alignment=choices.alignment[:48],
            ideal=choices.ideal[:256],
            bond=choices.bond[:256],
            flaw=choices.flaw[:256],
            backstory=choices.backstory[:2048],
        )
        character.visited_locations = [character.location]
        apply_starting_equipment(character)
        initialize_spellcasting(character)
        if cantrips is not None or level_one_spells is not None:
            apply_creation_spell_choices(character, choices.cantrips, choices.level_one_spells)
        return character

    def roll(self, dice: str, modifier: int = 0, critical: bool = False) -> RollResult:
        match = re.fullmatch(r"(\d+)d(\d+)", dice)
        if not match: raise ValueError("Dice must use NdM format")
        count, sides = map(int, match.groups())
        if not (1 <= count <= 20 and 2 <= sides <= 100): raise ValueError("Unsupported dice")
        values = tuple(self.rng.randint(1, sides) for _ in range(count * (2 if critical else 1)))
        return RollResult(dice, values, modifier, sum(values) + modifier, critical)

    def _level_up(self, character: CharacterState) -> tuple[list[str], dict]:
        if character.level >= MAX_MVP_LEVEL or character.xp < XP_THRESHOLD:
            if character.level >= MAX_MVP_LEVEL:
                character.xp = min(character.xp, XP_THRESHOLD - 1)
            return [], {}
        ensure_spellcasting(character)
        character.xp -= XP_THRESHOLD
        character.level += 1
        spec = CLASSES[character.character_class]
        hp_roll = self.roll(f"1d{spec.hit_die}", self.modifier(character.abilities["constitution"]))
        hp_gained = max(1, hp_roll.total)
        character.max_hp += hp_gained
        character.hp = min(character.max_hp, character.hp + hp_gained)
        character.mana += spec.mana
        character.max_mana = character.mana
        advance_spellcasting(character)
        new_spells = learn_level_up_spells(character, self.rng)
        facts = {
            "new_level": character.level,
            "hp_gained": hp_gained,
            "current_hp": character.hp,
            "max_hp": character.max_hp,
            "spell_slots": dict(character.spell_slots),
            "max_spell_slots": dict(character.max_spell_slots),
            "new_spells": new_spells,
        }
        events = [
            f"LEVEL UP! You are now level {character.level}. Your maximum and current HP increase by {hp_gained}."
        ]
        if new_spells:
            events.append(f"New spells learned or prepared: {', '.join(new_spells)}.")
        return events, facts

    def _grant_xp(self, character: CharacterState, amount: int) -> tuple[list[str], dict]:
        if amount <= 0:
            return [], {}
        if character.level >= MAX_MVP_LEVEL:
            character.xp = min(character.xp, XP_THRESHOLD - 1)
            return [], {}
        character.xp += amount
        return self._level_up(character)

    @staticmethod
    def _spellcasting_modifier(character: CharacterState) -> int:
        ability = character.spellcasting_ability or SPELLCASTING_ABILITIES[character.character_class]
        ability_name = {"int": "intelligence", "wis": "wisdom", "cha": "charisma"}[ability]
        return GameEngine.modifier(character.abilities[ability_name])

    @staticmethod
    def _spell_attack_bonus(character: CharacterState) -> int:
        proficiency = 2 + max(0, (character.level - 1) // 4)
        return proficiency + GameEngine._spellcasting_modifier(character)

    @staticmethod
    def _cantrip_dice_count(level: int) -> int:
        return 1 + sum(level >= threshold for threshold in (5, 11, 17))

    @staticmethod
    def _spell_action_parts(text: str) -> tuple[str, str | None]:
        action = re.sub(r"\s+", " ", text.strip())
        match = re.match(r"^(?:cast|kouzli(?:t)?)\b\s*(.*)$", action, re.IGNORECASE)
        if not match:
            return "", None
        spell_and_target = match.group(1).strip()
        target_match = re.search(r"\s+at\s+", spell_and_target, re.IGNORECASE)
        if target_match:
            return spell_and_target[:target_match.start()].strip(), spell_and_target[target_match.end():].strip()
        return spell_and_target, None

    @staticmethod
    def _enemy_matches_target(monster: MonsterState, target: str) -> bool:
        target_key = re.sub(r"\s+", " ", target.strip()).casefold()
        enemy_name = re.sub(r"\s+", " ", monster.name.strip()).casefold()
        return target_key in {enemy_name, enemy_name.split(" ", 1)[0]}

    def _named_spell_target(self, character: CharacterState, target: str) -> MonsterState | None:
        key = monster_key_from_phrase(target)
        if key and monster_allowed_for_character(character, key):
            return build_monster(character.difficulty, key)
        return None

    @staticmethod
    def _attack_target_phrase(action: str) -> str | None:
        match = ATTACK_TARGET_PATTERN.search(action.strip())
        if not match:
            return None
        phrase = match.group(1).strip().rstrip(".!?")
        if not phrase:
            return None
        return phrase

    @staticmethod
    def _chapter_one_boss_rewards(character: CharacterState, monster_key: str) -> list[str]:
        from .economy_balance import CHAPTER_BOSS_GOLD_GP

        if monster_key != "bell_warden":
            return []
        if not monster_allowed_for_character(character, "bell_warden"):
            return []
        if character.quest_flags.get("chapter_one_complete"):
            return []
        character.quest_flags["chapter_one_complete"] = True
        character.gold += CHAPTER_BOSS_GOLD_GP
        return [
            "Chapter complete: the shrine's bells fall silent. "
            f"You claim {CHAPTER_BOSS_GOLD_GP} gold from the vault and earn a clear route back to the surface.",
        ]

    @staticmethod
    def _roll_facts(result: RollResult) -> dict:
        return {
            "dice": result.dice,
            "rolls": list(result.values),
            "modifier": result.modifier,
            "total": result.total,
        }

    @staticmethod
    def _recover_from_combat_defeat(character: CharacterState) -> list[str]:
        """MVP defeat: combat ends, hero wakes at the safe hub with 1 HP."""
        character.hp = 1
        character.location = SAFE_RESPAWN_LOCATION
        character.in_combat = False
        character.combat_turn = "player"
        character.combat_round = 0
        character.dodging = False
        character.invisible = False
        character.death_state = "alive"
        return [
            "Defeated in combat. You black out and wake at "
            f"{SAFE_RESPAWN_LOCATION} with 1 HP ({character.hp}/{character.max_hp}).",
        ]

    def _require_player_combat_turn(self, character: CharacterState, action: str) -> TurnResult | None:
        if character.in_combat and character.combat_turn != "player":
            return TurnResult(
                action,
                ["It is not your turn yet — wait until initiative returns to you."],
                False,
                costs_adventure_mana=False,
            )
        return None

    @staticmethod
    def _finish_player_combat_round(character: CharacterState) -> None:
        if character.in_combat:
            character.combat_turn = "player"
            character.combat_round += 1

    def _enemy_turn(self, character: CharacterState, monster: MonsterState, disadvantage: bool = False) -> list[str]:
        if character.hp <= 0:
            return []
        events: list[str] = []
        key = monster_template_key(monster)
        # every_turn save abilities (none in MVP catalog yet)
        pre_save, _pre_facts = self._enemy_save_ability(character, key, "every_turn")
        events.extend(pre_save)
        if character.hp <= 0:
            return events
        if disadvantage:
            enemy = self.roll("2d20", monster.attack_bonus)
            chosen = min(enemy.values[0], enemy.values[1])
            attack_total = chosen + enemy.modifier
            natural = chosen
        else:
            enemy = self.roll("1d20", monster.attack_bonus)
            attack_total = enemy.total
            natural = enemy.values[0]
        if natural == 1 or attack_total < character.armor_class:
            miss = [f"{monster.name}'s attack misses."]
            if disadvantage and natural != 1:
                miss = [f"{monster.name}'s disadvantaged attack misses. You keep your guard."]
            events.extend(miss)
            self._finish_player_combat_round(character)
            return events
        dice, _, bonus = monster.damage.partition("+")
        damage = self.roll(dice, int(bonus) if bonus else 0, natural == 20)
        character.hp = max(0, character.hp - damage.total)
        events.append(f"{monster.name} hits you for {damage.total}. Your HP: {character.hp}/{character.max_hp}.")
        post_save, _post_facts = self._enemy_save_ability(character, key, "on_hit")
        events.extend(post_save)
        if character.hp == 0:
            events.extend(self._recover_from_combat_defeat(character))
            return events
        self._finish_player_combat_round(character)
        return events

    def _use_item(self, character: CharacterState, action: str, monster: MonsterState | None) -> tuple[TurnResult, MonsterState | None]:
        if monster is not None and character.in_combat:
            blocked = self._require_player_combat_turn(character, action)
            if blocked:
                return blocked, monster
        potion = next((item for item in character.inventory if "potion" in item.casefold()), None)
        if potion is None:
            return TurnResult(action, ["You have no usable potion."], False), monster
        if character.hp >= character.max_hp:
            return TurnResult(action, ["You are already at full health."], False), monster
        healing = self.roll("2d4", self.modifier(character.abilities.get("constitution", 10)) + 2)
        amount = min(character.max_hp - character.hp, max(1, healing.total))
        character.hp += amount
        character.inventory.remove(potion)
        sync_item_instances(character)
        events = [f"You drink a healing potion and recover {amount} HP. Your HP: {character.hp}/{character.max_hp}."]
        if monster and character.in_combat:
            events.extend(self._enemy_turn(character, monster))
        return TurnResult(action, events, True), None if not character.in_combat else monster

    def _equip_item(
        self, character: CharacterState, action: str, monster: MonsterState | None
    ) -> tuple[TurnResult, MonsterState | None]:
        if monster is not None and character.in_combat:
            blocked = self._require_player_combat_turn(character, action)
            if blocked:
                return blocked, monster
        from .intent import EQUIP_PATTERN, UNEQUIP_PATTERN

        unequip_match = UNEQUIP_PATTERN.search(action)
        if unequip_match:
            ok, message = unequip_item(character, unequip_match.group(1).strip())
        else:
            match = EQUIP_PATTERN.search(action)
            query = match.group(1).strip() if match else action
            ok, message = equip_item_from_query(character, query)
        if not ok:
            return TurnResult(action, [message], False, costs_adventure_mana=False), monster
        return TurnResult(action, [message], True, costs_adventure_mana=False), monster

    def _shop(self, character: CharacterState, action: str) -> TurnResult:
        if character.location != SHOP_LOCATION:
            return TurnResult(action, ["There is no shop here."], False)
        listing = match_shop_listing(action)
        if listing is None:
            return TurnResult(action, [shop_catalog_message()], False)
        if listing.inventory_label.casefold() in {item.casefold() for item in character.inventory}:
            return TurnResult(action, [f"You already carry {listing.shelf_name}."], False)
        if character.gold < listing.price_gp:
            return TurnResult(
                action,
                [f"{listing.shelf_name} costs {listing.price_gp} gp. You cannot afford it (you have {character.gold} gp)."],
                False,
            )
        character.gold -= listing.price_gp
        character.inventory.append(listing.inventory_label)
        sync_item_instances(character)
        return TurnResult(
            action,
            [f"You buy {listing.shelf_name} from Nib for {listing.price_gp} gp."],
            True,
            purchase_facts={
                "item_name": listing.shelf_name,
                "gold_spent": listing.price_gp,
            },
        )

    def _cast_spell(
        self, character: CharacterState, action: str, monster: MonsterState | None
    ) -> tuple[TurnResult, MonsterState | None]:
        if character.in_combat:
            blocked = self._require_player_combat_turn(character, action)
            if blocked:
                return blocked, monster
        spell_name, target_name = self._spell_action_parts(action)
        if not spell_name:
            return TurnResult(action, ["Name a spell to cast. No spell slot was spent."], False), monster

        if (
            character.character_class in {"paladin", "ranger"}
            and character.level < 2
            and re.sub(r"\s+", " ", spell_name).casefold()
            in {name.casefold() for name in CLASS_SPELL_LISTS[character.character_class][1]}
        ):
            return TurnResult(
                action,
                ["You have no spell slots yet. Paladins and rangers gain their first slots at level 2."],
                False,
                spell_facts={
                    "spell_name": spell_name,
                    "spell_level": 1,
                    "slot_level": None,
                    "slot_consumed": False,
                    "effect": {"type": "unavailable"},
                    "target_hp_after": monster.hp if monster else None,
                    "save_result": None,
                },
            ), monster

        accessible = character.known_spells + character.prepared_spells
        normalized_name = re.sub(r"\s+", " ", spell_name).casefold()
        selected = next(
            (known for known in accessible if re.sub(r"\s+", " ", known).casefold() == normalized_name),
            None,
        )
        if selected is None:
            catalog_level = spell_level(spell_name)
            message = (
                f"You have not learned or prepared {spell_name}. No spell slot was spent."
                if catalog_level is not None
                else f"Spell '{spell_name}' is not implemented or in your spell list. No spell slot was spent."
            )
            facts = {
                "spell_name": spell_name,
                "spell_level": catalog_level,
                "slot_level": None,
                "slot_consumed": False,
                "effect": {"type": "unavailable"},
                "target_hp_after": monster.hp if monster else None,
                "save_result": None,
            }
            return TurnResult(action, [message], False, spell_facts=facts), monster

        level = spell_level(selected)
        if level is None:
            return TurnResult(action, [f"{selected} is not in the SRD spell catalog. No spell slot was spent."], False), monster
        modeled = MODELED_SPELL_EFFECTS.get(selected)
        if modeled is None:
            facts = {
                "spell_name": selected,
                "spell_level": level,
                "slot_level": None,
                "slot_consumed": False,
                "effect": {"type": "not_modeled"},
                "target_hp_after": monster.hp if monster else None,
                "save_result": None,
            }
            return TurnResult(
                action,
                [f"Spell resolved, effect not yet modeled: {selected}. No spell slot was spent."],
                False,
                spell_facts=facts,
            ), monster

        kind, dice, save_ability, save_on_success = modeled
        if kind == "escape" and monster is None and not character.in_combat:
            facts = {
                "spell_name": selected,
                "spell_level": level,
                "slot_level": None,
                "slot_consumed": False,
                "effect": {"type": "no_destination"},
                "target_hp_after": None,
                "save_result": None,
            }
            return TurnResult(
                action,
                [f"{selected} has no modeled destination outside combat. No spell slot was spent."],
                False,
                spell_facts=facts,
            ), monster
        slot_level = None
        if level > 0:
            available_slots = {
                int(slot): count for slot, count in character.spell_slots.items()
            }
            slot_level = next(
                (slot for slot in sorted(available_slots) if slot >= level and available_slots[slot] > 0),
                None,
            )
            if slot_level is None:
                facts = {
                    "spell_name": selected, "spell_level": level, "slot_level": None,
                    "slot_consumed": False, "effect": {"type": "unavailable"},
                    "target_hp_after": monster.hp if monster else None, "save_result": None,
                }
                return TurnResult(
                    action,
                    [f"You have no level {level} spell slots available. No slot was spent."],
                    False,
                    spell_facts=facts,
                ), monster

        damage_kind = kind in {"spell_attack", "multi_attack", "auto_damage", "save_damage"}
        if damage_kind:
            if monster and target_name and not self._enemy_matches_target(monster, target_name):
                facts = {
                    "spell_name": selected, "spell_level": level, "slot_level": None,
                    "slot_consumed": False, "effect": {"type": "unavailable"},
                    "target_hp_after": monster.hp, "save_result": None,
                }
                return TurnResult(
                    action,
                    [f"{target_name} is not the active enemy. No spell slot was spent."],
                    False,
                    spell_facts=facts,
                ), monster
            if monster is None and target_name:
                monster = self._named_spell_target(character, target_name)
                if monster is None:
                    return TurnResult(
                        action,
                        [f"No known enemy matches {target_name}. No spell slot was spent."],
                        False,
                        spell_facts={
                            "spell_name": selected, "spell_level": level, "slot_level": None,
                            "slot_consumed": False, "effect": {"type": "unavailable"},
                            "target_hp_after": None, "save_result": None,
                        },
                    ), None
            if monster is None:
                return TurnResult(
                    action,
                    [f"{selected} needs a target. Explore first or name an enemy. No spell slot was spent."],
                    False,
                    spell_facts={
                        "spell_name": selected, "spell_level": level, "slot_level": None,
                        "slot_consumed": False, "effect": {"type": "unavailable"},
                        "target_hp_after": None, "save_result": None,
                    },
                ), None
        elif target_name and target_name.casefold() not in {
            "self", "you", "me", "myself", character.name.casefold()
        }:
            return TurnResult(
                action,
                [f"{selected} can only target you in this solo adventure. No spell slot was spent."],
                False,
                spell_facts={
                    "spell_name": selected, "spell_level": level, "slot_level": None,
                    "slot_consumed": False, "effect": {"type": "unavailable"},
                    "target_hp_after": None, "save_result": None,
                },
            ), monster

        if kind == "heal" and character.hp >= character.max_hp:
            return TurnResult(
                action,
                ["You are already at full health. No spell slot was spent."],
                False,
                spell_facts={
                    "spell_name": selected, "spell_level": level, "slot_level": None,
                    "slot_consumed": False, "effect": {"type": "heal", "healing": 0},
                    "target_hp_after": None, "save_result": None,
                },
            ), monster

        if character.invisible and selected != "Invisibility":
            character.invisible = False

        if monster and damage_kind:
            character.in_combat = True

        ability_bonus = self._spell_attack_bonus(character)
        upcast = max(0, (slot_level or level) - level)
        effect_facts: dict = {"type": kind}
        save_result = None
        events: list[str] = []
        damage = 0

        if kind == "heal":
            extra_dice = upcast
            healing = self.roll(
                f"{1 + extra_dice}d{dice.split('d', 1)[1]}",
                self._spellcasting_modifier(character),
            )
            before = character.hp
            character.hp = min(character.max_hp, character.hp + max(0, healing.total))
            amount = character.hp - before
            effect_facts.update({"dice_result": self._roll_facts(healing), "healing": amount})
            if selected == "Healing Word":
                effect_facts["bonus_action_not_applied"] = True
                events.append(
                    f"{selected} restores {amount} HP as your main action in this MVP; bonus-action timing is not modeled."
                )
            else:
                events.append(f"{selected} restores {amount} HP. Your HP: {character.hp}/{character.max_hp}.")
        elif kind == "auto_damage":
            darts = 3 + upcast
            rolls = [self.roll("1d4", 1) for _ in range(darts)]
            damage = sum(roll.total for roll in rolls)
            effect_facts.update({
                "darts": [self._roll_facts(roll) for roll in rolls],
                "damage": damage,
            })
            events.append(f"{selected} hits automatically with {darts} darts for {damage} damage.")
        elif kind in {"spell_attack", "multi_attack"}:
            if selected == "Scorching Ray":
                beams = 3 + upcast
            elif selected == "Eldritch Blast":
                beams = self._cantrip_dice_count(character.level)
            else:
                beams = 1
            damage_die = dice.split("d", 1)[1]
            damage_count = (
                int(dice.split("d", 1)[0]) if kind == "multi_attack" else
                self._cantrip_dice_count(character.level) if selected == "Fire Bolt" else 1
            )
            attacks = []
            total_damage = 0
            for _ in range(beams):
                attack_roll = self.roll("1d20", ability_bonus)
                hit = attack_roll.values[0] == 20 or (
                    attack_roll.values[0] != 1 and attack_roll.total >= monster.armor_class
                )
                attack_facts = {"roll": self._roll_facts(attack_roll), "hit": hit}
                if hit:
                    critical = attack_roll.values[0] == 20
                    rolled = self.roll(
                        f"{damage_count}d{damage_die}",
                        critical=critical,
                    )
                    total_damage += rolled.total
                    attack_facts["damage_roll"] = self._roll_facts(rolled)
                attacks.append(attack_facts)
            damage = total_damage
            effect_facts.update({"attacks": attacks, "damage": damage})
            if damage:
                events.append(f"{selected} hits {monster.name} for {damage} damage.")
            else:
                events.append(f"{selected} misses {monster.name}.")
        elif kind == "escape":
            escaped = monster is not None or character.in_combat
            if escaped:
                character.in_combat = False
                character.exploration_cooldown = 1
                monster = None
            effect_facts.update({"escaped_combat": escaped})
            events.append(
                f"{selected} lets you blink to a nearby safe space and escape combat."
                if escaped else
                f"{selected} lets you blink to a nearby space; this adventure has no mapped distance to track."
            )
        elif kind == "condition":
            character.invisible = True
            effect_facts.update({"condition": "invisible", "active": True})
            events.append(
                "You become invisible. The modeled invisibility ends when you attack or cast another spell."
            )
        else:
            damage_count = int(dice.split("d", 1)[0]) + upcast
            if level == 0:
                damage_count += self._cantrip_dice_count(character.level) - 1
            damage_die = dice.split("d", 1)[1]
            rolled = self.roll(f"{damage_count}d{damage_die}")
            save_roll = self.roll("1d20", monster.saving_throws.get(save_ability, 0))
            saved = save_roll.total >= 8 + (2 + max(0, (character.level - 1) // 4)) + ability_bonus
            damage = rolled.total
            if saved:
                damage = damage // 2 if save_on_success == "half" else 0
            save_result = {
                "ability": save_ability,
                "roll": self._roll_facts(save_roll),
                "dc": 8 + (2 + max(0, (character.level - 1) // 4)) + ability_bonus,
                "succeeded": saved,
            }
            effect_facts.update({
                "dice_result": self._roll_facts(rolled),
                "damage": damage,
                "debuff_not_applied": selected == "Vicious Mockery" and not saved,
            })
            events.append(
                f"{monster.name} {'succeeds' if saved else 'fails'} a {save_ability.title()} save against {selected} "
                f"(DC {save_result['dc']}); takes {damage} damage."
            )
            if effect_facts["debuff_not_applied"]:
                events.append("Vicious Mockery's attack-disadvantage effect is not modeled.")

        if monster and damage_kind:
            monster.hp = max(0, monster.hp - max(0, damage))
        slot_consumed = slot_level is not None
        if slot_consumed:
            character.spell_slots[slot_level] = max(0, character.spell_slots.get(slot_level, 0) - 1)
            if character.spell_slots[slot_level] == 0:
                del character.spell_slots[slot_level]
            events.append(f"Spell slot level {slot_level} spent; remaining slots: {character.spell_slots}.")

        level_up_facts: dict = {}
        combat_over = bool(effect_facts.get("escaped_combat"))
        if monster and monster.hp == 0:
            character.in_combat = False
            character.exploration_cooldown = 1
            defeated_key = monster_template_key(monster)
            level_events, level_up_facts = self._grant_xp(character, monster.reward_xp)
            events.append(f"{monster.name} is defeated. You gain {monster.reward_xp} XP.")
            events.extend(self._chapter_one_boss_rewards(character, defeated_key))
            from .chapter_one_progression import (
                award_vault_first_descent_story_xp,
                on_vault_descent_victory,
            )

            on_vault_descent_victory(character)
            story_events, story_facts, _ = award_vault_first_descent_story_xp(
                character, self._level_up,
            )
            events.extend(story_events)
            if story_facts:
                level_up_facts = {**level_up_facts, **story_facts}
            events.extend(level_events)
            combat_over = True
            monster = None
        elif monster:
            events.append(f"{monster.name} has {monster.hp}/{monster.max_hp} HP.")
            events.extend(self._enemy_turn(character, monster))
            monster = None if not character.in_combat else monster

        facts = {
            "spell_name": selected,
            "spell_level": level,
            "slot_level": slot_level,
            "slot_consumed": slot_consumed,
            "effect": effect_facts,
            "target_hp_after": (
                character.hp if kind == "heal" else
                monster.hp if monster else (0 if combat_over and damage_kind else None)
            ),
            "save_result": save_result,
        }
        return TurnResult(
            action, events, True, combat_over, facts,
            level_up_facts=level_up_facts if combat_over else {},
        ), monster

    def _regenerate_mana(self, character: CharacterState) -> None:
        """Restore a little mana so spellcasting is not a one-way resource."""
        if character.max_mana and character.mana < character.max_mana:
            character.mana = min(character.max_mana, character.mana + MANA_REGEN)

    def _random_encounter(self, character: CharacterState) -> MonsterState:
        """Pick a threat suitable for the character's current tier."""
        location = LOCATIONS.get(character.location)
        pool = list(location.encounter_pool) if location else ["kobold", "goblin", "wolf", "bandit"]
        eligible = filter_encounter_pool(pool, character.level)
        return build_monster(character.difficulty, self.rng.choice(eligible))

    def _travel(self, character: CharacterState, action: str) -> tuple[TurnResult, MonsterState | None]:
        destination = travel_destination(character.location, action)
        current = LOCATIONS.get(character.location)
        if destination is None:
            open_routes = visible_connections(character.location, character.quest_flags)
            if current is None or not open_routes:
                message = "You cannot find a known route from here."
            else:
                message = f"That route is not open. Nearby destinations: {', '.join(open_routes)}."
            return TurnResult(action, [message], False), None
        if not travel_allowed(destination, character.quest_flags):
            return TurnResult(
                action,
                ["That path is still sealed. Caldus must reveal the vault route before you can enter."],
                False,
            ), None

        if character.location not in character.visited_locations:
            character.visited_locations.append(character.location)
        character.location = destination
        location = LOCATIONS[destination]
        first_visit = destination not in character.visited_locations
        if first_visit:
            character.visited_locations.append(destination)
        events = [f"You travel to {destination}."]
        if first_visit:
            events.append(location.arrival_beat)

        from .chapter_one_progression import begin_vault_first_descent

        descent_events, descent_monster = begin_vault_first_descent(
            character, difficulty=character.difficulty,
        )
        if descent_events:
            events.extend(descent_events)
        return TurnResult(action, events, True), descent_monster

    def _resolve_quest_action(self, character: CharacterState, action: str, step: str) -> TurnResult | None:
        from .quests import resolve_main_quest_step

        return resolve_main_quest_step(character, action, step, self._level_up)

    def _explore(self, character: CharacterState, action: str) -> tuple[TurnResult, MonsterState | None]:
        from .quests import try_side_quest_explore

        side = try_side_quest_explore(character, action, self._level_up)
        if side is not None:
            return side, None

        hazard = try_vault_hazard(self, character, action)
        if hazard is not None:
            hazard_events, save_facts = hazard
            return TurnResult(
                action,
                hazard_events,
                True,
                save_facts=save_facts,
                costs_adventure_mana=False,
            ), None

        if character.exploration_cooldown:
            character.exploration_cooldown -= 1
            return TurnResult(
                action,
                ["You take a moment to catch your breath. No new threat appears."],
                True,
            ), None

        encounter_roll = self.roll("1d6")
        if encounter_roll.total == ENCOUNTER_TRIGGER:
            monster = self._random_encounter(character)
            character.in_combat = True
            character.combat_turn = "player"
            character.combat_round = 0
            character.exploration_cooldown = 1
            return TurnResult(
                action,
                [
                    f"Exploration roll: {encounter_roll.total} on a six-sided die.",
                    f"An enemy appears: {monster.name} ({monster.hp} HP).",
                    "The creature has not attacked yet. Choose your next action.",
                ],
                True,
            ), monster

        state_changed = True
        if encounter_roll.total == 3:
            from .economy_balance import roll_exploration_gold

            gold = self.roll("1d4").total
            discovery, state_changed = roll_exploration_gold(character, gold)
        elif encounter_roll.total == 2:
            from .discoveries import exploration_discovery_message

            discovery, is_new = exploration_discovery_message(character, kind="track")
            state_changed = is_new
        elif encounter_roll.total == 4:
            from .discoveries import exploration_discovery_message

            discovery, is_new = exploration_discovery_message(character, kind="clue")
            state_changed = is_new
        else:
            discovery = "You explore the area but find no immediate threat."
        return TurnResult(
            action,
            [f"Exploration roll: {encounter_roll.total} on a six-sided die.", discovery],
            state_changed,
        ), None

    def apply_settings(
        self,
        character: CharacterState,
        difficulty: str | None = None,
        tone: str | None = None,
        humor: str | None = None,
        verbose: bool | None = None,
        language: str | None = None,
    ) -> CharacterState:
        """Validate campaign settings. Unknown values raise so the API can answer 422."""
        for value, allowed, label in (
            (difficulty, DIFFICULTIES, "difficulty"),
            (tone, TONES, "tone"),
            (humor, HUMORS, "humor"),
            (language, NARRATION_LANGUAGES, "language"),
        ):
            if value is not None and value not in allowed:
                raise ValueError(f"Unknown {label}: {value}. Expected one of {', '.join(allowed)}.")
        if difficulty is not None: character.difficulty = difficulty
        if tone is not None: character.tone = tone
        if humor is not None: character.humor = humor
        if verbose is not None: character.verbose = bool(verbose)
        if language is not None:
            character.narration_language = language
        return character

    def _d20_check(self, character: CharacterState, modifier: int) -> tuple[RollResult, str]:
        roll = self.roll("1d20", modifier)
        note = ""
        if character.race == "halfling" and roll.values[0] == 1:
            roll = self.roll("1d20", modifier)
            note = f" Halfling Lucky: 1 → {roll.values[0]}."
        return roll, note

    def ability_check(self, character: CharacterState, ability: str, dc: int) -> tuple[RollResult, bool, str]:
        result, note = self._d20_check(character, self.modifier(character.abilities[ability]))
        return result, result.total >= dc, note

    def resolve_saving_throw(
        self,
        character: CharacterState,
        request: SavingThrowRequest,
    ):
        from .saving_throws import SavingThrowResult

        return perform_saving_throw(self, character, request)

    def saving_throw(self, character: CharacterState, ability: str, dc: int) -> tuple[RollResult, bool, str]:
        request = SavingThrowRequest(
            ability=ability,
            dc=dc,
            source="action",
            source_id="explicit_save",
        )
        outcome = perform_saving_throw(self, character, request)
        return roll_result_compat(outcome), outcome.success, outcome.lucky_note

    def _enemy_save_ability(
        self,
        character: CharacterState,
        monster_key: str,
        trigger: str,
    ) -> tuple[list[str], dict]:
        ability_def = ENEMY_SAVE_ABILITIES.get(monster_key)
        if ability_def is None or ability_def.trigger != trigger:
            return [], {}
        from .combat_effects import ONCE_PER_COMBAT_SAVE_IDS, _combat_save_flag

        if ability_def.source_id in ONCE_PER_COMBAT_SAVE_IDS:
            flag = _combat_save_flag(ability_def)
            if character.quest_flags.get(flag):
                return [], {}
            character.quest_flags[flag] = True
        result, damage, events = resolve_save_effect(self, character, ability_def)
        return events, {"save": result.to_facts(), "damage": damage, "ability_id": ability_def.source_id}

    def skill_modifier(self, character: CharacterState, skill: str) -> int:
        ability = SKILL_ABILITIES.get(skill, "dexterity")
        base = self.modifier(character.abilities.get(ability, 10))
        prof = 2 + max(0, (character.level - 1) // 4)
        if skill in character.skill_proficiencies:
            return base + prof
        return base

    def skill_check(self, character: CharacterState, skill: str, dc: int) -> tuple[RollResult, bool, str]:
        result, note = self._d20_check(character, self.skill_modifier(character, skill))
        return result, result.total >= dc, note

    @staticmethod
    def _explore_skill_for_text(text: str) -> str | None:
        lowered = text.casefold()
        for skill, cues in EXPLORE_SKILL_CUES.items():
            if any(cue in lowered for cue in cues):
                return skill
        return None

    @staticmethod
    def _ability_for_action(text: str) -> str:
        for ability, cues in ACTION_ABILITIES:
            if any(re.search(rf"\b{re.escape(cue)}", text) for cue in cues):
                return ability
        return "dexterity"

    def _roll_initiative(self, character: CharacterState, monster: MonsterState) -> list[str]:
        player = self.roll("1d20", self.modifier(character.abilities.get("dexterity", 10)))
        enemy_initiative = monster.saving_throws.get("dexterity", 0)
        enemy = self.roll("1d20", enemy_initiative)
        character.combat_round = 1
        if enemy.total > player.total:
            character.combat_turn = "enemy"
            order = f"{monster.name} acts first"
        else:
            character.combat_turn = "player"
            order = "You act first"
        return [
            f"Initiative: you {player.total} (DEX), {monster.name} {enemy.total} (DEX). {order}.",
        ]

    def attack(self, character: CharacterState, monster: MonsterState) -> list[str]:
        weapon = equipped_weapon(character)
        bonus = attack_modifier(character, weapon) + item_attack_bonus(character)
        attack_roll, lucky_note = self._d20_check(character, bonus)
        natural = attack_roll.values[0]
        weapon_label = weapon.name if weapon.key != "unarmed" else "your weapon"
        if natural == 1:
            return [f"Attack with {weapon_label}: {attack_roll.total} (d20 +{bonus}) — critical miss.{lucky_note}"]
        if natural != 20 and attack_roll.total < monster.armor_class:
            return [
                f"Attack with {weapon_label}: {attack_roll.total} (d20 +{bonus}) vs AC {monster.armor_class} — miss.{lucky_note}",
            ]
        damage = self.roll(weapon.damage, damage_modifier(character, weapon), natural == 20)
        monster.hp = max(0, monster.hp - max(1, damage.total))
        return [
            f"Attack with {weapon_label}: {attack_roll.total} (d20 +{bonus}) — hit.{lucky_note}",
            f"Damage {damage.total} ({weapon.damage} + modifier); {monster.name} has {monster.hp}/{monster.max_hp} HP.",
        ]

    def _resolve_attack_turn(
        self,
        character: CharacterState,
        action: str,
        monster: MonsterState | None,
    ) -> tuple[TurnResult, MonsterState | None]:
        character.invisible = False
        fresh_combat = monster is None and not character.in_combat
        events: list[str] = []
        if fresh_combat:
            phrase = self._attack_target_phrase(action)
            target_key = monster_key_from_phrase(phrase) if phrase else None
            if target_key is None:
                return (
                    TurnResult(
                        action,
                        ["No enemy is in front of you. Explore the area or wait for a threat to appear."],
                        False,
                    ),
                    None,
                )
            if not monster_allowed_for_character(character, target_key):
                from .encounters import attack_block_message

                return (
                    TurnResult(
                        action,
                        [attack_block_message(character, target_key)],
                        False,
                    ),
                    None,
                )
            monster = build_monster(character.difficulty, target_key)
        elif monster is None:
            return (
                TurnResult(action, ["No enemy is in front of you."], False),
                None,
            )
        if fresh_combat:
            character.in_combat = True
            events.extend(self._roll_initiative(character, monster))
            if character.combat_turn == "enemy":
                events.extend(self._enemy_turn(character, monster))
                if not character.in_combat:
                    return TurnResult(action, events, True, True), None
        elif not character.in_combat:
            character.in_combat = True
            events.extend(self._roll_initiative(character, monster))
            if character.combat_turn == "enemy":
                events.extend(self._enemy_turn(character, monster))
                if not character.in_combat:
                    return TurnResult(action, events, True, True), None
        blocked = self._require_player_combat_turn(character, action)
        if blocked:
            return blocked, monster
        events.extend(self.attack(character, monster))
        if monster.hp == 0:
            character.in_combat = False
            reward = monster.reward_xp
            defeated_key = monster_template_key(monster)
            character.exploration_cooldown = 1
            level_events, level_up_facts = self._grant_xp(character, reward)
            events.append(f"{monster.name} is defeated. You gain {reward} XP.")
            events.extend(self._chapter_one_boss_rewards(character, defeated_key))
            from .chapter_one_progression import (
                award_vault_first_descent_story_xp,
                on_vault_descent_victory,
            )

            on_vault_descent_victory(character)
            story_events, story_facts, _ = award_vault_first_descent_story_xp(
                character, self._level_up,
            )
            events.extend(story_events)
            if story_facts:
                level_up_facts = {**level_up_facts, **story_facts}
            events.extend(level_events)
            return TurnResult(action, events, True, True, level_up_facts=level_up_facts), None
        events.extend(self._enemy_turn(character, monster))
        self._regenerate_mana(character)
        return TurnResult(action, events, True), None if not character.in_combat else monster

    def resolve_action(self, character: CharacterState, action: str, monster: MonsterState | None) -> tuple[TurnResult, MonsterState | None]:
        if character.hp <= 0:
            return TurnResult(action, [f"{character.name} has fallen and can no longer act."], False), monster
        text = action.lower().strip()
        if not text:
            return TurnResult(action, ["Say what your character attempts."], False), monster
        intent = parse_action_intent(action)
        if intent.kind == AMBIGUOUS:
            return TurnResult(
                action,
                ["Your command mixes conflicting goals — choose attack, talk, movement, or magic clearly."],
                False,
                costs_adventure_mana=False,
            ), monster
        if intent.kind == UNKNOWN:
            return TurnResult(action, ["Say what your character attempts."], False), monster
        if intent.kind == REJECTED:
            return TurnResult(
                action,
                ["You hold back and do nothing — the game state is unchanged."],
                False,
                costs_adventure_mana=False,
            ), monster

        if intent.kind == QUEST:
            quest_result = self._resolve_quest_action(character, action, intent.quest_step)
            if quest_result is not None:
                return quest_result, monster
            return TurnResult(action, ["That quest step cannot be resolved here."], False, costs_adventure_mana=False), monster

        if intent.kind == SHOP:
            return self._shop(character, action), monster
        if intent.kind == USE_ITEM:
            return self._use_item(character, action, monster)

        if intent.kind == EQUIP:
            return self._equip_item(character, action, monster)

        if intent.kind == DEFEND:
            if monster is None or not character.in_combat:
                return TurnResult(action, ["You take a guarded stance, but there is no active enemy."], False), monster
            blocked = self._require_player_combat_turn(character, action)
            if blocked:
                return blocked, monster
            character.dodging = True
            events = ["You dodge and gain disadvantage protection against the next enemy attack."]
            events.extend(self._enemy_turn(character, monster, disadvantage=True))
            character.dodging = False
            return TurnResult(action, events, True), monster if character.in_combat else None

        if intent.kind == REST:
            from .economy_balance import (
                clear_short_rest_gate,
                long_rest_allowed,
                mark_short_rest,
                short_rest_allowed,
            )

            if any(phrase in text for phrase in SHORT_REST_VERBS):
                if monster is not None or character.in_combat:
                    return TurnResult(action, ["You cannot take a short rest while a fight is raging."], False), monster
                if not short_rest_allowed(character):
                    return TurnResult(
                        action,
                        ["You already caught your breath recently. Take a long rest in a safe camp to recover fully."],
                        False,
                        costs_adventure_mana=False,
                    ), monster
                healing = self.roll("1d6", self.modifier(character.abilities.get("constitution", 10)))
                restored = min(character.max_hp - character.hp, max(0, healing.total))
                if restored <= 0:
                    return TurnResult(
                        action,
                        ["You are already at full health — a short rest changes nothing."],
                        False,
                        costs_adventure_mana=False,
                    ), monster
                character.hp += restored
                mark_short_rest(character)
                return TurnResult(
                    action,
                    [f"You take a short rest and recover {restored} HP. Your HP: {character.hp}/{character.max_hp}."],
                    True,
                    costs_adventure_mana=False,
                    rest_facts={"kind": "short", "hp_restored": restored},
                ), monster
            if monster is not None or character.in_combat:
                return TurnResult(action, ["You cannot rest while a fight is still raging."], False), monster
            if not long_rest_allowed(character):
                return TurnResult(
                    action,
                    [
                        "You cannot take a long rest here — the ruins are too exposed. "
                        "Retreat to the Whispering Cellar, the shrine, or Nib's market.",
                    ],
                    False,
                    costs_adventure_mana=False,
                ), monster
            character.spell_slots = {int(level): int(count) for level, count in character.spell_slots.items()}
            character.max_spell_slots = {int(level): int(count) for level, count in character.max_spell_slots.items()}
            hp_restored = character.max_hp - character.hp
            slots_restored = {
                int(level): max(0, count - character.spell_slots.get(int(level), 0))
                for level, count in character.max_spell_slots.items()
                if count > character.spell_slots.get(int(level), 0)
            }
            if not hp_restored and not slots_restored:
                return TurnResult(
                    action,
                    ["You are already at full health and all spell slots are restored."],
                    False,
                    costs_adventure_mana=False,
                ), monster
            character.hp = character.max_hp
            character.spell_slots = {
                int(level): count for level, count in character.max_spell_slots.items() if count > 0
            }
            clear_short_rest_gate(character)
            slot_total = sum(slots_restored.values())
            events = [
                f"You take a long rest and recover {hp_restored} HP; all spell slots are restored."
                if slot_total
                else f"You take a long rest and recover {hp_restored} HP."
            ]
            return TurnResult(
                action,
                events,
                True,
                rest_facts={
                    "hp_restored": hp_restored,
                    "slots_restored": slots_restored,
                    "slots_restored_total": slot_total,
                },
                costs_adventure_mana=False,
            ), monster

        if intent.kind == CAST:
            original_spell_state = (
                character.spell_slots,
                character.max_spell_slots,
                character.known_spells,
                character.prepared_spells,
                character.spellcasting_ability,
            )
            ensure_spellcasting(character)
            result, monster = self._cast_spell(character, action, monster)
            if not result.state_changed:
                (
                    character.spell_slots,
                    character.max_spell_slots,
                    character.known_spells,
                    character.prepared_spells,
                    character.spellcasting_ability,
                ) = original_spell_state
            return result, monster

        if intent.kind == ATTACK:
            return self._resolve_attack_turn(character, action, monster)

        if intent.kind == FLEE:
            if character.in_combat:
                blocked = self._require_player_combat_turn(character, action)
                if blocked:
                    return blocked, monster
            check, success, lucky = self.ability_check(character, "dexterity", FLEE_DC)
            if not success:
                return TurnResult(action, [f"Dexterity check: {check.total} vs DC {FLEE_DC} — you fail to break away.{lucky}"], True), monster
            character.in_combat = False
            character.exploration_cooldown = 1
            return TurnResult(action, [f"Dexterity check: {check.total} vs DC {FLEE_DC} — you break away and escape the fight.{lucky}"], True, True), None

        if intent.kind in (TRAVEL, EXPLORE):
            if monster is not None or character.in_combat:
                return TurnResult(action, ["You cannot explore safely while a fight is still raging."], False), monster
            if intent.kind == TRAVEL or is_travel_action(action):
                travel_result, travel_monster = self._travel(character, action)
                return travel_result, travel_monster if travel_monster is not None else monster
            return self._explore(character, action)

        if intent.kind == TALK:
            from .npc_interactions import npc_id_from_action, resolve_npc_talk

            npc_id = npc_id_from_action(action)
            if npc_id:
                return resolve_npc_talk(character, action, npc_id), monster
            check, success, lucky = self.ability_check(character, "charisma", 12)
            self._regenerate_mana(character)
            return TurnResult(
                action,
                [f"Charisma check: {check.total} vs DC 12 — {'success' if success else 'failure'}.{lucky}"],
                True,
            ), monster

        from .discoveries import try_focused_inspect

        focused = try_focused_inspect(character, action)
        if focused is not None:
            return focused, monster

        explore_skill = self._explore_skill_for_text(text)
        if explore_skill:
            check, success, lucky = self.skill_check(character, explore_skill, 12)
            self._regenerate_mana(character)
            label = f"{explore_skill} check"
            return TurnResult(
                action,
                [f"{label}: {check.total} vs DC 12 — {'success' if success else 'failure'}.{lucky}"],
                True,
            ), monster

        ability = self._ability_for_action(text)
        check, success, lucky = self.ability_check(character, ability, 12)
        self._regenerate_mana(character)
        return TurnResult(action, [f"{ability.title()} check: {check.total} vs DC 12 — {'success' if success else 'failure'}.{lucky}"], True), monster
