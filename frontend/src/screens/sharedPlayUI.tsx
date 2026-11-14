import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import type { TurnPhase } from '../pendingTurn';
import type { Character, Economy, JournalEvent, LocationReference, Spell } from '../types';
import { useI18n } from '../i18n';
import { displayCreature, displayLocation } from '../i18n/gameDisplay';
import {
  bellWardenLevelGateNotice,
  isFallenError,
  playActionChips,
  primaryPlayChipKey,
  scenePrompt,
} from '../game/gameActions';
import { SpellSlots } from '../components/characterVitals';
import { JournalChronicle } from '../journal/JournalChronicle';
import { visibleQuestTimeline } from '../questProgress';
import { DAMAGE_TARGET_SPELLS } from '../spells/spellbook';

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
  onOpenQuests?: () => void;
}

export function TurnDeltaStrip({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return <p className="turn-delta-strip" role="status">{message}</p>;
}

export function PlaySceneChrome({
  character,
  economy,
  events,
  combat,
  coaching,
}: {
  character: Character;
  economy?: Economy | null;
  events?: JournalEvent[];
  onOpenSheet?: () => void;
  combat?: boolean;
  coaching?: ReactNode;
}) {
  const { t, locale } = useI18n();
  const enemy = character.combatant;
  const hpRatio = character.max_hp > 0
    ? Math.max(0, Math.min(100, (character.hp / character.max_hp) * 100))
    : 0;
  const canonicalPlace = character.location || 'The Whispering Cellar';
  const placeLine = combat
    ? (enemy?.name ? displayCreature(enemy.name, locale) : t('Combat in progress'))
    : displayLocation(canonicalPlace, locale);
  const playerTurn = !combat || (character as Character & { combat_turn?: string }).combat_turn !== 'enemy';
  const liteNarratorOnly = Boolean(
    economy && economy.tier === 'lite' && !economy.tiers.some(tier => tier.key === 'normal'),
  );
  const showHudCredits = economy && !liteNarratorOnly;
  const manaLabel = economy ? economy.balance.toFixed(1) : '—';
  const questObjective = !combat
    ? visibleQuestTimeline(character.quest_flags ?? {}, undefined).active
    : null;

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
            <span className="play-immersive-stat-label">{t('HP')}</span>
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
          {showHudCredits && (
            <span className="play-immersive-stat play-immersive-mana" title={t('NARRATOR CREDITS')}>
              <span className="play-immersive-stat-glyph" aria-hidden="true">⚡</span>
              <span className="play-immersive-num tabular-nums">{manaLabel}</span>
            </span>
          )}
          {combat && enemy && (
            <span className="play-immersive-stat play-immersive-enemy-hp tabular-nums" title={enemy.name}>
              <span className="play-immersive-stat-label">{t('vs')}</span>
              <span className="play-immersive-num">{enemy.hp}/{enemy.max_hp}</span>
            </span>
          )}
        </div>
        {combat && (
          <p className="combat-turn-banner" role="status">
            {playerTurn ? t('Your turn — choose an action.') : t('Enemy turn — wait for the outcome.')}
          </p>
        )}
        {questObjective && !coaching && (
          <p className="play-quest-strip" role="status">
            <span className="eyebrow">{t('CURRENT OBJECTIVE')}</span>
            <span>{t(questObjective.label)}</span>
          </p>
        )}
        {coaching}
      </div>
    </header>
  );
}

export function PlayCoachingStrip({
  character,
  events,
  onOpenQuests,
}: {
  character: Character;
  events: JournalEvent[];
  onOpenQuests?: () => void;
}) {
  const { t } = useI18n();
  const prompt = scenePrompt(character, events, t);
  const levelNotice = bellWardenLevelGateNotice(character, t);
  if (!prompt && !levelNotice) return null;
  return (
    <div className="play-coaching-strip" role="region" aria-label={t('Scene coaching')}>
      {prompt ? <p className="play-coaching-text">{prompt}</p> : null}
      {levelNotice ? <p className="play-coaching-level-gate" role="status">{levelNotice}</p> : null}
      {onOpenQuests ? (
        <button type="button" className="play-coaching-quest-link" onClick={onOpenQuests}>
          {t('View current quest')}
        </button>
      ) : null}
    </div>
  );
}

/** @deprecated Use PlaySceneChrome — kept for tests that import the symbol. */
export function CompactHud({ character, onOpenSheet }: { character: Character; onOpenSheet: () => void }) {
  return <PlaySceneChrome character={character} events={[]} onOpenSheet={onOpenSheet} />;
}

export function PlayJournal({
  character,
  economy,
  events,
  busy,
  turnPhase,
  narrationStatus,
  onResumePending,
  onCancelTurn,
}: Pick<PlayScreenProps, 'character' | 'economy' | 'events' | 'busy' | 'turnPhase' | 'narrationStatus' | 'onResumePending' | 'onCancelTurn'>) {
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
    <div className="game-play-journal">
      {narrationStatus === 'fallback' && economy?.tier !== 'lite' && (
        <p className="storyteller-status storyteller-status-fallback" role="status">
          {t('This turn used the backup storyteller. No credits were charged.')}
        </p>
      )}
      {events.length === 0 ? (
        <div className="journal-scene journal-presentation-text-first" role="log" aria-label={t('Adventure journal')}>
          <div className="scene-empty">
            <span aria-hidden="true">✦</span>
            <p>{t(character.location === 'The Whispering Cellar'
              ? 'The cellar waits in silence. Describe what you try — explore, talk, attack, flee or rest.'
              : 'This place waits in silence. Describe what you try — explore, talk, attack, flee or rest.')}</p>
          </div>
        </div>
      ) : (
        <JournalChronicle
          events={events}
          character={character}
          mode="play"
          scrollOnChange
          scrollKey={`${events.length}-${busy ? 'busy' : 'idle'}`}
        />
      )}
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
                      ? t('The narrator is still writing this moment…')
                      : thinkingSeconds >= 5
                        ? t('Doupě Draka is weighing your fate…')
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
      <p className="error-panel-body">{t('The storyteller lost its connection. Check narrator tier and connection, then try again.')}</p>
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
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const actionSheetRef = useRef<HTMLDivElement>(null);
  const [action, setAction] = useState('');
  const [selectedSpell, setSelectedSpell] = useState('');
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [spellSheetOpen, setSpellSheetOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const enemy = character.in_combat ? character.combatant : null;
  const accessibleSpells = new Set([...(character.known_spells ?? []), ...(character.prepared_spells ?? [])]);
  const characterSpells = spells
    .filter(spell => accessibleSpells.has(spell.name))
    .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name));
  const hasPotion = character.inventory.some(item => item.toLowerCase().includes('potion'));
  const chips = playActionChips(character, events, locations, t, characterSpells.length > 0, hasPotion);
  const primaryChip = primaryPlayChipKey(
    character,
    events,
    locations,
    t,
    characterSpells.length > 0,
    hasPotion,
  );

  const actionSpellName = action.match(/^(?:cast|kouzli(?:t)?)\s+(.+?)(?:\s+at\s+.+)?$/i)?.[1]?.trim().replace(/\s+/g, ' ').toLowerCase();
  const actionSpell = characterSpells.find(spell => spell.name.toLowerCase() === actionSpellName);
  const spellWarning = actionSpell && !actionSpell.effect_modeled
    ? t('This spell has no modeled effect yet. It will not be sent and no spell slot will be spent.')
    : null;
  const spellNotice = actionSpell?.name === 'Healing Word'
    ? t('Healing Word uses your bonus action in combat.')
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

  const openSpellPicker = () => setSpellSheetOpen(true);

  const closeActionMenu = useCallback(() => setActionMenuOpen(false), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  const closeSpellSheet = useCallback(() => setSpellSheetOpen(false), []);

  useOverlayDismiss(actionMenuOpen, closeActionMenu, menuToggleRef);
  useOverlayDismiss(helpOpen, closeHelp, menuToggleRef);
  useOverlayDismiss(spellSheetOpen, closeSpellSheet, menuToggleRef);

  useEffect(() => {
    if (!actionMenuOpen) return;
    const first = actionSheetRef.current?.querySelector<HTMLButtonElement>('button');
    first?.focus();
  }, [actionMenuOpen]);

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
              <button
                type="button"
                key={chip.key}
                className={chip.key === primaryChip ? 'suggested-chip-primary' : undefined}
                disabled={busy}
                onClick={() => handleChip(chip)}
              >
                {t(chip.label)}
              </button>
            ))}
          </div>
        </div>
      )}
      <form className="composer-input-shell composer-input-immersive" onSubmit={handleSubmit}>
        <div className="composer-field composer-field-immersive">
          <button
            type="button"
            ref={menuToggleRef}
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
            onChange={event => {
              setAction(event.target.value);
              if (selectedSpell && !event.target.value.toLowerCase().includes(selectedSpell.toLowerCase())) {
                setSelectedSpell('');
              }
            }}
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
          <div
            ref={actionSheetRef}
            className="composer-action-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={t('Play actions')}
          >
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
      {spellSheetOpen && characterSpells.length > 0 && (
        <>
          <button type="button" className="composer-sheet-backdrop" aria-label={t('Close')} onClick={closeSpellSheet} />
          <div className="composer-spell-sheet" role="dialog" aria-modal="true" aria-label={t('Pick a spell')}>
            <div className="composer-spell-sheet-head">
              <p className="composer-action-sheet-title">{t('Pick a spell')}</p>
              <button type="button" className="composer-help-close" aria-label={t('Close')} onClick={closeSpellSheet}>
                ×
              </button>
            </div>
            <ul className="composer-spell-sheet-list">
              {characterSpells.map(spell => (
                <li key={spell.name}>
                  <button
                    type="button"
                    disabled={busy}
                    className={selectedSpell === spell.name ? 'selected' : undefined}
                    onClick={() => {
                      setSelectedSpell(spell.name);
                      const target = enemy && spell.effect_modeled && DAMAGE_TARGET_SPELLS.has(spell.name)
                        ? ` at ${enemy.name}`
                        : '';
                      setAction(`cast ${spell.name}${target}`);
                      closeSpellSheet();
                      actionInputRef.current?.focus();
                    }}
                  >
                    <strong>{spell.name}</strong>
                    <small>{spell.level === 0 ? t('Cantrip') : t(`Level ${spell.level}`)}</small>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      {spellWarning && <p className="spell-warning" role="status">{spellWarning}</p>}
      {!spellWarning && spellNotice && <p className="spell-warning" role="status">{spellNotice}</p>}
      {helpOpen && (
        <>
          <button type="button" className="composer-sheet-backdrop" aria-label={t('Close help')} onClick={closeHelp} />
          <div className="composer-help-popover" role="dialog" aria-modal="true" aria-label={t('How actions and exploration work')}>
            <div className="composer-help-head">
              <p className="composer-action-sheet-title">{t('How actions and exploration work')}</p>
              <button type="button" className="composer-help-close" aria-label={t('Close help')} onClick={closeHelp}>
                ×
              </button>
            </div>
            <p>{t('Each search uses one six-sided die: a 1 brings an enemy; other results may reveal clues, quiet, or 1–4 gold coins. After a fight or escape, your next search is safe. Rejected actions cost no narrator credits.')}</p>
            <p>{t('Action words guide ability checks: strength for force, dexterity for stealth, constitution to endure, intelligence to inspect, wisdom to notice, and charisma to persuade.')}</p>
          </div>
        </>
      )}
    </div>
  );
}
