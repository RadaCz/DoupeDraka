import type { Locale } from '../i18n';
import { castSpellAction, modeledCombatSpells as modeledSpellsFromBook } from '../spells/spellbook';
import type { Character, JournalEvent, Spell } from '../types';

export type CombatActionKind = 'attack' | 'defend' | 'flee' | 'spell' | 'potion' | 'class_feature';

export interface CombatActionItem {
  id: CombatActionKind;
  kind: CombatActionKind;
  label: string;
  description: string;
  glyph: string;
  action?: string;
  disabled: boolean;
  disabledReason?: string;
}

export function isPlayerCombatTurn(character: Character): boolean {
  return character.combat_turn !== 'enemy';
}

export function modeledCombatSpells(character: Character, spells: Spell[]): Spell[] {
  return modeledSpellsFromBook(character, spells);
}

export { castSpellAction };

export function hasHealingPotion(character: Character): boolean {
  return character.inventory.some(item => item.toLowerCase().includes('potion'));
}

function strikeDescription(enemy: string, locale: Locale): string {
  if (locale === 'cs') return `Zaměříš úder na ${enemy}.`;
  return `Strike ${enemy} with your weapon.`;
}

export function buildCombatActions(
  character: Character,
  spells: Spell[],
  t: (value: string) => string,
  locale: Locale = 'en',
): CombatActionItem[] {
  const enemy = character.combatant?.name ?? t('the enemy');
  const playerTurn = isPlayerCombatTurn(character);
  const waitReason = t('Wait for the enemy to act.');
  const modeled = modeledCombatSpells(character, spells);
  const potion = hasHealingPotion(character);

  const wrap = (
    item: Omit<CombatActionItem, 'disabled' | 'disabledReason'>,
    extraDisabled?: boolean,
    extraReason?: string,
  ): CombatActionItem => {
    const disabled = !playerTurn || extraDisabled === true;
    let disabledReason: string | undefined;
    if (!playerTurn) disabledReason = waitReason;
    else if (extraDisabled) disabledReason = extraReason;
    return { ...item, disabled, disabledReason };
  };

  const featureActions: CombatActionItem[] = [];
  if (character.character_class === 'fighter' && character.second_wind_available && playerTurn) {
    featureActions.push(
      wrap({
        id: 'second_wind',
        kind: 'class_feature',
        label: t('Second Wind'),
        description: t('Bonus action: recover 1d10 + level HP (once per rest).'),
        glyph: '♥',
        action: 'second wind',
      }),
    );
  }
  if (character.character_class === 'rogue' && playerTurn) {
    featureActions.push(
      wrap({
        id: 'hide',
        kind: 'class_feature',
        label: t('Hide'),
        description: t('Stealth to gain advantage for Sneak Attack.'),
        glyph: '◌',
        action: 'hide',
      }),
    );
  }

  return [
    ...featureActions,
    wrap(
      {
        id: 'attack',
        kind: 'attack',
        label: t('Attack'),
        description: strikeDescription(enemy, locale),
        glyph: '⚔',
        action: `attack ${enemy}`,
      },
    ),
    wrap({
      id: 'defend',
      kind: 'defend',
      label: t('Defend'),
      description: t('Brace yourself and soften the next blow.'),
      glyph: '🛡',
      action: 'defend',
    }),
    wrap({
      id: 'flee',
      kind: 'flee',
      label: t('Flee'),
      description: t('Look for a chance to break away.'),
      glyph: '↩',
      action: 'flee',
    }),
    wrap(
      {
        id: 'spell',
        kind: 'spell',
        label: t('Cast spell'),
        description: modeled.length
          ? t('Channel a prepared spell.')
          : t('No modeled combat spells are ready.'),
        glyph: '✦',
      },
      modeled.length === 0,
      t('Prepare known spells on your character sheet.'),
    ),
    wrap(
      {
        id: 'potion',
        kind: 'potion',
        label: t('Healing potion'),
        description: potion ? t('Drink a potion from your pack.') : t('No healing potion in your inventory.'),
        glyph: '⚗',
        action: potion ? 'use potion' : undefined,
      },
      !potion,
      t('Loot or buy a healing potion first.'),
    ),
  ];
}

export function lastCombatBeat(events: JournalEvent[]): JournalEvent | null {
  if (!events.length) return null;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    const blob = `${event.action} ${event.result}`.toLowerCase();
    if (
      /^(attack|defend|flee|cast|use potion)/i.test(event.action)
      || /attack roll|damage|initiative|saving throw|hit\.|miss\./i.test(blob)
    ) {
      return event;
    }
  }
  return events[events.length - 1];
}

export function enemyPortraitGlyph(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('goblin')) return '👺';
  if (lower.includes('wolf')) return '🐺';
  if (lower.includes('warden') || lower.includes('boss')) return '⚰';
  if (lower.includes('bandit')) return '🗡';
  if (lower.includes('ghoul')) return '☠';
  return '⚔';
}
