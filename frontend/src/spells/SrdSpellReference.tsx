import { useMemo, useState } from 'react';
import type { Character, Spell } from '../types';
import { useI18n } from '../i18n';
import { titleCase } from '../components/characterVitals';
import { highestSpellLevel } from './spellbook';

export function SrdSpellReference({ character, spells }: { character: Character | null; spells: Spell[] }) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [spellLevel, setSpellLevel] = useState('all');
  const [scope, setScope] = useState<'level' | 'catalog'>('level');
  const maxSpellLevel = highestSpellLevel(character);
  const filtered = useMemo(() => spells.filter(spell => {
    const matchesSearch = `${spell.name} ${spell.school} ${spell.text}`.toLowerCase().includes(search.toLowerCase());
    const matchesLevel = spellLevel === 'all' || spell.level === Number(spellLevel);
    const matchesProgression = scope === 'catalog' || (maxSpellLevel > 0 && spell.level <= maxSpellLevel);
    return matchesSearch && matchesLevel && matchesProgression;
  }).slice(0, 60), [spells, search, spellLevel, scope, maxSpellLevel]);

  return (
    <div className="srd-spell-ref">
      <p className="notice-card" role="note">
        {t('Full SRD reference for study. Your spellbook tab shows only what your hero knows. Catalog spells may lack engine support.')}
      </p>
      <div className="spell-scope" role="group" aria-label={t('Spell reference range')}>
        <button type="button" aria-pressed={scope === 'level'} className={scope === 'level' ? 'selected' : ''} onClick={() => { setScope('level'); setSpellLevel('all'); }}>
          {t('By level')}
        </button>
        <button type="button" aria-pressed={scope === 'catalog'} className={scope === 'catalog' ? 'selected' : ''} onClick={() => { setScope('catalog'); setSpellLevel('all'); }}>
          {t('Full SRD reference')}
        </button>
      </div>
      <div className="tool-search-row">
        <input className="form-input" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('Search spells, schools or descriptions…')} aria-label={t('Search spell library')} />
        <select className="form-select" value={spellLevel} onChange={event => setSpellLevel(event.target.value)} aria-label={t('Filter by spell level')} disabled={scope === 'level' && maxSpellLevel === 0}>
          <option value="all">{t('All levels')}</option>
          {Array.from({ length: scope === 'catalog' ? 10 : maxSpellLevel > 0 ? maxSpellLevel + 1 : 0 }, (_, index) => (
            <option value={index} key={index}>{index === 0 ? t('Cantrips') : `${t('Level')} ${index}`}</option>
          ))}
        </select>
      </div>
      <p className="results-caption">
        {t('Showing')} {filtered.length} {t('spells')}
        {scope === 'level' && maxSpellLevel > 0 ? ` · ${t('through level')} ${maxSpellLevel}` : ''}
      </p>
      <div className="spell-list">
        {filtered.map(spell => (
          <details className="spell-card" key={spell.name}>
            <summary>
              <span className="spell-level">{spell.level === 0 ? 'C' : spell.level}</span>
              <span className="spell-name">
                <strong>{spell.name}</strong>
                <small>{t(titleCase(spell.school))} · {spell.range}</small>
              </span>
              {spell.effect_modeled ? <span className="char-v2-tag">{t('Engine modeled')}</span> : <span className="char-v2-tag warn">{t('Catalog only')}</span>}
            </summary>
            <p>{spell.text}</p>
          </details>
        ))}
        {!filtered.length && <p className="empty-note">{t('No spells match that search. Try another name or level.')}</p>}
      </div>
    </div>
  );
}
