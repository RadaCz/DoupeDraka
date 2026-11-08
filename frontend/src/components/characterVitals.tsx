import type { Character } from '../types';
import { useI18n } from '../i18n';

export function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

export function HpBar({ character }: { character: Character }) {
  const { t } = useI18n();
  const percent = character.max_hp > 0 ? Math.max(0, Math.min(100, (character.hp / character.max_hp) * 100)) : 0;
  return (
    <div className="resource-bar">
      <div className="resource-bar-label"><span>{t('Hit points')}</span><strong>{character.hp} / {character.max_hp}</strong></div>
      <div className="hp-track" role="progressbar" aria-label={t('Hit points')} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <span className={percent <= 25 ? 'critical' : ''} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function SpellSlots({ character, t }: { character: Character; t: (value: string) => string }) {
  const maximum = Object.entries(character.max_spell_slots ?? {})
    .map(([level, count]) => [Number(level), count] as const)
    .filter(([, count]) => count > 0)
    .sort(([left], [right]) => left - right);
  if (!maximum.length) return <>{t('None')}</>;
  return <>{maximum.map(([level, count]) => `L${level}: ${character.spell_slots?.[level] ?? 0}/${count}`).join(' · ')}</>;
}
