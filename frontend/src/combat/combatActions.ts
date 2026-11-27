import type { Locale } from '../i18n';
import { formatWizardSpeedFt } from '../character/wizardDisplay';
import { castSpellAction, modeledCombatSpells as modeledSpellsFromBook } from '../spells/spellbook';
import { displaySpellName } from '../spells/spellDisplay';
import type { Character, JournalEvent, Spell } from '../types';
import type { CombatIconName } from './combatIcons';
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
  | 'movement'
  | 'panel';

export interface CombatActionItem {
  id: string;
  kind: CombatActionKind;
  label: string;
  description: string;
  icon: CombatIconName;
  action?: string;
  disabled: boolean;
  disabledReason?: string;
  economySlot?: EconomySlot;
  panelTarget?: 'abilities' | 'items';
}

export interface CombatActionDeckModel {
  main: CombatActionItem[];
  tactics: CombatActionItem[];
  abilityActions: CombatActionItem[];
  itemActions: CombatActionItem[];
  endTurn?: CombatActionItem;
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
      icon: 'shield',
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
    icon: 'decline',
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

export function playerParalyzed(character: Character): boolean {
  return (character.conditions ?? []).some(
    condition => String(condition.condition_id).toLowerCase() === 'paralyzed',
  );
}

function strikeDescription(enemy: string, locale: Locale): string {
  if (locale === 'cs') return `Zaměříš úder na ${enemy}.`;
  return `Strike ${enemy} with your weapon.`;
}

function wrap(
  character: Character,
  playerTurn: boolean,
  economy: ReturnType<typeof readCombatEconomy>,
  t: (value: string) => string,
  item: Omit<CombatActionItem, 'disabled' | 'disabledReason'>,
  extraDisabled?: boolean,
  extraReason?: string,
): CombatActionItem {
  const economyReason = item.economySlot
    ? economyDenialReason(economy, item.economySlot, t, character)
    : undefined;
  const disabled = !playerTurn || extraDisabled === true || Boolean(economyReason);
  let disabledReason: string | undefined;
  if (!playerTurn) disabledReason = t('Wait for the enemy to act.');
  else if (economyReason) disabledReason = economyReason;
  else if (extraDisabled) disabledReason = extraReason;
  return { ...item, disabled, disabledReason };
}

function buildClassFeatureActions(
  character: Character,
  playerTurn: boolean,
  economy: ReturnType<typeof readCombatEconomy>,
  t: (value: string) => string,
): CombatActionItem[] {
  const featureActions: CombatActionItem[] = [];
  const enemyName = character.combatant?.name?.toLowerCase() ?? '';
  const undeadFoe = /skeleton|ghoul|zombie|undead/i.test(enemyName);
  const actionSpent = Boolean(character.combat_flags?.action_used);
  if (
    character.character_class === 'fighter'
    && (character.level ?? 1) >= 2
    && character.action_surge_available
    && actionSpent
    && playerTurn
  ) {
    featureActions.push(
      wrap(character, playerTurn, economy, t, {
        id: 'action_surge',
        kind: 'class_feature',
        label: t('Action Surge'),
        description: t('Take one additional action this turn (once per short rest).'),
        icon: 'feature',
        action: 'action surge',
      }),
    );
  }
  if (
    character.character_class === 'cleric'
    && (character.level ?? 1) >= 2
    && character.channel_divinity_available
    && playerTurn
  ) {
    if (undeadFoe) {
      featureActions.push(
        wrap(character, playerTurn, economy, t, {
          id: 'turn_undead',
          kind: 'class_feature',
          label: t('Turn Undead'),
          description: t('Channel Divinity: undead foes must resist or be destroyed.'),
          icon: 'feature',
          action: 'turn undead',
          economySlot: 'action',
        }),
      );
    }
    if ((character.hp ?? 0) < (character.max_hp ?? 0)) {
      featureActions.push(
        wrap(character, playerTurn, economy, t, {
          id: 'preserve_life',
          kind: 'class_feature',
          label: t('Preserve Life'),
          description: t('Channel Divinity: heal using your Life domain pool (5 × level HP).'),
          icon: 'feature',
          action: 'preserve life',
          economySlot: character.in_combat ? 'action' : undefined,
        }),
      );
    }
  }
  if (character.character_class === 'fighter' && character.second_wind_available && playerTurn) {
    featureActions.push(
      wrap(character, playerTurn, economy, t, {
        id: 'second_wind',
        kind: 'class_feature',
        label: t('Second Wind'),
        description: t('Bonus action: recover 1d10 + level HP (once per rest).'),
        icon: 'feature',
        action: 'second wind',
        economySlot: 'bonus',
      }),
    );
  }
  if (character.character_class === 'rogue' && (character.level ?? 1) >= 2 && playerTurn) {
    featureActions.push(
      wrap(character, playerTurn, economy, t, {
        id: 'cunning_dash',
        kind: 'class_feature',
        label: t('Dash'),
        description: t('Cunning Action: gain movement equal to your speed (bonus action).'),
        icon: 'feature',
        action: 'dash',
        economySlot: 'bonus',
      }),
      wrap(character, playerTurn, economy, t, {
        id: 'hide',
        kind: 'class_feature',
        label: t('Hide'),
        description: t('Cunning Action: Stealth to gain advantage for Sneak Attack.'),
        icon: 'feature',
        action: 'hide',
        economySlot: 'bonus',
      }),
    );
  }
  return featureActions;
}

export function buildCombatActionDeck(
  character: Character,
  spells: Spell[],
  t: (value: string) => string,
  locale: Locale = 'en',
): CombatActionDeckModel {
  const enemy = character.combatant?.name ?? t('the enemy');
  const playerTurn = isPlayerCombatTurn(character);
  const paralyzed = playerParalyzed(character);
  const paralysisReason = paralyzed ? t('You are paralyzed and cannot act.') : undefined;
  const economy = readCombatEconomy(character);
  const positioning = readCombatTactics(character);
  const movementLeft =
    positioning?.movement_remaining_ft ?? (character.in_combat ? (character.speed ?? 30) : 0);
  const moveStep = movementLeft >= 15 ? 15 : movementLeft;
  const modeled = modeledCombatSpells(character, spells);
  const potion = hasHealingPotion(character);
  const rangeBlocked = positioning?.weapon_range?.can_attack === false;
  const rangeReason = positioning?.weapon_range?.denial;

  const attack = wrap(
    character,
    playerTurn,
    economy,
    t,
    {
      id: 'attack',
      kind: 'attack',
      label: t('Attack'),
      description: strikeDescription(enemy, locale),
      icon: 'attack',
      action: `attack ${enemy}`,
      economySlot: 'action',
    },
    rangeBlocked || paralyzed,
    paralysisReason ?? rangeReason ?? t('Out of weapon reach.'),
  );

  const defend = wrap(
    character,
    playerTurn,
    economy,
    t,
    {
      id: 'defend',
      kind: 'defend',
      label: t('Defend'),
      description: t('Brace yourself and soften the next blow.'),
      icon: 'defend',
      action: 'defend',
      economySlot: 'action',
    },
    paralyzed,
    paralysisReason,
  );

  const abilitiesHub: CombatActionItem = {
    id: 'abilities',
    kind: 'panel',
    label: t('Combat abilities'),
    description: t('Class features and modeled combat spells.'),
    icon: 'abilities',
    disabled: !playerTurn || paralyzed,
    disabledReason: paralysisReason ?? (!playerTurn ? t('Wait for the enemy to act.') : undefined),
    panelTarget: 'abilities',
  };

  const itemsHub: CombatActionItem = {
    id: 'items',
    kind: 'panel',
    label: t('Items'),
    description: potion
      ? t('Drink a potion from your pack.')
      : t('No healing potion in your inventory.'),
    icon: 'items',
    disabled: !playerTurn || paralyzed,
    disabledReason: paralysisReason ?? (!playerTurn ? t('Wait for the enemy to act.') : undefined),
    panelTarget: 'items',
  };

  const speedFt = character.speed ?? 30;
  const sprintDistance = formatWizardSpeedFt(speedFt, locale);

  const tacticActions: CombatActionItem[] = [];
  if (character.in_combat && playerTurn) {
    tacticActions.push(
      wrap(
        character,
        playerTurn,
        economy,
        t,
        {
          id: 'sprint',
          kind: 'movement',
          label: t('Sprint'),
          description: locale === 'cs'
            ? `Akce: získáš pohyb ${sprintDistance} (přičte se k zbytku tahu).`
            : `Action: gain ${sprintDistance} of movement (added to your turn budget).`,
          icon: 'advance',
          action: 'sprint',
          economySlot: 'action',
        },
        paralyzed,
        paralysisReason,
      ),
      wrap(
        character,
        playerTurn,
        economy,
        t,
        {
          id: 'advance',
          kind: 'movement',
          label: t('Advance'),
          description: t('Move closer to the enemy (uses movement, not your Action).'),
          icon: 'advance',
          action: moveStep > 0 ? `advance ${moveStep} ft` : undefined,
        },
        moveStep <= 0 || paralyzed,
        paralysisReason ?? t('No movement remaining this turn.'),
      ),
      wrap(
        character,
        playerTurn,
        economy,
        t,
        {
          id: 'step_back',
          kind: 'movement',
          label: t('Step back'),
          description: t('Increase distance (uses movement, not your Action).'),
          icon: 'retreat',
          action: moveStep > 0 ? `step back ${moveStep} ft` : undefined,
        },
        moveStep <= 0 || paralyzed,
        paralysisReason ?? t('No movement remaining this turn.'),
      ),
      wrap(
        character,
        playerTurn,
        economy,
        t,
        {
          id: 'disengage',
          kind: 'defend',
          label:
            character.character_class === 'rogue' && (character.level ?? 1) >= 2
              ? t('Disengage (Cunning)')
              : t('Disengage'),
          description:
            character.character_class === 'rogue' && (character.level ?? 1) >= 2
              ? t('Bonus action: move without provoking opportunity attacks this turn.')
              : t('Action: move without provoking opportunity attacks this turn.'),
          icon: 'disengage',
          action: 'disengage',
          economySlot:
            character.character_class === 'rogue' && (character.level ?? 1) >= 2 ? 'bonus' : 'action',
        },
        paralyzed,
        paralysisReason,
      ),
      wrap(
        character,
        playerTurn,
        economy,
        t,
        {
          id: 'flee',
          kind: 'flee',
          label: t('Flee'),
          description: t('Look for a chance to break away.'),
          icon: 'flee',
          action: 'flee',
          economySlot: 'action',
        },
        paralyzed,
        paralysisReason,
      ),
    );
  }

  const abilityActions: CombatActionItem[] = [
    ...buildClassFeatureActions(character, playerTurn, economy, t),
    ...modeled.map(spell => wrap(
      character,
      playerTurn,
      economy,
      t,
      {
        id: `spell-${spell.name}`,
        kind: 'spell',
        label: displaySpellName(spell.name, locale, t),
        description: t('Channel a prepared spell.'),
        icon: 'spell',
        action: castSpellAction(spell.name, enemy),
        economySlot: spellEconomySlot(spell.name),
      },
    )),
  ];

  const itemActions: CombatActionItem[] = [
    wrap(
      character,
      playerTurn,
      economy,
      t,
      {
        id: 'potion',
        kind: 'potion',
        label: t('Healing potion'),
        description: potion ? t('Drink a potion from your pack.') : t('No healing potion in your inventory.'),
        icon: 'potion',
        action: potion ? 'use potion' : undefined,
        economySlot: 'action',
      },
      !potion,
      t('Loot or buy a healing potion first.'),
    ),
  ];

  let endTurn: CombatActionItem | undefined;
  if (playerTurn && shouldOfferEndTurn(character)) {
    endTurn = {
      id: 'end_turn',
      kind: 'class_feature',
      label: t('End turn'),
      description: t('Pass to the enemy when you are done acting.'),
      icon: 'end-turn',
      action: 'end turn',
      disabled: false,
    };
  }

  return {
    main: [attack, defend, abilitiesHub, itemsHub],
    tactics: tacticActions,
    abilityActions,
    itemActions,
    endTurn,
  };
}

/** @deprecated Use buildCombatActionDeck — kept for narrow imports. */
export function buildCombatActions(
  character: Character,
  spells: Spell[],
  t: (value: string) => string,
  locale: Locale = 'en',
): CombatActionItem[] {
  const deck = buildCombatActionDeck(character, spells, t, locale);
  return [
    ...deck.main,
    ...deck.tactics,
    ...deck.abilityActions,
    ...deck.itemActions,
    ...(deck.endTurn ? [deck.endTurn] : []),
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

/** @deprecated Combat V2 uses SVG silhouettes — returns icon key for tests only. */
export function enemyPortraitGlyph(_name: string): string {
  return '';
}