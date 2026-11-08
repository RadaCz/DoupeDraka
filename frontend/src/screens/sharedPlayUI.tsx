import { useCallback, useEffect, useRef, useState } from 'react';
import type { TurnPhase } from '../pendingTurn';
import type { Character, Economy, JournalEvent, LocationReference, Spell } from '../types';
import { useI18n } from '../i18n';
import { isFallenError, playActionChips } from '../game/gameActions';
import { JournalResultBody } from '../components/journalBlocks';
import { SpellSlots } from '../components/characterVitals';
import { ShareButton } from '../components/ShareButton';
import { buildJournalShareMessage, journalExcerpt } from '../share/adventureShare';

export interface PlayScreenProps {
  character: Character;
  economy?: Economy | null;
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
  onRetryError?: () => void;
}

export function TurnDeltaStrip({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return <p className="turn-delta-strip" role="status">{message}</p>;
}

export function PlaySceneChrome({
  character,
  economy,
  combat,
}: {
  character: Character;
  economy?: Economy | null;
  events?: JournalEvent[];
  onOpenSheet?: () => void;
  combat?: boolean;
}) {
  const { t } = useI18n();
  const enemy = character.combatant;
  const hpRatio = character.max_hp > 0
    ? Math.max(0, Math.min(100, (character.hp / character.max_hp) * 100))
    : 0;
  const placeLine = combat
    ? (enemy?.name ?? t('Combat in progress'))
    : (character.location || t('The Whispering Cellar'));
  const manaLabel = economy ? economy.balance.toFixed(1) : '—';

  return (
    <header className="play-immersive-bar" role="banner">
      <div className="play-immersive-bar-inner">
        <h1 className="play-immersive-place" id="play-scene-title">
          {combat && <span className="play-immersive-combat-glyph" aria-hidden="true">⚔</span>}
          <span className="play-immersive-place-text">{placeLine}</span>
        </h1>
        <div className="play-immersive-vitals" role="group" aria-label={t('Hit points')}>
          <span className="play-immersive-stat play-immersive-hp">
            <span className="play-immersive-hp-track" aria-hidden="true">
              <span style={{ width: `${hpRatio}%` }} className={hpRatio <= 25 ? 'critical' : ''} />
            </span>
            <span className="play-immersive-stat-label">HP</span>
            <span className="play-immersive-num tabular-nums">
              {character.hp}<span className="play-immersive-num-dim">/{character.max_hp}</span>
            </span>
          </span>
          <span className="play-immersive-stat play-immersive-ac" title={t('ARMOR CLASS')}>
            <span className="play-immersive-stat-glyph" aria-hidden="true">🛡️</span>
            <span className="play-immersive-num tabular-nums">{character.armor_class}</span>
          </span>
          {(character.known_spells?.length ?? 0) > 0 && (
            <span className="play-immersive-stat play-immersive-slots tabular-nums" title={t('Spell slots')}>
              <span className="play-immersive-stat-glyph" aria-hidden="true">✨</span>
              <SpellSlots character={character} t={t} />
            </span>
          )}
          <span className="play-immersive-stat play-immersive-mana" title={t('NARRATOR CREDITS')}>
            <span className="play-immersive-stat-glyph" aria-hidden="true">⚡</span>
            <span className="play-immersive-num tabular-nums">{manaLabel}</span>
          </span>
          {combat && enemy && (
            <span className="play-immersive-stat play-immersive-enemy-hp tabular-nums" title={enemy.name}>
              <span className="play-immersive-stat-label">vs</span>
              <span className="play-immersive-num">{enemy.hp}/{enemy.max_hp}</span>
            </span>
          )}
        </div>
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
  const journalRef = useRef<HTMLDivElement>(null);
  const [thinkingSeconds, setThinkingSeconds] = useState(0);
  const scrollJournalToLatest = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const node = journalRef.current;
    if (!node) return;
    const top = node.scrollHeight;
    if (typeof node.scrollTo === 'function') {
      try {
        node.scrollTo({ top, behavior });
        return;
      } catch {
        // JSDOM and some embedded WebViews only support scrollTop.
      }
    }
    node.scrollTop = top;
  }, []);
  useEffect(() => {
    if (!busy) { setThinkingSeconds(0); return; }
    setThinkingSeconds(0);
    const started = Date.now();
    const timer = window.setInterval(() => setThinkingSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);
  useEffect(() => {
    scrollJournalToLatest(events.length > 1 ? 'smooth' : 'auto');
  }, [events, scrollJournalToLatest]);
  useEffect(() => {
    if (!busy) scrollJournalToLatest('smooth');
  }, [busy, scrollJournalToLatest]);
  return (
    <div className="journal-scene" ref={journalRef} role="log" aria-label={t('Adventure journal')} aria-live="polite">
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
          <div className="journal-beat-head">
            <time>{new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
            <ShareButton
              message={buildJournalShareMessage(character, journalExcerpt(event.result), event.action)}
            />
          </div>
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
  onRetry,
}: {
  error: string | null;
  onOpenSettings?: () => void;
  onRetry?: () => void;
}) {
  const { t } = useI18n();
  const [hidden, setHidden] = useState(false);
  useEffect(() => { setHidden(false); }, [error]);
  if (!error || hidden || isFallenError(error)) return null;
  const dismiss = () => setHidden(true);
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
      return;
    }
    dismiss();
  };
  return (
    <div className="error-panel" role="alert" title={error} data-error={error}>
      <p className="error-panel-title">{t('The thread of the weave has slipped.')}</p>
      <p className="error-panel-body">{t('A.U.R.I.O.N. lost its connection to the narrator. Check your narrator settings and try again.')}</p>
      <div className="error-panel-actions">
        {onOpenSettings && (
          <button type="button" className="primary" onClick={onOpenSettings}>{t('Open settings')}</button>
        )}
        <button type="button" className="ghost" onClick={handleRetry}>
          {onRetry ? t('Try again') : t('Dismiss')}
        </button>
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
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
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

  const closeActionMenu = () => setActionMenuOpen(false);

  const runMenuAction = (runner: () => void) => {
    closeActionMenu();
    runner();
  };

  return (
    <div className="action-composer-wrap action-composer-text-first action-composer-immersive">
      {chips.length > 0 && (
        <div className="suggested-actions-scroll">
          <div className="suggested-actions suggested-actions-row" aria-label={t('Suggested actions')}>
            {chips.map(chip => (
              <button type="button" key={chip.key} disabled={busy} onClick={() => handleChip(chip)}>{t(chip.label)}</button>
            ))}
          </div>
        </div>
      )}
      <form className="composer-input-shell composer-input-immersive" onSubmit={handleSubmit}>
        <div className="composer-field composer-field-immersive">
          <button
            type="button"
            className="composer-menu-toggle"
            disabled={busy}
            aria-label={t('Play actions')}
            aria-expanded={actionMenuOpen}
            aria-haspopup="dialog"
            onClick={() => setActionMenuOpen(open => !open)}
          >
            <span aria-hidden="true">🎲</span>
          </button>
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
            type="submit"
            className="composer-send composer-send-immersive"
            disabled={busy || !action.trim() || Boolean(spellWarning)}
            aria-label={t('Send action')}
            aria-busy={busy}
          >
            {busy ? <span className="composer-send-spinner" aria-hidden="true" /> : <span aria-hidden="true">→</span>}
          </button>
        </div>
      </form>
      {actionMenuOpen && (
        <>
          <button type="button" className="composer-sheet-backdrop" aria-label={t('Close')} onClick={closeActionMenu} />
          <div className="composer-action-sheet" role="dialog" aria-modal="true" aria-label={t('Play actions')}>
            <p className="composer-action-sheet-title">{t('Play actions')}</p>
            <ul className="composer-action-sheet-list">
              {character.in_combat ? (
                <li>
                  <button type="button" disabled={busy} onClick={() => runMenuAction(() => onAction(`attack ${enemy?.name ?? 'the enemy'}`))}>
                    ⚔ {t('Attack')}
                  </button>
                </li>
              ) : (
                <li>
                  <button type="button" disabled={busy} onClick={() => runMenuAction(() => onOpenMap?.())}>
                    ⌖ {t('Travel')}
                  </button>
                </li>
              )}
              <li>
                <button type="button" disabled={busy} onClick={() => runMenuAction(onOpenSheet)}>🎒 {t('Inventory')}</button>
              </li>
              {characterSpells.length > 0 && (
                <li>
                  <button type="button" disabled={busy} onClick={() => runMenuAction(openSpellPicker)}>✦ {t('Cast spell')}</button>
                </li>
              )}
              {character.in_combat && hasPotion && (
                <li>
                  <button type="button" disabled={busy} onClick={() => runMenuAction(() => onAction('use potion'))}>⚗ {t('Use potion')}</button>
                </li>
              )}
              {!character.in_combat && character.hp < character.max_hp && (
                <li>
                  <button type="button" disabled={busy} onClick={() => runMenuAction(() => onAction('rest'))}>◎ {t('Rest')}</button>
                </li>
              )}
              <li>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    closeActionMenu();
                    setHelpOpen(true);
                  }}
                >
                  ? {t('How actions and exploration work')}
                </button>
              </li>
            </ul>
          </div>
        </>
      )}
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
          <p>{t('Each search uses one six-sided die: a 1 brings an enemy; other results may reveal clues, quiet, or 1–4 gold coins. After a fight or escape, your next search is safe. Rejected actions cost no narrator credits.')}</p>
          <p>{t('Action words guide ability checks: strength for force, dexterity for stealth, constitution to endure, intelligence to inspect, wisdom to notice, and charisma to persuade.')}</p>
        </div>
      )}
    </div>
  );
}
