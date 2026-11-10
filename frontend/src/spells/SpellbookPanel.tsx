import { useMemo, useState } from 'react';
import type { Character, Spell } from '../types';
import { useI18n } from '../i18n';
import { SpellSlots } from '../components/characterVitals';
import { titleCase } from '../components/characterVitals';
import {
  castBlockReasonKey,
  heroSpellRows,
  isCasterClass,
  modeledCombatSpells,
  spellEngineKind,
  usesPreparedSpells,
} from './spellbook';
import { SpellDetailSheet } from './SpellDetailSheet';

type Props = {
  character: Character;
  spells: Spell[];
  busy?: boolean;
  onCast?: (action: string) => void;
  lastCast?: string;
};

export function SpellbookPanel({ character, spells, busy = false, onCast, lastCast = '' }: Props) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Spell | null>(null);
  const rows = useMemo(() => heroSpellRows(character, spells), [character, spells]);
  const modeledReady = useMemo(() => modeledCombatSpells(character, spells), [character, spells]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(({ spell }) =>
      `${spell.name} ${spell.school} ${spell.text}`.toLowerCase().includes(q));
  }, [rows, search]);

  const preparedRows = filtered.filter(row => row.prepared);
  const knownRows = filtered.filter(row => row.known && !row.prepared);
  const spontaneousRows = usesPreparedSpells(character.character_class)
    ? []
    : filtered.filter(row => row.known);

  if (!isCasterClass(character.character_class)) {
    return (
      <div className="spellbook-empty">
        <p>{t('This class does not cast spells in the current chapter. Fighters and Rogues use weapons and skills instead.')}</p>
        <p className="spellbook-empty-hint">{t('Open the Rules tab for ability checks, armor class, and combat basics.')}</p>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="spellbook-empty">
        <p>{t('Your hero has no prepared spells yet. Level up or learn spells through play when the engine grants them.')}</p>
      </div>
    );
  }

  const renderGroup = (title: string, items: typeof filtered) => {
    if (!items.length) return null;
    return (
      <section className="spellbook-group" aria-label={title}>
        <h3 className="spellbook-group-title">{title}</h3>
        <ul className="spellbook-list">
          {items.map(({ spell, known, prepared }) => {
            const block = castBlockReasonKey(character, spell, busy);
            const ready = spell.effect_modeled && block === null;
            return (
              <li key={spell.name}>
                <button
                  type="button"
                  className={`spellbook-row${ready ? ' ready' : ''}${!spell.effect_modeled ? ' catalog-only' : ''}`}
                  onClick={() => setSelected(spell)}
                >
                  <span className="spellbook-level">{spell.level === 0 ? 'C' : spell.level}</span>
                  <span className="spellbook-row-copy">
                    <strong>{spell.name}</strong>
                    <small>
                      {t(titleCase(spell.school))} · {spell.range}
                    </small>
                  </span>
                  <span className="spellbook-badges">
                    {prepared && <span className="char-v2-tag prepared">{t('Prepared')}</span>}
                    {known && !prepared && <span className="char-v2-tag">{t('Known')}</span>}
                    {spell.effect_modeled
                      ? <span className="char-v2-tag">{t('Engine modeled')}</span>
                      : <span className="char-v2-tag warn">{t('Catalog only')}</span>}
                    {ready && <span className="char-v2-tag">{t('Ready to cast')}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  };

  return (
    <div className="spellbook-panel">
      <div className="spellbook-slots-card">
        <p className="spellbook-slots-label">{t('Spell slots')}</p>
        <strong><SpellSlots character={character} t={t} /></strong>
        <p className="spellbook-slots-note">
          {t('Only spells marked “Engine modeled” spend slots and change HP or combat through the game engine.')}
        </p>
        {modeledReady.length > 0 && (
          <p className="spellbook-slots-note">
            {t('Ready in combat')}: {modeledReady.map(s => s.name).join(', ')}
          </p>
        )}
      </div>
      <input
        className="form-input"
        value={search}
        onChange={event => setSearch(event.target.value)}
        placeholder={t('Search your spellbook…')}
        aria-label={t('Search your spellbook')}
      />
      {usesPreparedSpells(character.character_class) ? (
        <>
          {renderGroup(t('Prepared spells'), preparedRows)}
          {renderGroup(t('Known spells'), knownRows)}
        </>
      ) : (
        renderGroup(t('Known spells'), spontaneousRows.length ? spontaneousRows : filtered)
      )}
      {!filtered.length && <p className="empty-note">{t('No spells match that search.')}</p>}
      {selected && (
        <SpellDetailSheet
          spell={selected}
          character={character}
          busy={busy}
          lastCast={lastCast}
          onClose={() => setSelected(null)}
          onCast={action => {
            if (onCast) onCast(action);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
