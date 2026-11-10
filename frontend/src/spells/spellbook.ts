import type { Character, Spell } from '../types';

/** Spells that require a combat target in action text (mirrors combat + composer). */
export const DAMAGE_TARGET_SPELLS = new Set([
  'Burning Hands',
  'Eldritch Blast',
  'Fire Bolt',
  'Magic Missile',
  'Sacred Flame',
  'Scorching Ray',
  'Vicious Mockery',
]);

/** Mirrors app/engine/spells.PREPARED_CASTERS */
export const PREPARED_CASTERS = new Set(['cleric', 'druid', 'paladin', 'ranger']);

export const CASTER_CLASSES = new Set([
  'bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard',
]);

const FULL_CASTER_CLASSES = new Set(['bard', 'cleric', 'druid', 'sorcerer', 'wizard']);
const HALF_CASTER_CLASSES = new Set(['paladin', 'ranger']);

export function isCasterClass(characterClass: string): boolean {
  return CASTER_CLASSES.has(characterClass);
}

export function usesPreparedSpells(characterClass: string): boolean {
  return PREPARED_CASTERS.has(characterClass);
}

export function highestSpellLevel(character: Character | null): number {
  if (!character) return 0;
  const level = character.level;
  if (FULL_CASTER_CLASSES.has(character.character_class)) {
    return Math.min(9, Math.ceil(level / 2));
  }
  if (HALF_CASTER_CLASSES.has(character.character_class)) {
    return level < 2 ? 0 : Math.min(5, Math.ceil(level / 4));
  }
  if (character.character_class === 'warlock') {
    return Math.min(5, Math.ceil(level / 2));
  }
  return 0;
}

export function accessibleSpellNames(character: Character): Set<string> {
  return new Set([...(character.known_spells ?? []), ...(character.prepared_spells ?? [])]);
}

export function hasSpellSlots(character: Character): boolean {
  return Object.values(character.max_spell_slots ?? {}).some(count => count > 0);
}

export function slotAvailableForSpell(character: Character, spellLevel: number): boolean {
  if (spellLevel === 0) return true;
  const slots = character.spell_slots ?? {};
  return Object.entries(slots).some(([level, count]) => Number(level) >= spellLevel && count > 0);
}

export type SpellEngineKind =
  | 'attack'
  | 'healing'
  | 'save'
  | 'utility'
  | 'unsupported';

const ENGINE_KIND: Record<string, SpellEngineKind> = {
  'Burning Hands': 'save',
  'Cure Wounds': 'healing',
  'Eldritch Blast': 'attack',
  'Fire Bolt': 'attack',
  'Healing Word': 'healing',
  'Magic Missile': 'attack',
  'Misty Step': 'utility',
  Invisibility: 'utility',
  'Scorching Ray': 'attack',
  'Sacred Flame': 'save',
  'Vicious Mockery': 'save',
};

export function spellEngineKind(spell: Spell): SpellEngineKind {
  if (!spell.effect_modeled) return 'unsupported';
  return ENGINE_KIND[spell.name] ?? 'utility';
}

export type HeroSpellRow = {
  spell: Spell;
  known: boolean;
  prepared: boolean;
};

export function heroSpellRows(character: Character, spells: Spell[]): HeroSpellRow[] {
  const known = new Set(character.known_spells ?? []);
  const prepared = new Set(character.prepared_spells ?? []);
  const names = accessibleSpellNames(character);
  return spells
    .filter(spell => names.has(spell.name))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
    .map(spell => ({
      spell,
      known: known.has(spell.name),
      prepared: prepared.has(spell.name),
    }));
}

export type CastBlockReasonKey =
  | 'not_modeled'
  | 'not_learned'
  | 'no_slots'
  | 'enemy_turn'
  | 'needs_combat_target'
  | 'busy'
  | null;

export function castBlockReasonKey(
  character: Character,
  spell: Spell,
  busy: boolean,
): CastBlockReasonKey {
  if (busy) return 'busy';
  const names = accessibleSpellNames(character);
  if (!names.has(spell.name)) return 'not_learned';
  if (!spell.effect_modeled) return 'not_modeled';
  if (character.in_combat && character.combat_turn === 'enemy') return 'enemy_turn';
  if (spell.level > 0 && !slotAvailableForSpell(character, spell.level)) return 'no_slots';
  if (
    DAMAGE_TARGET_SPELLS.has(spell.name)
    && character.in_combat
    && !character.combatant?.name
  ) {
    return 'needs_combat_target';
  }
  return null;
}

/** English keys — translate in UI with t() */
export const CAST_BLOCK_MESSAGES: Record<Exclude<CastBlockReasonKey, null>, string> = {
  busy: 'Wait until the current action finishes.',
  not_learned: 'Your hero has not learned or prepared this spell.',
  not_modeled: 'This spell is in the SRD catalog only. The engine does not spend slots or apply its effect yet.',
  no_slots: 'You have no spell slots available for this spell level.',
  enemy_turn: 'Wait for your turn in combat before casting.',
  needs_combat_target: 'This spell needs an enemy target in combat.',
};

export function buildCastAction(character: Character, spellName: string): string {
  const needsTarget = DAMAGE_TARGET_SPELLS.has(spellName);
  const enemy = character.combatant?.name;
  const target = needsTarget && enemy ? ` at ${enemy}` : '';
  return `cast ${spellName}${target}`;
}

/** Spells the combat deck can fire — same filter as combatActions.modeledCombatSpells */
export function modeledCombatSpells(character: Character, spells: Spell[]): Spell[] {
  const names = accessibleSpellNames(character);
  return spells
    .filter(spell => names.has(spell.name) && spell.effect_modeled)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

export function castSpellAction(spellName: string, enemyName: string | undefined): string {
  const needsTarget = DAMAGE_TARGET_SPELLS.has(spellName);
  const target = needsTarget && enemyName ? ` at ${enemyName}` : '';
  return `cast ${spellName}${target}`;
}
