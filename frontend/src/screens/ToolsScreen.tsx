import { useEffect, useState } from 'react';
import type { Character, ReferenceCatalog, Spell } from '../types';
import { useI18n } from '../i18n';
import { titleCase } from '../components/characterVitals';
import { SpellbookPanel } from '../spells/SpellbookPanel';
import { RulesGlossaryPanel, SpellRulesPanel } from '../spells/SpellRulesPanel';
import { SrdSpellReference } from '../spells/SrdSpellReference';

const MONSTERS = ['kobold', 'goblin', 'wolf', 'bandit', 'ghoul', 'ogre'];

type ToolTab = 'spellbook' | 'rules' | 'srd' | 'calculator';

export function ToolsScreen({
  character,
  catalog,
  spells,
  calculating,
  calculation,
  error,
  onCalculate,
  busy,
  onCastAction,
  actionError,
}: {
  character: Character | null;
  catalog: ReferenceCatalog;
  spells: Spell[];
  calculating: boolean;
  calculation: Record<string, unknown> | null;
  error: string | null;
  onCalculate: (level: number, monsters: string[]) => void;
  busy?: boolean;
  onCastAction?: (action: string) => void;
  actionError?: string;
}) {
  const { t } = useI18n();
  const [tool, setTool] = useState<ToolTab>('spellbook');
  const [level, setLevel] = useState(character?.level ?? 1);
  const [monster, setMonster] = useState('goblin');
  const [count, setCount] = useState(1);
  const [lastCast, setLastCast] = useState('');

  useEffect(() => {
    if (!busy) setLastCast('');
  }, [busy]);

  const handleCast = (action: string) => {
    if (!onCastAction || busy) return;
    setLastCast(action);
    onCastAction(action);
  };

  return (
    <section className="screen tools-screen tools-v2" aria-busy={busy || undefined}>
      <div className="page-title">
        <p className="eyebrow">{t('FIELD GUIDE')}</p>
        <h1>{t("Adventurer's tools")}</h1>
        <p>{t('Your spellbook, rules help, and planning utilities.')}</p>
      </div>
      <div className="tool-switch tools-v2-tabs" role="tablist" aria-label={t('Choose a tool')}>
        <button type="button" role="tab" aria-selected={tool === 'spellbook'} className={tool === 'spellbook' ? 'active' : ''} onClick={() => setTool('spellbook')}>
          ✧ {t('My spellbook')}
        </button>
        <button type="button" role="tab" aria-selected={tool === 'rules'} className={tool === 'rules' ? 'active' : ''} onClick={() => setTool('rules')}>
          ? {t('Rules help')}
        </button>
        <button type="button" role="tab" aria-selected={tool === 'srd'} className={tool === 'srd' ? 'active' : ''} onClick={() => setTool('srd')}>
          📖 {t('SRD reference')}
        </button>
        <button type="button" role="tab" aria-selected={tool === 'calculator'} className={tool === 'calculator' ? 'active' : ''} onClick={() => setTool('calculator')}>
          ⚔ {t('Combat balance')}
        </button>
      </div>
      {actionError && tool === 'spellbook' && (
        <p className="char-v2-inline-error" role="alert">{actionError}</p>
      )}
      {busy && tool === 'spellbook' && (
        <p className="char-v2-busy" role="status">{t('Sending your action…')}</p>
      )}
      {tool === 'spellbook' && character && (
        <section className="tool-panel">
          <SpellbookPanel
            character={character}
            spells={spells}
            busy={busy}
            lastCast={lastCast}
            onCast={handleCast}
          />
        </section>
      )}
      {tool === 'spellbook' && !character && (
        <p className="empty-note">{t('Choose or create an adventurer to open a spellbook.')}</p>
      )}
      {tool === 'rules' && (
        <section className="tool-panel">
          <SpellRulesPanel />
          <RulesGlossaryPanel />
        </section>
      )}
      {tool === 'srd' && (
        <section className="tool-panel">
          <SrdSpellReference character={character} spells={spells} />
        </section>
      )}
      {tool === 'calculator' && (
        <section className="tool-panel">
          <div className="calculator-intro"><span aria-hidden="true">⚔</span><div><h2>{t('Balance an encounter')}</h2><p>{t("Estimate a chosen group of monsters against a party's level using XP thresholds.")}</p></div></div>
          <p className="notice-card" role="note">{t('This is a planning calculator, not a random encounter roll, and it does not start a fight. Random exploration encounters need a separate game system.')}</p>
          <label className="field-label" htmlFor="party-level">{t('Your party level')}</label>
          <div className="stepper"><button type="button" aria-label={t('Decrease party level')} onClick={() => setLevel(value => Math.max(1, value - 1))}>−</button><strong id="party-level">{t('Level')} {level}</strong><button type="button" aria-label={t('Increase party level')} onClick={() => setLevel(value => Math.min(20, value + 1))}>+</button></div>
          <label className="field-label" htmlFor="encounter-monster">{t('Monster')}</label>
          <select className="form-select full-select" id="encounter-monster" value={monster} onChange={event => setMonster(event.target.value)}>
            {MONSTERS.map(item => <option key={item} value={item}>{t(titleCase(item))}</option>)}
          </select>
          <label className="field-label" htmlFor="monster-count">{t('Number of monsters')}</label>
          <div className="stepper"><button type="button" aria-label={t('Decrease monster count')} onClick={() => setCount(value => Math.max(1, value - 1))}>−</button><strong id="monster-count">{count}</strong><button type="button" aria-label={t('Increase monster count')} onClick={() => setCount(value => Math.min(12, value + 1))}>+</button></div>
          <button type="button" className="primary" disabled={calculating} onClick={() => onCalculate(level, Array.from({ length: count }, () => monster))}>{calculating ? t('Calculating…') : t('Rate this encounter')}</button>
          {error && <p className="error" role="alert">{error}</p>}
          {calculation && (
            <div className={`encounter-result ${String(calculation.band)}`}>
              <small>{t('ENCOUNTER RATING')}</small><strong>{t(titleCase(String(calculation.band)))}</strong>
              <p>{String(calculation.adjusted_xp)} adjusted XP · {String(calculation.multiplier)}× group multiplier</p>
              <p>{t('Thresholds for this party')} — {t('Easy')} {String((calculation.thresholds as Record<string, unknown>)?.easy)}, {t('Medium')} {String((calculation.thresholds as Record<string, unknown>)?.medium)}, {t('Hard')} {String((calculation.thresholds as Record<string, unknown>)?.hard)}, {t('Deadly')} {String((calculation.thresholds as Record<string, unknown>)?.deadly)} XP.</p>
            </div>
          )}
          <p className="screen-footnote">{t('A rules reference only — use your own judgment for encounters that depend on the scene or character abilities.')}</p>
        </section>
      )}
      <section className="section-block reference-summary">
        <div className="section-heading"><div><p className="eyebrow">{t('QUICK REFERENCE')}</p><h2>{t('At a glance')}</h2></div></div>
        <div className="reference-tiles"><div><strong>{catalog.races.length}</strong><small>{t('Species')}</small></div><div><strong>{catalog.classes.length}</strong><small>{t('Classes')}</small></div><div><strong>{catalog.feats.length}</strong><small>{t('SRD feats')}</small></div><div><strong>{catalog.backgrounds.length}</strong><small>{t('Background')}</small></div></div>
      </section>
    </section>
  );
}
