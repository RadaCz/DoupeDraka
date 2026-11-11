import type { Character } from '../types';

export function sneakAttackDiceLabel(level: number): string {
  const count = 1 + Math.max(0, Math.floor((level - 1) / 2));
  return `${count}d6`;
}

export type ClassFeatureLine = { key: string; label: string; detail?: string; status?: string };

export function classFeatureLines(character: Character, t: (value: string) => string): ClassFeatureLine[] {
  const lines: ClassFeatureLine[] = [];
  const klass = character.character_class;

  if (klass === 'fighter' && character.fighting_style) {
    const style =
      character.fighting_style === 'dueling' ? t('Dueling (+2 melee damage)') : t('Defense (+1 AC in armor)');
    lines.push({ key: 'fighting_style', label: t('Fighting Style'), detail: style });
    lines.push({
      key: 'second_wind',
      label: t('Second Wind'),
      status: character.second_wind_available ? t('Ready') : t('Spent until rest'),
    });
  }

  if (klass === 'rogue') {
    if (character.expertise_skills?.length) {
      lines.push({
        key: 'expertise',
        label: t('Expertise'),
        detail: character.expertise_skills.join(' · '),
      });
    }
    lines.push({
      key: 'sneak_attack',
      label: t('Sneak Attack'),
      detail: `${sneakAttackDiceLabel(character.level)} — ${t('advantage or hidden')}`,
    });
    lines.push({
      key: 'thieves_cant',
      label: t("Thieves' Cant"),
      detail: t('Narrative flavor — no engine shortcut'),
    });
  }

  if (klass === 'cleric') {
    const domain = character.divine_domain === 'life' ? t('Life Domain (MVP)') : character.divine_domain;
    lines.push({ key: 'domain', label: t('Divine Domain'), detail: domain });
    lines.push({
      key: 'disciple',
      label: t('Disciple of Life'),
      detail: t('+2 + spell level on Cure Wounds / Healing Word'),
    });
  }

  if (klass === 'wizard') {
    const book = character.known_spells?.length ?? 0;
    lines.push({
      key: 'spellbook',
      label: t('Spellbook'),
      detail: `${book} ${t('spells known')}`,
    });
    lines.push({
      key: 'prepared',
      label: t('Prepared spells'),
      detail: `${character.prepared_spells?.length ?? 0} ${t('ready')}`,
    });
    lines.push({
      key: 'arcane_recovery',
      label: t('Arcane Recovery'),
      status: !character.arcane_recovery_available
        ? t('Spent until long rest')
        : character.arcane_recovery_ready
          ? t('Ready after short rest')
          : t('Take a short rest first'),
    });
  }

  return lines;
}
