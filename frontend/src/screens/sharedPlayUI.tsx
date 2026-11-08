import { useEffect, useRef, useState } from 'react';
import type { TurnPhase } from '../pendingTurn';
import type { Character, JournalEvent, LocationReference, Spell } from '../types';
import { useI18n } from '../i18n';
import { isFallenError, playActionChips, scenePrompt } from '../game/gameActions';
import { JournalResultBody } from '../components/journalBlocks';
import { SpellSlots } from '../components/characterVitals';

export interface PlayScreenProps {
  character: Character;
  events: JournalEvent[];
  spells: Spell[];
  locations: LocationReference[];
  busy: boolean;
  turnPhase?: TurnPhase;
  error: string | null;
  narrationStatus: 'narrated' | 'fallback' | null;
  turnDelta?: string | null;
  onAction: (action: string) => void;
  onResumePending?: () => void;
  onOpenSheet: () => void;
  onOpenMap?: () => void;
  onOpenSettings?: () => void;
  onCancelTurn?: () => void;
}

export function TurnDeltaStrip({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return <p className="turn-delta-strip" role="status">{message}</p>;
}

export function PlaySceneChrome({
  character,
  events,
  onOpenSheet,
  combat,
}: {
  character: Character;
  events: JournalEvent[];
  onOpenSheet: () => void;
  combat?: boolean;
}) {
  const { t } = useI18n();
  const hpRatio = character.max_hp > 0
    ? Math.max(0, Math.min(100, (character.hp / character.max_hp) * 100))
    : 0;
  const sceneLine = combat ? t('Combat in progress') : (character.location || t('The Whispering Cellar'));

  return (
    <header className="play-scene-chrome">
      <div className="play-scene-chrome-titles">
        {!combat && <p className="play-scene-eyebrow">{t('CHAPTER ONE')}</p>}
        <h1 className="play-scene-title">{sceneLine}</h1>
        {!combat && <p className="play-scene-hint">{scenePrompt(character, events, t)}</p>}
      </div>
      <div className="play-status-bar" role="group" aria-label={t('Hit points')}>
        <div className="play-status-hp">
          <span className="play-status-label">HP</span>
          <div
            className="play-status-track"
            role="progressbar"
            aria-valuenow={hpRatio}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${hpRatio}%` }} className={hpRatio <= 25 ? 'critical' : ''} />
          </div>
          <strong className="play-status-numbers">{character.hp}<small>/{character.max_hp}</small></strong>
        </div>
        <div className="play-status-meta">
          <span className="play-status-slots" title={t('Spell slots')}><SpellSlots character={character} t={t} /></span>
          <span>{t('AC')} {character.armor_class}</span>
        </div>
        <button type="button" className="play-status-icon" aria-label={t('Inventory')} title={t('Inventory')} onClick={onOpenSheet}>🎒</button>
      </div>
    </header>
  );
}

/** @deprecated Use PlaySceneChrome — kept for tests that import the symbol. */
export function CompactHud({ character, onOpenSheet }: { character: Character; onOpenSheet: () => void }) {
  return <PlaySceneChrome character={character} events={[]} onOpenSheet={onOpenSheet} />;
}

export function PlayJournal({
  character,
  events,
  busy,
  turnPhase,
  narrationStatus,
  onResumePending,
  onCancelTurn,
}: Pick<PlayScreenProps, 'character' | 'events' | 'busy' | 'turnPhase' | 'narrationStatus' | 'onResumePending' | 'onCancelTurn'>) {
  const { t } = useI18n();
  const [thinkingSeconds, setThinkingSeconds] = useState(0);
  useEffect(() => {
    if (!busy) { setThinkingSeconds(0); return; }
    setThinkingSeconds(0);
    const started = Date.now();
    const timer = window.setInterval(() => setThinkingSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);
  return (
    <div className="journal-scene" role="log" aria-label={t('Adventure journal')} aria-live="polite">
      {events.length === 0 && (
        <div className="scene-empty">
          <span aria-hidden="true">✦</span>
          <p>{t(character.location === 'The Whispering Cellar'
            ? 'The cellar waits in silence. Describe what you try — explore, talk, attack, flee or rest.'
            : 'This place waits in silence. Describe what you try — explore, talk, attack, flee or rest.')}</p>
        </div>
      )}
      {narrationStatus === 'fallback' && (
        <p className="storyteller-status" role="status">
          {t('Offline storyteller is active. Set up Ollama in `.env` for AI-written narration.')}
        </p>
      )}
      {events.map(event => (
        <article className={`journal-beat ${event.result.includes('LEVEL UP!') ? 'level-up-entry' : ''}`} key={event.id}>
          <time>{new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
          <p className="journal-action"><span aria-hidden="true">›</span> {event.action}</p>
          {event.result.includes('LEVEL UP!') && <strong className="level-up-banner">{t('LEVEL UP')}</strong>}
          {event.action.toLowerCase().includes('rest') && event.result.toLowerCase().includes('cannot rest') && (
            <strong className="spell-warning" role="status">{t('Rest unavailable during combat')}</strong>
          )}
          <div className="journal-narration"><JournalResultBody result={event.result} /></div>
        </article>
      ))}
      {turnPhase === 'recovering' && !busy && onResumePending && (
        <p className="storyteller-status" role="status">
          {t('A turn may have been interrupted. Retry with the same idempotency key.')}
          <button type="button" className="link-button" onClick={onResumePending}>{t('Recover last action')}</button>
        </p>
      )}
      {busy && (
        <div className="thinking" role="status">
          <div key={thinkingSeconds >= 12 ? 'long' : thinkingSeconds >= 5 ? 'mid' : 'short'}>
            <span className="thinking-die" aria-hidden="true">◆</span>
            <span className="thinking-elapsed">
              {turnPhase === 'sending'
                ? t('Sending your action…')
                : turnPhase === 'resolved'
                  ? t('The dice have spoken. The narrator continues…')
                  : turnPhase === 'recovering'
                    ? t('Restoring the saved result…')
                    : thinkingSeconds >= 12
                      ? t('Still weaving. Local models can take a moment.')
                      : thinkingSeconds >= 5
                        ? t('A.U.R.I.O.N. is weighing your fate…')
                        : t('The narrator is shaping the moment…')}
            </span>
          </div>
          {thinkingSeconds >= 12 && onCancelTurn && (
            <button type="button" className="thinking-cancel" onClick={onCancelTurn}>{t('Cancel this turn')}</button>
          )}
        </div>
      )}
    </div>
  );
}

export function PlayErrorPanel({
  error,
  onOpenSettings,
}: {
  error: string | null;
  onOpenSettings?: () => void;
}) {
  const { t } = useI18n();
  const [hidden, setHidden] = useState(false);
  useEffect(() => { setHidden(false); }, [error]);
  if (!error || hidden || isFallenError(error)) return null;
  return (
    <div className="error-panel" role="alert" title={error} data-error={error}>
      <p className="error-panel-title">{t('The thread of the weave has slipped.')}</p>
      <p className="error-panel-body">{t('A.U.R.I.O.N. lost its connection to the narrator. Check your narrator settings and try again.')}</p>
      <div className="error-panel-actions">
        {onOpenSettings && (
          <button type="button" className="primary" onClick={onOpenSettings}>{t('Open settings')}</button>
        )}
        <button type="button" className="ghost" onClick={() => setHidden(true)}>{t('Try again')}</button>
      </div>
      <details className="error-panel-technical">
        <summary>{t('Technical detail')}</summary>
        <code>{error}</code>
      </details>
    </div>
  );
}

export function ActionComposer(props: PlayScreenProps) {
  const {
    character, events, spells, locations, busy, onAction, onOpenMap, onOpenSheet,
  } = props;
  const { t } = useI18n();
  const actionInputRef = useRef<HTMLInputElement>(null);
  const [action, setAction] = useState('');
  const [selectedSpell, setSelectedSpell] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const enemy = character.in_combat ? character.combatant : null;
  const accessibleSpells = new Set([...(character.known_spells ?? []), ...(character.prepared_spells ?? [])]);
  const characterSpells = spells
    .filter(spell => accessibleSpells.has(spell.name))
    .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name));
  const hasPotion = character.inventory.some(item => item.toLowerCase().includes('potion'));
  const chips = playActionChips(character, events, locations, t, characterSpells.length > 0, hasPotion);

  const actionSpellName = action.match(/^(?:cast|kouzli(?:t)?)\s+(.+?)(?:\s+at\s+.+)?$/i)?.[1]?.trim().replace(/\s+/g, ' ').toLowerCase();
  const actionSpell = characterSpells.find(spell => spell.name.toLowerCase() === actionSpellName);
  const spellWarning = actionSpell && !actionSpell.effect_modeled
    ? t('This spell has no modeled effect yet. It will not be sent and no spell slot will be spent.')
    : null;
  const spellNotice = actionSpell?.name === 'Healing Word'
    ? t('Healing Word is a bonus-action spell in the SRD; this MVP uses your main action.')
    : null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = action.trim();
    if (text && !busy && !spellWarning) {
      onAction(text);
      setAction('');
      setSelectedSpell('');
    }
  };

  const openSpellPicker = () => {
    const select = document.getElementById('cast-spell') as HTMLSelectElement | null;
    select?.focus();
    select?.click();
  };

  const handleChip = (chip: (typeof chips)[number]) => {
    if (chip.run === 'map') {
      onOpenMap?.();
      return;
    }
    if (chip.run === 'focus') {
      actionInputRef.current?.focus();
      return;
    }
    if (chip.action) onAction(chip.action);
  };

  return (
    <div className="action-composer-wrap action-composer-text-first">
      {chips.length > 0 && (
        <div className="suggested-actions suggested-actions-row" aria-label={t('Suggested actions')}>
          {chips.map(chip => (
            <button type="button" key={chip.key} disabled={busy} onClick={() => handleChip(chip)}>{chip.label}</button>
          ))}
        </div>
      )}
      <form className="composer-input-shell" onSubmit={handleSubmit}>
        <div className="composer-field">
          <div className="composer-field-tools" aria-hidden={false}>
            {character.in_combat ? (
              <button
                type="button"
                className="composer-inline-icon"
                disabled={busy}
                aria-label={t('Attack')}
                title={t('Attack')}
                onClick={() => onAction(`attack ${enemy?.name ?? 'the enemy'}`)}
              >
                ⚔
              </button>
            ) : (
              <button
                type="button"
                className="composer-inline-icon"
                disabled={busy}
                aria-label={t('Travel')}
                title={t('Travel')}
                onClick={() => onOpenMap?.()}
              >
                ⌖
              </button>
            )}
            <button
              type="button"
              className="composer-inline-icon"
              disabled={busy}
              aria-label={t('Inventory')}
              title={t('Inventory')}
              onClick={onOpenSheet}
            >
              🎒
            </button>
            {characterSpells.length > 0 && (
              <button
                type="button"
                className="composer-inline-icon"
                disabled={busy}
                aria-label={t('Cast spell')}
                title={t('Cast spell')}
                onClick={openSpellPicker}
              >
                ✦
              </button>
            )}
            {character.in_combat && hasPotion && (
              <button
                type="button"
                className="composer-inline-icon"
                disabled={busy}
                aria-label={t('Use potion')}
                title={t('Use potion')}
                onClick={() => onAction('use potion')}
              >
                ⚗
              </button>
            )}
          </div>
          <input
            ref={actionInputRef}
            value={action}
            onChange={event => setAction(event.target.value)}
            placeholder={busy ? t('The narrator is writing…') : t('What do you do?')}
            disabled={busy}
            aria-label={t('Your action')}
            id="adventure-action-input"
          />
          <button
            type="button"
            className="composer-inline-icon composer-help-toggle"
            aria-label={t('How actions and exploration work')}
            aria-expanded={helpOpen}
            onClick={() => setHelpOpen(open => !open)}
          >
            ?
          </button>
          <button
            type="submit"
            className="composer-send"
            disabled={busy || !action.trim() || Boolean(spellWarning)}
            aria-label={t('Send action')}
          >
            →
          </button>
        </div>
      </form>
      {characterSpells.length > 0 && (
        <div className="spell-picker spell-picker-compact">
          <select
            id="cast-spell"
            className="visually-compact-select"
            value={selectedSpell}
            disabled={busy}
            onChange={event => {
              const name = event.target.value;
              setSelectedSpell(name);
              if (!name) {
                setAction('');
                return;
              }
              const spell = characterSpells.find(item => item.name === name);
              const target = spell && enemy && spell.effect_modeled &&
                ['Burning Hands', 'Eldritch Blast', 'Fire Bolt', 'Magic Missile', 'Sacred Flame', 'Scorching Ray', 'Vicious Mockery'].includes(name)
                ? ` at ${enemy.name}`
                : '';
              setAction(`cast ${name}${target}`);
              actionInputRef.current?.focus();
            }}
            aria-label={t('Your spells')}
          >
            <option value="">{t('Choose a spell to cast')}</option>
            {characterSpells.map(spell => <option key={spell.name} value={spell.name}>{spell.name}</option>)}
          </select>
        </div>
      )}
      {spellWarning && <p className="spell-warning" role="status">{spellWarning}</p>}
      {!spellWarning && spellNotice && <p className="spell-warning" role="status">{spellNotice}</p>}
      {helpOpen && (
        <div className="composer-help-popover" role="note">
          <p>{t('Each search uses one six-sided die: a 1 brings an enemy; other results may reveal clues, quiet, or 1–4 gold coins. After a fight or escape, your next search is safe. Rejected actions cost no Adventure Mana.')}</p>
          <p>{t('Action words guide ability checks: strength for force, dexterity for stealth, constitution to endure, intelligence to inspect, wisdom to notice, and charisma to persuade.')}</p>
        </div>
      )}
    </div>
  );
}
