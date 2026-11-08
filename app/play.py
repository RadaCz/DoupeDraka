"""Playable offline demo of the deterministic engine.

No Telegram, no HTTP, no LLM: the engine rolls everything and the narrator's
deterministic prose renders it. That makes this the fastest way to actually play
the game, and the clearest proof that the numbers are never the model's idea.

    python -m app.play
"""
import copy

from .engine import economy
from .engine.catalog import CLASSES
from .engine.encounters import MONSTERS
from .engine.models import DIFFICULTIES, HUMORS, TONES
from .engine.service import GameEngine
from .engine.tools import combat_calculator, spell_library
from .heroes import HEROES
from .narrator import NarrationContext, Narrator

HELP = """Commands
  attack [target]   attack (goblin, kobold, wolf, bandit, ghoul, ogre)
  cast <spell> [at target]   cast a known/prepared spell; slots, not mana, are spent
  flee              try to escape the current fight
  rest              recover HP out of combat
  <anything else>   the engine resolves it as an ability check
  /sheet   /spells   /tools <monster>...   /bestiary
  /settings [difficulty tone humor brief|full]
  /status  /help  /quit"""


def choose_hero() -> dict:
    """Pick a pre-made hero, or build one from the standard array."""
    print("\nChoose your hero:")
    keys = list(HEROES)
    for index, key in enumerate(keys, start=1):
        hero = HEROES[key]
        print(f"  {index}) {hero.name} - {hero.role}: {hero.race.replace('_', ' ').title()} {CLASSES[hero.character_class].name}")
    print(f"  {len(keys) + 1}) Custom character")
    choice = input("> ").strip()
    if choice.isdigit() and 1 <= int(choice) <= len(keys):
        hero = HEROES[keys[int(choice) - 1]]
        return {"name": hero.name, "race": hero.race, "character_class": hero.character_class, "abilities": hero.abilities}
    name = input("Name: ").strip() or "Arin"
    race = input("Race (human, elf, dwarf, halfling, dragonborn, gnome, half_elf, half_orc, tiefling): ").strip() or "human"
    character_class = input(f"Class ({', '.join(CLASSES)}): ").strip() or "fighter"
    return {"name": name, "race": race, "character_class": character_class, "abilities": None}


def choose_difficulty() -> str:
    options = " / ".join(DIFFICULTIES)
    answer = input(f"\nDifficulty [{options}] (normal): ").strip().lower()
    return answer if answer in DIFFICULTIES else "normal"


def show_sheet(engine: GameEngine, character) -> None:
    spec = CLASSES[character.character_class]
    print(f"\n{character.name} - level {character.level} {character.race.replace('_', ' ').title()} {spec.name}")
    print(f"  HP {character.hp}/{character.max_hp}   AC {character.armor_class}   "
          f"mana {character.mana}/{character.max_mana}   XP {character.xp}/{100}")
    slots = " / ".join(
        f"L{level}: {character.spell_slots.get(level, 0)}/{count}"
        for level, count in sorted(character.max_spell_slots.items())
    ) or "none"
    known = character.known_spells or character.prepared_spells
    print(f"  Spell slots {slots}   {character.spellcasting_ability or 'no spellcasting ability'}")
    if known:
        print(f"  Known/prepared: {', '.join(known)}")
    scores = "  ".join(f"{ability[:3].upper()} {score} ({engine.modifier(score):+d})"
                       for ability, score in character.abilities.items())
    print(f"  {scores}")
    print(f"  Inventory: {', '.join(character.inventory)}")
    print(f"  Campaign: difficulty={character.difficulty} tone={character.tone} "
          f"humor={character.humor} prose={'full' if character.verbose else 'brief'}")


def show_status(character, energy_tenths: int, monster) -> None:
    threat = (f" | vs {monster.name} {monster.hp}/{monster.max_hp} HP AC {monster.armor_class}"
              if monster is not None else "")
    slots = " ".join(
        f"L{level}:{character.spell_slots.get(level, 0)}/{count}"
        for level, count in sorted(character.max_spell_slots.items())
    ) or "slots:none"
    print(f"[HP {character.hp}/{character.max_hp} | {slots} | mana {character.mana}/{character.max_mana} | "
          f"XP {character.xp} | L{character.level} | adventure mana {economy.to_units(energy_tenths):.1f}{threat}]")


def show_settings(character) -> None:
    print(f"\n  difficulty : {character.difficulty}  ({', '.join(DIFFICULTIES)})")
    print(f"  tone       : {character.tone}  ({', '.join(TONES)})")
    print(f"  humor      : {character.humor}  ({', '.join(HUMORS)})")
    print(f"  prose      : {'full' if character.verbose else 'brief'}")


def apply_setting_command(engine: GameEngine, character, arguments: list[str]) -> None:
    if not arguments:
        show_settings(character)
        return
    tokens = list(arguments)
    verbose = None
    if tokens and tokens[-1].lower() in {"brief", "full"}:
        verbose = tokens.pop().lower() == "full"
    # Settings may be given in any order; each is validated by the engine.
    for token in tokens:
        token = token.lower()
        if token in DIFFICULTIES: engine.apply_settings(character, difficulty=token)
        elif token in TONES: engine.apply_settings(character, tone=token)
        elif token in HUMORS: engine.apply_settings(character, humor=token)
        else: print(f"  (ignoring unknown setting: {token})")
    if verbose is not None: engine.apply_settings(character, verbose=verbose)
    show_settings(character)


def show_bestiary() -> None:
    print("\nBestiary (normal profile; easy and hard scale these):")
    for monster in MONSTERS.values():
        print(f"  {monster.key:<8} {monster.name:<18} tier {monster.tier}  "
              f"HP {monster.hp:<3} AC {monster.armor_class:<3} "
              f"atk +{monster.attack_bonus}  dmg {monster.damage_dice}+{monster.damage_bonus}  "
              f"{monster.reward_xp} XP")


def show_spells() -> None:
    print("\nSpell library:")
    for spell in spell_library():
        effect = "modeled" if spell["effect_modeled"] else "effect not modeled; no slot spent"
        print(f"  [{spell['level']}] {spell['name']} [{effect}] ({spell['school']}, {spell['range']}) - {spell['text']}")


def run_tools(character, arguments: list[str]) -> None:
    monsters = arguments or ["goblin"]
    try:
        report = combat_calculator([character.level], monsters)
    except ValueError as error:
        print(f"  {error}")
        return
    print(f"\nEncounter: {', '.join(monsters)} vs a level {character.level} party")
    print(f"  base XP {report['base_xp']}  x{report['multiplier']} = "
          f"{report['adjusted_xp']} adjusted XP  ->  {report['band'].upper()}")
    thresholds = report["thresholds"]
    print(f"  thresholds: easy {thresholds['easy']}, medium {thresholds['medium']}, "
          f"hard {thresholds['hard']}, deadly {thresholds['deadly']}")


def main() -> None:
    print("=" * 66)
    print("  SOLO D&D - The Whispering Cellar")
    print("  The engine owns every roll. The narrator only describes them.")
    print("=" * 66)

    engine = GameEngine()
    choice = choose_hero()
    try:
        character = engine.create_character(1, choice["name"], choice["race"], choice["character_class"], choice["abilities"])
    except ValueError as error:
        print(f"\nCould not create that character: {error}")
        return
    character.difficulty = choose_difficulty()

    energy_tenths = economy.STARTING_BALANCE_TENTHS
    monster = None
    show_sheet(engine, character)
    print(f"\nYou carry {economy.to_units(energy_tenths)} adventure mana - each turn costs "
          f"{economy.to_units(economy.turn_cost('normal'))} at the normal tier.")
    print("Type /help for commands.\n")

    while True:
        show_status(character, energy_tenths, monster)
        if character.hp <= 0:
            print("You have fallen. The cellar keeps its secrets.")
            break
        if monster is None and not character.in_combat and character.hp < character.max_hp:
            print("  (You are wounded and no enemy is near. 'rest' would recover HP.)")
        try:
            raw = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not raw:
            continue
        if raw.startswith("/"):
            command, _, rest = raw.partition(" ")
            arguments = rest.split()
            if command in {"/quit", "/exit"}: break
            if command == "/help": print(HELP); continue
            if command == "/sheet": show_sheet(engine, character); continue
            if command == "/spells": show_spells(); continue
            if command == "/bestiary": show_bestiary(); continue
            if command == "/tools": run_tools(character, arguments); continue
            if command == "/settings":
                apply_setting_command(engine, character, arguments); continue
            print(f"Unknown command {command}. Try /help.")
            continue

        # Spending the paid currency is part of the loop, exactly as in the API.
        # Affordability is checked first, but a turn that changes nothing is free.
        previous_character, previous_monster = copy.deepcopy((character, monster))
        previous_rng = engine.rng.getstate()
        result, next_monster = engine.resolve_action(character, raw, monster)
        if (
            result.state_changed
            and result.costs_adventure_mana
            and not economy.can_afford(energy_tenths, "normal")
        ):
            character, monster = previous_character, previous_monster
            engine.rng.setstate(previous_rng)
            print("Out of adventure mana. Top up to keep playing (see /economy in the API).")
            break
        monster = next_monster
        charged = 0
        if result.state_changed and result.costs_adventure_mana:
            energy_tenths, charged = economy.charge(energy_tenths, "normal")
        context = NarrationContext(
            raw, tuple(result.events), character.location, (),
            difficulty=character.difficulty, tone=character.tone,
            humor=character.humor, verbose=character.verbose, language="en",
        )
        print(f"\n{Narrator.narrate_offline(context)}")
        for event in result.events:
            print(f"  - {event}")
        if charged:
            print(f"  (-{economy.to_units(charged):.1f} adventure mana)")
        elif result.state_changed:
            print("  (no Adventure Mana charge: this action is free)")
        else:
            print("  (no charge: nothing changed)")
        if result.combat_over:
            print("  The fight is over.")
        print()

    print(f"\nFinal: {character.name}, level {character.level}, {character.xp} XP, "
          f"adventure mana {economy.to_units(energy_tenths):.1f} left.")


if __name__ == "__main__":
    main()