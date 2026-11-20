import { useEffect, useMemo, useState } from 'react';
import type { TurnPhase } from '../pendingTurn';
import type { Character, JournalEvent, Spell } from '../types';
import { useI18n } from '../i18n';
import { SpellSlots } from '../components/characterVitals';
import { splitJournalResult, splitNarrationAndFacts } from '../components/journalBlocks';
import {
  buildCombatActionDeck,
  buildReactionCombatActions,
  isPlayerCombatTurn,
  isReactionWindow,
  lastCombatBeat,
} from './combatActions';
import { combatAtmosphereLine, canonicalPlayLocation, combatIntroProse, isPreStrikeCombatBeat } from './combatDisplay';
import { CombatIcon, EnemySilhouette } from './combatIcons';
import {
  chipsFromResolution,
  suggestNextCombatAction,
} from './combatResolution';
import { economyDenialReason, readCombatEconomy, spellEconomySlot } from './combatEconomy';
import { rangeDisadvantageLabel, readCombatTactics } from './combatRange';
import type { CombatActionItem } from './combatActions';

function economyChipLabel(
  available: boolean,
  label: string,
  t: (key: string) => string,
): string {
  return available ? label : `${label} — ${t('spent')}`;
}

export function CombatTacticsStrip({ character }: { character: Character }) {
  const { t } = useI18n();
  const tactics = readCombatTactics(character);
  if (!character.in_combat || !tactics) return null;
  const wr = tactics.weapon_range;
  const dis = rangeDisadvantageLabel(wr?.disadvantage_reason, t);
  return (
    <div className="combat-tactics-strip" role="status" aria-label={t('Battlefield')}>
      <p className="combat-tactics-line">
        <span>{t('Distance')}: <strong>{tactics.distance_ft} {t('ft.')}</strong></span>
        {tactics.movement_remaining_ft != null && (
          <>
            {' · '}
            <span>{t('Movement left')}: <strong>{tactics.movement_remaining_ft} {t('ft.')}</strong></span>
          </>
        )}
      </p>
      {wr && (
        <p className="combat-tactics-line">
          {t('Weapon')}: <strong>{wr.weapon_key ?? '—'}</strong>
          {' · '}
          {t('Range')}: <strong>{wr.normal_ft}{wr.long_ft && wr.long_ft !== wr.normal_ft ? `/${wr.long_ft}` : ''} {t('ft.')}</strong>
          {!wr.can_attack && wr.denial && (
            <span className="combat-tactics-warn"> — {wr.denial}</span>
          )}
          {dis && <span className="combat-tactics-warn"> — {dis}</span>}
        </p>
      )}
    </div>
  );
}

export function CombatActionEconomyStrip({ character }: { character: Character }) {
  const { t } = useI18n();
  const economy = readCombatEconomy(character);
  if (!economy.inPlayerTurn && character.combat_turn === 'enemy' && !character.combat_reaction_pending?.kind) {
    return null;
  }
  return (
    <ul className="combat-economy-strip" role="list" aria-label={t('Action economy')}>
      <li className={economy.actionAvailable ? 'available' : 'spent'}>
        {economyChipLabel(economy.actionAvailable, t('Action'), t)}
      </li>
      <li className={economy.bonusAvailable ? 'available' : 'spent'}>
        {economyChipLabel(economy.bonusAvailable, t('Bonus action'), t)}
      </li>
      <li className={economy.reactionAvailable ? 'available' : 'spent'}>
        {economyChipLabel(economy.reactionAvailable, t('Reaction'), t)}
      </li>
    </ul>
  );
}

export function CombatArena({
  character,
  busy,
}: {
  character: Character;
  busy: boolean;
}) {
  const { t, locale } = useI18n();
  const enemy = character.combatant;
  const playerTurn = isPlayerCombatTurn(character);
  const atmosphere = combatAtmosphereLine(character, locale);
  const enemyHpPct = enemy && enemy.max_hp > 0
    ? Math.max(0, Math.min(100, (enemy.hp / enemy.max_hp) * 100))
    : 0;

  return (
    <header className="combat-arena" role="banner" data-busy={busy || undefined}>
      <p className="combat-arena-eyebrow">{t('COMBAT')}</p>
      <div className="combat-arena-focus">
        <div className="combat-enemy-card" aria-labelledby="combat-enemy-name">
          <span className="combat-enemy-glyph" aria-hidden="true">
            {enemy ? <EnemySilhouette foeType={enemy.name} /> : <CombatIcon name="attack" />}
          </span>
          <div className="combat-enemy-copy">
            <h1 id="combat-enemy-name">{enemy?.name ?? t('Unknown foe')}</h1>
            {enemy && (
              <p className="combat-enemy-stats">
                <span>{t('HP')} {enemy.hp}/{enemy.max_hp}</span>
                <span>{t('AC')} {enemy.armor_class}</span>
              </p>
            )}
            {enemy && (
              <div className="combat-enemy-hp-track" aria-hidden="true">
                <span style={{ width: `${enemyHpPct}%` }} className={enemyHpPct <= 25 ? 'critical' : ''} />
              </div>
            )}
          </div>
        </div>
        <p className={`combat-turn-pill ${playerTurn ? 'player' : 'enemy'}`} role="status">
          {isReactionWindow(character)
            ? t('Reaction — choose Shield or decline.')
            : playerTurn
              ? t('Your turn — choose an action.')
              : t('Enemy turn — wait for the outcome.')}
        </p>
        {character.in_combat && (
          <>
            <CombatTacticsStrip character={character} />
            <CombatActionEconomyStrip character={character} />
          </>
        )}
      </div>
      <p className="combat-atmosphere combat-atmosphere-compact">{atmosphere}</p>
    </header>
  );
}

export function CombatHeroStrip({ character }: { character: Character }) {
  const { t } = useI18n();
  const hpRatio = character.max_hp > 0
    ? Math.max(0, Math.min(100, (character.hp / character.max_hp) * 100))
    : 0;
  const location = canonicalPlayLocation(character);

  return (
    <div className="combat-hero-strip" role="group" aria-label={t('Your hero')}>
      <div className="combat-hero-identity">
        <span className="combat-hero-portrait" aria-hidden="true">{character.name.charAt(0)}</span>
        <div className="combat-hero-name-row">
          <strong className="combat-hero-name">{character.name}</strong>
          {location && (
            <span className="combat-hero-location" title={location}>
              {location}
            </span>
          )}
        </div>
      </div>
      <div className="combat-hero-stats">
        <span className="combat-stat">
          <small>{t('HP')}</small>
          <strong>{character.hp}/{character.max_hp}</strong>
          <span className="combat-hero-hp-track" aria-hidden="true">
            <span style={{ width: `${hpRatio}%` }} className={hpRatio <= 25 ? 'critical' : ''} />
          </span>
        </span>
        <span className="combat-stat"><small>{t('AC')}</small><strong>{character.armor_class}</strong></span>
        {(character.known_spells?.length ?? 0) > 0 && (
          <span className="combat-stat combat-stat-slots">
            <small>{t('Spell slots')}</small>
            <SpellSlots character={character} t={t} />
          </span>
        )}
        {character.invisible && (
          <span className="combat-stat"><small>{t('Condition')}</small><strong>{t('Invisible')}</strong></span>
        )}
        {(character.conditions ?? []).map(cond => (
          <span key={String(cond.condition_id)} className="combat-stat">
            <small>{t('Condition')}</small>
            <strong>{t(String(cond.condition_id))}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

function ResolutionFallbackFold({ facts, locale }: { facts: string; locale: 'en' | 'cs' }) {
  const { t } = useI18n();
  const blocks = splitJournalResult(facts, locale);
  if (!blocks.length) return null;
  return (
    <details className="combat-mechanics-fold">
      <summary>{t('Mechanical details (legacy)')}</summary>
      <div className="combat-mechanics-body">
        {blocks.map((block, index) => (
          <p key={index} className={`journal-mechanic journal-mechanic-${block.tone ?? 'neutral'}`}>{block.text}</p>
        ))}
      </div>
    </details>
  );
}

export function CombatMoment({
  character,
  events,
  busy,
  turnPhase,
}: {
  character: Character;
  events: JournalEvent[];
  busy: boolean;
  turnPhase?: TurnPhase;
}) {
  const { t, locale } = useI18n();
  const beat = useMemo(() => lastCombatBeat(events), [events]);
  const preStrike = useMemo(() => isPreStrikeCombatBeat(events), [events]);
  const { narration, facts } = beat ? splitNarrationAndFacts(beat.result) : { narration: '', facts: '' };
  const showIntro = preStrike && !busy;
  const chips = useMemo(
    () => chipsFromResolution(beat?.resolution, locale),
    [beat?.resolution, locale],
  );
  const nextHint = useMemo(
  () => suggestNextCombatAction(character, locale),
  [character, locale],
  );
  const hasStructured = chips.length > 0;

  return (
    <section
      className="combat-result-card combat-moment"
      role="region"
      aria-live="polite"
      aria-label={t('Latest combat beat')}
    >
      {showIntro && (
        <article className="combat-result-layer combat-result-story">
          <h2 className="combat-result-heading">{t('Story')}</h2>
          <p className="combat-story-prose combat-intro-prose">{combatIntroProse(character, locale)}</p>
        </article>
      )}
      {beat && !showIntro && (
        <>
          <article className="combat-result-layer combat-result-story">
            <h2 className="combat-result-heading">{t('Story')}</h2>
            {!busy && narration && <p className="combat-story-prose">{narration}</p>}
            {!busy && !narration && facts && (
              <p className="combat-story-prose combat-story-muted">{facts.split('\n')[0]}</p>
            )}
          </article>
          <article className="combat-result-layer combat-result-facts">
            <h2 className="combat-result-heading">{t('Turn outcome')}</h2>
            {hasStructured ? (
              <ul className="combat-result-chips" role="list">
                {chips.map(chip => (
                  <li key={chip.id} className={`combat-result-chip tone-${chip.tone}`}>{chip.label}</li>
                ))}
              </ul>
            ) : (
              <p className="combat-result-fallback">{t('Structured turn facts are unavailable for this entry.')}</p>
            )}
            {!hasStructured && facts && <ResolutionFallbackFold facts={facts} locale={locale} />}
          </article>
          {nextHint && !busy && (
            <article className="combat-result-layer combat-result-next">
              <h2 className="combat-result-heading">{t('What next')}</h2>
              <p className="combat-story-prose">{nextHint}</p>
            </article>
          )}
        </>
      )}
      {busy && (
        <p className="combat-resolving" role="status">
          {turnPhase === 'sending'
            ? t('Sending your action…')
            : turnPhase === 'resolved'
              ? t('The dice have spoken. The narrator continues…')
              : t('The narrator is shaping the moment…')}
        </p>
      )}
    </section>
  );
}

function CombatActionButton({
  item,
  busy,
  pendingId,
  primary,
  expanded,
  onPress,
}: {
  item: CombatActionItem;
  busy: boolean;
  pendingId: string;
  primary?: boolean;
  expanded?: boolean;
  onPress: () => void;
}) {
  const cardClass = [
    'combat-action-card',
    primary ? 'combat-action-primary' : '',
    pendingId === item.id && busy ? 'combat-action-pending' : '',
    expanded ? 'combat-action-expanded' : '',
    item.disabled ? 'combat-action-disabled' : '',
  ].filter(Boolean).join(' ');

  const labelId = `combat-action-label-${item.id}`;
  const reasonId = `combat-action-reason-${item.id}`;

  return (
    <button
      type="button"
      className={cardClass}
      disabled={busy || item.disabled || (item.kind !== 'panel' && !item.action)}
      title={item.disabledReason ?? item.description}
      aria-labelledby={labelId}
      aria-describedby={item.disabled && item.disabledReason ? reasonId : undefined}
      aria-busy={pendingId === item.id && busy ? true : undefined}
      aria-expanded={item.kind === 'panel' ? Boolean(expanded) : undefined}
      data-combat-action-id={item.id}
      onClick={onPress}
    >
      <span className="combat-action-icon" aria-hidden="true">
        <CombatIcon name={item.icon} />
      </span>
      <span id={labelId} className="combat-action-label">{item.label}</span>
      {item.disabled && item.disabledReason && (
        <span id={reasonId} className="combat-action-reason">{item.disabledReason}</span>
      )}
    </button>
  );
}

export function CombatActionDeck({
  character,
  spells,
  busy,
  onAction,
}: {
  character: Character;
  spells: Spell[];
  busy: boolean;
  onAction: (action: string) => void;
}) {
  const { t, locale } = useI18n();
  const [lastSent, setLastSent] = useState('');
  const [pendingId, setPendingId] = useState('');
  const [openPanel, setOpenPanel] = useState<'abilities' | 'items' | null>(null);
  const reactionActions = buildReactionCombatActions(character, t);
  const deck = buildCombatActionDeck(character, spells, t, locale);
  const economy = readCombatEconomy(character);

  useEffect(() => {
    if (!busy) {
      setLastSent('');
      setPendingId('');
    }
  }, [busy]);

  useEffect(() => {
    if (!isPlayerCombatTurn(character)) setOpenPanel(null);
  }, [character.combat_turn]);

  const fire = (action: string, actionId: string) => {
    if (busy || !action.trim()) return;
    if (lastSent === action) return;
    setLastSent(action);
    setPendingId(actionId);
    onAction(action);
  };

  const panelActions = openPanel === 'abilities'
    ? deck.abilityActions
    : openPanel === 'items'
      ? deck.itemActions
      : [];

  const renderDeck = reactionActions.length > 0;

  return (
    <div className="combat-action-deck" role="group" aria-label={t('Combat actions')}>
      {renderDeck ? (
        <div className="combat-action-grid combat-action-grid-main">
          {reactionActions.map(item => (
            <CombatActionButton
              key={item.id}
              item={item}
              busy={busy}
              pendingId={pendingId}
              primary={item.id === 'cast_shield'}
              onPress={() => item.action && fire(item.action, item.id)}
            />
          ))}
        </div>
      ) : (
        <>
          <div className="combat-action-grid combat-action-grid-main">
            {deck.main.map(item => (
              <CombatActionButton
                key={item.id}
                item={item}
                busy={busy}
                pendingId={pendingId}
                primary={item.kind === 'attack'}
                expanded={item.panelTarget != null && openPanel === item.panelTarget}
                onPress={() => {
                  if (item.kind === 'panel' && item.panelTarget) {
                    setOpenPanel(cur => (cur === item.panelTarget ? null : item.panelTarget ?? null));
                    return;
                  }
                  if (item.action) fire(item.action, item.id);
                }}
              />
            ))}
          </div>
          {openPanel && panelActions.length > 0 && (
            <div
              className="combat-subpanel"
              role="region"
              aria-label={openPanel === 'abilities' ? t('Combat abilities') : t('Items')}
            >
              <div className="combat-action-grid combat-action-grid-sub">
                {panelActions.map(item => {
                  const spellBlocked = item.kind === 'spell' && item.action
                    ? economyDenialReason(economy, spellEconomySlot(item.label), t, character)
                    : undefined;
                  const merged: CombatActionItem = spellBlocked
                    ? { ...item, disabled: true, disabledReason: spellBlocked }
                    : item;
                  return (
                    <CombatActionButton
                      key={item.id}
                      item={merged}
                      busy={busy}
                      pendingId={pendingId}
                      onPress={() => merged.action && fire(merged.action, merged.id)}
                    />
                  );
                })}
              </div>
            </div>
          )}
          {deck.tactics.length > 0 && (
            <>
              <p className="combat-tactics-heading">{t('Tactics')}</p>
              <div className="combat-action-grid combat-action-grid-tactics">
                {deck.tactics.map(item => (
                  <CombatActionButton
                    key={item.id}
                    item={item}
                    busy={busy}
                    pendingId={pendingId}
                    onPress={() => item.action && fire(item.action, item.id)}
                  />
                ))}
              </div>
            </>
          )}
          {deck.endTurn && (
            <button
              type="button"
              className="combat-end-turn"
              disabled={busy}
              onClick={() => fire(deck.endTurn!.action!, deck.endTurn!.id)}
            >
              {deck.endTurn.label}
            </button>
          )}
        </>
      )}
    </div>
  );
}