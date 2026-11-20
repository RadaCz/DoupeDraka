import type { Locale } from '../i18n';
import {
  displayAbilityAbbrev,
  displayCreature,
  displaySpell,
  displayWeaponLabel,
} from '../i18n/gameDisplay';
import type { Character, TurnResolution, TurnResolutionBeat } from '../types';
import { readCombatTactics } from './combatRange';

export type ResolutionChipTone = 'hit' | 'miss' | 'crit' | 'heal' | 'warn' | 'neutral';

export interface ResolutionChip {
  id: string;
  label: string;
  tone: ResolutionChipTone;
}

function attackSourceLabel(beat: TurnResolutionBeat, locale: Locale): string {
  const spell = typeof beat.spell_name === 'string' ? beat.spell_name.trim() : '';
  if (spell) return displaySpell(spell, locale);
  const weapon = typeof beat.weapon === 'string' ? beat.weapon.trim() : '';
  if (weapon) return displayWeaponLabel(weapon, locale);
  return locale === 'cs' ? 'Útok' : 'Attack';
}

function outcomeLabel(outcome: string | undefined, locale: Locale): string {
  const o = (outcome ?? '').toLowerCase();
  if (locale === 'cs') {
    if (o === 'hit') return 'zásah';
    if (o === 'miss') return 'minutí';
    if (o === 'critical_hit') return 'kritický zásah';
    if (o === 'critical_miss') return 'kritické minutí';
    return o || 'výsledek';
  }
  if (o === 'critical_hit') return 'critical hit';
  if (o === 'critical_miss') return 'critical miss';
  return o || 'outcome';
}

function outcomeTone(outcome: string | undefined): ResolutionChipTone {
  const o = (outcome ?? '').toLowerCase();
  if (o === 'critical_hit' || o === 'hit') return o === 'critical_hit' ? 'crit' : 'hit';
  if (o === 'miss' || o === 'critical_miss') return 'miss';
  return 'neutral';
}

function hpChip(
  id: string,
  who: string,
  hp: number | undefined,
  max: number | undefined,
  locale: Locale,
): ResolutionChip | null {
  if (hp == null || max == null) return null;
  const label = locale === 'cs'
    ? `${who}: ${hp}/${max} životů`
    : `${who}: ${hp}/${max} HP`;
  return { id, label, tone: hp / max <= 0.25 ? 'warn' : 'neutral' };
}

function formatDamageCs(amount: number): string {
  return `poškození ${amount}`;
}

function shieldCastChip(beat: TurnResolutionBeat, locale: Locale): ResolutionChip {
  if (locale !== 'cs') {
    const ac = beat.ac;
    const suffix = ac != null ? ` (+${ac} AC)` : ' (+5 AC)';
    return { id: 'shield', label: `Shield cast${suffix}`, tone: 'hit' };
  }
  const ac = beat.ac;
  const label = ac != null ? `Štít seslán, OČ ${ac}` : 'Štít seslán';
  return { id: 'shield', label, tone: 'hit' };
}

export function beatToChips(beat: TurnResolutionBeat, locale: Locale): ResolutionChip[] {
  const chips: ResolutionChip[] = [];
  const kind = beat.kind;

  if (kind === 'attack') {
    const src = attackSourceLabel(beat, locale);
    const roll = beat.attack_roll?.total;
    const ac = beat.target_ac;
    const out = outcomeLabel(beat.outcome, locale);
    if (roll != null && ac != null) {
      const rollLabel = locale === 'cs'
        ? `${src}: hod ${roll} vs OČ ${ac} — ${out}`
        : `${src}: roll ${roll} vs AC ${ac} — ${out}`;
      chips.push({ id: `${kind}-roll`, label: rollLabel, tone: outcomeTone(beat.outcome) });
    }
    const dmg = typeof beat.damage === 'object' && beat.damage !== null
      ? (beat.damage as { total?: number }).total
      : typeof beat.damage === 'number'
        ? beat.damage
        : undefined;
    if (dmg != null && dmg > 0) {
      chips.push({
        id: `${kind}-dmg`,
        label: locale === 'cs' ? formatDamageCs(dmg) : `Damage ${dmg}`,
        tone: 'hit',
      });
    }
    const enemy = beat.enemy;
    if (enemy?.name) {
      const foe = displayCreature(enemy.name, locale);
      const chip = hpChip('enemy-hp', foe, enemy.hp_current, enemy.hp_max, locale);
      if (chip) chips.push(chip);
    }
    const hero = beat.hero;
    if (hero) {
      const chip = hpChip('hero-hp', locale === 'cs' ? 'Hrdina' : 'Hero', hero.hp_current, hero.hp_max, locale);
      if (chip) chips.push(chip);
    }
    return chips;
  }

  if (kind === 'movement' && beat.distance_ft) {
    const from = beat.distance_ft.from;
    const to = beat.distance_ft.to;
    chips.push({
      id: 'movement',
      label: locale === 'cs' ? `Vzdálenost ${from} → ${to} ft` : `Distance ${from} → ${to} ft`,
      tone: 'neutral',
    });
    return chips;
  }

  if (kind === 'healing') {
    const amount = beat.healing;
    if (amount != null) {
      chips.push({
        id: 'healing',
        label: locale === 'cs' ? `Léčení +${amount}` : `Healing +${amount}`,
        tone: 'heal',
      });
    }
    return chips;
  }

  if (kind === 'saving_throw') {
    const total = beat.roll?.total;
    const dc = beat.dc;
    const ability = displayAbilityAbbrev(String(beat.ability ?? ''), locale);
    const ok = beat.success;
    if (total != null && dc != null) {
      const verdict = ok
        ? (locale === 'cs' ? 'úspěch' : 'success')
        : (locale === 'cs' ? 'neúspěch' : 'failure');
      chips.push({
        id: 'save',
        label: locale === 'cs'
          ? `Záchranný hod ${ability}: ${total} vs OČ ${dc} — ${verdict}`
          : `${ability} save ${total} vs DC ${dc} — ${verdict}`,
        tone: ok ? 'hit' : 'miss',
      });
    }
    return chips;
  }

  if (kind === 'reaction') {
    if (beat.name === 'shield') {
      if (beat.cast) {
        chips.push(shieldCastChip(beat, locale));
      } else if (beat.declined) {
        chips.push({ id: 'shield-no', label: locale === 'cs' ? 'Reakce nevyužita' : 'Reaction declined', tone: 'neutral' });
      }
    } else if (beat.name === 'opportunity_attack') {
      chips.push({
        id: 'oa',
        label: locale === 'cs' ? 'Příležitostný útok' : 'Opportunity attack',
        tone: 'warn',
      });
    }
    return chips;
  }

  if (kind === 'defend') {
    chips.push({
      id: 'defend',
      label: locale === 'cs' ? 'Obranný postoj' : 'Defensive stance',
      tone: 'neutral',
    });
    return chips;
  }

  if (kind === 'disengage') {
    chips.push({
      id: 'disengage',
      label: locale === 'cs' ? 'Odpoutání — bez útoků příležitosti' : 'Disengage — no opportunity attacks',
      tone: 'neutral',
    });
    return chips;
  }

  if (kind === 'flee') {
    const ok = beat.success;
    chips.push({
      id: 'flee',
      label: ok
        ? (locale === 'cs' ? 'Útěk — povedlo se' : 'Fled — success')
        : (locale === 'cs' ? 'Útěk — neúspěch' : 'Fled — failed'),
      tone: ok ? 'hit' : 'miss',
    });
    if (beat.roll?.total != null && beat.dc != null) {
      chips.push({
        id: 'flee-roll',
        label: locale === 'cs'
          ? `Hod ${beat.roll.total} vs OČ ${beat.dc}`
          : `Roll ${beat.roll.total} vs DC ${beat.dc}`,
        tone: 'neutral',
      });
    }
    return chips;
  }

  if (kind === 'spell_damage') {
    const spell = beat.spell_name
      ? displaySpell(beat.spell_name, locale)
      : (locale === 'cs' ? 'Kouzlo' : 'Spell');
    const dmg = typeof beat.damage === 'number' ? beat.damage : undefined;
    if (beat.subtype === 'auto_hit') {
      chips.push({
        id: 'spell-auto',
        label: locale === 'cs'
          ? `${spell}: automatický zásah${dmg != null ? `, ${formatDamageCs(dmg)}` : ''}`
          : `${spell}: auto hit${dmg != null ? `, ${dmg} damage` : ''}`,
        tone: 'hit',
      });
    } else if (beat.subtype === 'saving_throw') {
      const ok = beat.success;
      chips.push({
        id: 'spell-save',
        label: locale === 'cs'
          ? `${spell}: záchrana ${ok ? 'úspěšná' : 'neúspěšná'}${dmg != null ? `, ${formatDamageCs(dmg)}` : ''}`
          : `${spell}: save ${ok ? 'success' : 'fail'}${dmg != null ? `, ${dmg} damage` : ''}`,
        tone: ok ? 'neutral' : 'hit',
      });
    }
    const enemy = beat.enemy;
    if (enemy?.name && enemy.hp_current != null) {
      const foe = displayCreature(enemy.name, locale);
      const chip = hpChip('enemy-hp', foe, enemy.hp_current, enemy.hp_max, locale);
      if (chip) chips.push(chip);
    }
    return chips;
  }

  return chips;
}

export function chipsFromResolution(
  resolution: TurnResolution | null | undefined,
  locale: Locale,
): ResolutionChip[] {
  if (!resolution?.beats?.length) return [];
  const chips: ResolutionChip[] = [];
  resolution.beats.forEach((beat, index) => {
    beatToChips(beat, locale).forEach(chip => {
      chips.push({ ...chip, id: `${index}-${chip.id}` });
    });
  });
  return chips;
}

export function suggestNextCombatAction(
  character: Character,
  locale: Locale,
): string | null {
  const tactics = readCombatTactics(character);
  const wr = tactics?.weapon_range;
  if (wr?.can_attack === false && wr.denial) {
    return locale === 'cs' ? 'Přibliž se na dosah útoku.' : 'Close distance to attack.';
  }
  if (!isPlayerTurn(character)) {
    return locale === 'cs' ? 'Počkej na tah protivníka.' : 'Wait for the enemy turn.';
  }
  return null;
}

function isPlayerTurn(character: Character): boolean {
  return character.combat_turn !== 'enemy';
}

export function attackResolutionUsesSpellName(
  beat: TurnResolutionBeat,
): boolean {
  return Boolean(beat.spell_name) && beat.kind === 'attack';
}

export function foeDisplayName(name: string, locale: Locale): string {
  return displayCreature(name, locale);
}