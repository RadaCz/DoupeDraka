import type { Locale } from '../i18n';
import { castSpellAction, modeledCombatSpells as modeledSpellsFromBook } from '../spells/spellbook';
import type { Character, JournalEvent, Spell } from '../types';
import {
  economyDenialReason,
  readCombatEconomy,
  shouldOfferEndTurn,
  spellEconomySlot,
  type EconomySlot,
} from './combatEconomy';
import { readCombatTactics } from './combatRange';

export type CombatActionKind =
  | 'attack'
  | 'defend'
  | 'flee'
  | 'spell'
  | 'potion'
  | 'class_feature'
  | 'movement';

export interface CombatActionItem {
  id: string;
  kind: CombatActionKind;
  label: string;
  description: string;
  glyph: string;
  action?: string;
  disabled: boolean;
  disabledReason?: string;
  economySlot?: EconomySlot;
}

export function isReactionWindow(character: Character): boolean {
  return character.combat_turn === 'reaction' || Boolean(character.combat_reaction_pending?.kind);
}

export function isPlayerCombatTurn(character: Character): boolean {
  return character.combat_turn !== 'enemy';
}

export function buildReactionCombatActions(
  character: Character,
  t: (value: string) => string,
): CombatActionItem[] {
  if (!isReactionWindow(character)) return [];
  const pending = character.combat_reaction_pending;
  const offerShield = pending?.kind === 'shield_vs_attack';
  const slots = character.spell_slots ?? {};
  const hasSlot = Object.entries(slots).some(([level, count]) => Number(level) >= 1 && Number(count) > 0);
  const knowsShield = [...(character.known_spells ?? []), ...(character.prepared_spells ?? [])].some(
    s => s.toLowerCase() === 'shield',
  );
  const reactionSpent = Boolean(character.combat_flags?.reaction_used);
  const canShield = offerShield && knowsShield && hasSlot && !reactionSpent;
  const actions: CombatActionItem[] = [];
  if (canShield) {
    actions.push({
      id: 'cast_shield',
      kind: 'spell',
      label: t('Cast Shield'),
      description: t('Reaction: +5 AC until your next turn; spends a level 1+ slot and your reaction.'),
      glyph: '✦',
      action: 'cast Shield',
      disabled: false,
      economySlot: 'reaction',
    });
  }
  actions.push({
    id: 'decline_reaction',
    kind: 'defend',
    label: t('Decline reaction'),
    description: t('Let the attack resolve without casting Shield.'),
    glyph: '✕',
    action: 'decline reaction',
    disabled: false,
  });
  return actions;
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
  const economy = readCombatEconomy(character);
  const tactics = readCombatTactics(character);
  const movementLeft =
    tactics?.movement_remaining_ft ?? (character.in_combat ? (character.speed ?? 30) : 0);
  const moveStep = movementLeft >= 15 ? 15 : movementLeft;
  const modeled = modeledCombatSpells(character, spells);
  const soleSpellSlot = modeled.length === 1 ? spellEconomySlot(modeled[0].name) : 'action';
  const potion = hasHealingPotion(character);

  const wrap = (
    item: Omit<CombatActionItem, 'disabled' | 'disabledReason'>,
    extraDisabled?: boolean,
    extraReason?: string,
  ): CombatActionItem => {
    const economyReason = item.economySlot
      ? economyDenialReason(economy, item.economySlot, t, character)
      : undefined;
    const disabled = !playerTurn || extraDisabled === true || Boolean(economyReason);
    let disabledReason: string | undefined;
    if (!playerTurn) disabledReason = t('Wait for the enemy to act.');
    else if (economyReason) disabledReason = economyReason;
    else if (extraDisabled) disabledReason = extraReason;
    return { ...item, disabled, disabledReason };
  };

  const featureActions: CombatActionItem[] = [];
  const actionSpent = Boolean(character.combat_flags?.action_used);
  if (
    character.character_class === 'fighter'
    && (character.level ?? 1) >= 2
    && character.action_surge_available
    && actionSpent
    && playerTurn
  ) {
    featureActions.push(
      wrap({
        id: 'action_surge',
        kind: 'class_feature',
        label: t('Action Surge'),
        description: t('Take one additional action this turn (once per short rest).'),
        glyph: '⚡',
        action: 'action surge',
      }),
    );
  }
  if (character.character_class === 'fighter' && character.second_wind_available && playerTurn) {
    featureActions.push(
      wrap({
        id: 'second_wind',
        kind: 'class_feature',
        label: t('Second Wind'),
        description: t('Bonus action: recover 1d10 + level HP (once per rest).'),
        glyph: '♥',
        action: 'second wind',
        economySlot: 'bonus',
      }),
    );
  }
  if (
    character.character_class === 'rogue'
    && (character.level ?? 1) >= 2
    && playerTurn
  ) {
    featureActions.push(
      wrap({
        id: 'hide',
        kind: 'class_feature',
        label: t('Hide'),
        description: t('Stealth (bonus action) to gain advantage for Sneak Attack.'),
        glyph: '◌',
        action: 'hide',
        economySlot: 'bonus',
      }),
    );
  }

  const movementActions: CombatActionItem[] = [];
  if (character.in_combat && playerTurn) {
    movementActions.push(
      wrap(
        {
          id: 'advance',
          kind: 'movement',
          label: t('Advance'),
          description: t('Move closer to the enemy (uses movement, not your Action).'),
          glyph: '⇢',
          action: moveStep > 0 ? `advance ${moveStep} ft` : undefined,
        },
        moveStep <= 0,
        t('No movement remaining this turn.'),
      ),
      wrap(
        {
          id: 'step_back',
          kind: 'movement',
          label: t('Step back'),
          description: t('Increase distance (uses movement, not your Action).'),
          glyph: '⇠',
          action: moveStep > 0 ? `step back ${moveStep} ft` : undefined,
        },
        moveStep <= 0,
        t('No movement remaining this turn.'),
      ),
    );
  }

  const actions: CombatActionItem[] = [
    ...featureActions,
    ...movementActions,
    wrap(
      {
        id: 'attack',
        kind: 'attack',
        label: t('Attack'),
        description: strikeDescription(enemy, locale),
        glyph: '⚔',
        action: `attack ${enemy}`,
        economySlot: 'action',
      },
    ),
    wrap({
      id: 'defend',
      kind: 'defend',
      label: t('Defend'),
      description: t('Brace yourself and soften the next blow.'),
      glyph: '🛡',
      action: 'defend',
      economySlot: 'action',
    }),
    wrap({
      id: 'disengage',
      kind: 'defend',
      label: t('Disengage'),
      description: t('Action: move without provoking opportunity attacks this turn.'),
      glyph: '↔',
      action: 'disengage',
      economySlot: 'action',
    }),
    wrap({
      id: 'flee',
      kind: 'flee',
      label: t('Flee'),
      description: t('Look for a chance to break away.'),
      glyph: '↩',
      action: 'flee',
      economySlot: 'action',
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
        economySlot: soleSpellSlot,
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
        economySlot: 'action',
      },
      !potion,
      t('Loot or buy a healing potion first.'),
    ),
  ];

  if (playerTurn && shouldOfferEndTurn(character)) {
    actions.push({
      id: 'end_turn',
      kind: 'class_feature',
      label: t('End turn'),
      description: t('Pass to the enemy when you are done acting.'),
      glyph: '→',
      action: 'end turn',
      disabled: false,
    });
  }

  return actions;
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
