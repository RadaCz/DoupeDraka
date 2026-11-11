import { useEffect, useMemo, useState } from 'react';
import type { TurnPhase } from '../pendingTurn';
import type { Character, JournalEvent, Spell } from '../types';
import { useI18n } from '../i18n';
import { SpellSlots } from '../components/characterVitals';
import { splitJournalResult, splitNarrationAndFacts } from '../components/journalBlocks';
import {
  buildCombatActions,
  castSpellAction,
  enemyPortraitGlyph,
  isPlayerCombatTurn,
  lastCombatBeat,
  modeledCombatSpells,
} from './combatActions';
import { combatAtmosphereLine, canonicalPlayLocation, combatIntroProse, isPreStrikeCombatBeat } from './combatDisplay';
import { economyDenialReason, readCombatEconomy, spellEconomySlot } from './combatEconomy';
import { rangeDisadvantageLabel, readCombatTactics } from './combatRange';

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
    <div className="combat-tactics-strip" role="status">
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
  if (!economy.inPlayerTurn && character.combat_turn === 'enemy') {
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
            {enemy ? enemyPortraitGlyph(enemy.name) : '⚔'}
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
          {playerTurn ? t('Your turn — choose an action.') : t('Enemy turn — wait for the outcome.')}
        </p>
          {character.in_combat && (
            <>
              <CombatTacticsStrip character={character} />
              <CombatActionEconomyStrip character={character} />
            </>
          )}
      </div>
      <p className="combat-atmosphere">{atmosphere}</p>
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

function CombatMechanicsFold({ facts, locale }: { facts: string; locale: 'en' | 'cs' }) {
  const { t } = useI18n();
  const blocks = splitJournalResult(facts, locale);
  if (!blocks.length) return null;
  return (
    <details className="combat-mechanics-fold">
      <summary>{t('Mechanical details')}</summary>
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

  return (
    <section className="combat-moment" aria-live="polite" aria-label={t('Latest combat beat')}>
      {showIntro && (
        <p className="combat-story-prose combat-intro-prose">{combatIntroProse(character, locale)}</p>
      )}
      {beat && !showIntro && (
        <>
          {!busy && narration && <p className="combat-story-prose">{narration}</p>}
          {!busy && !narration && facts && (
            <p className="combat-story-prose combat-story-muted">{facts.split('\n')[0]}</p>
          )}
          {facts && <CombatMechanicsFold facts={facts} locale={locale} />}
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
  const [spellPick, setSpellPick] = useState('');
  const [lastSent, setLastSent] = useState('');
  const [pendingId, setPendingId] = useState('');
  const actions = buildCombatActions(character, spells, t, locale);
  const modeled = modeledCombatSpells(character, spells);
  const economy = readCombatEconomy(character);
  const enemy = character.combatant?.name;
  const spellCastBlocked = spellPick
    ? economyDenialReason(economy, spellEconomySlot(spellPick), t)
    : undefined;

  useEffect(() => {
    if (!busy) {
      setLastSent('');
      setPendingId('');
    }
  }, [busy]);

  const fire = (action: string, actionId: string) => {
    if (busy || !action.trim()) return;
    if (lastSent === action) return;
    setLastSent(action);
    setPendingId(actionId);
    onAction(action);
  };

  const onSpellCast = () => {
    if (!spellPick) return;
    const spell = modeled.find(item => item.name === spellPick);
    if (!spell) return;
    fire(castSpellAction(spell.name, enemy), 'spell');
    setSpellPick('');
  };

  const cardClass = (id: string, primary?: boolean) => {
    const parts = ['combat-action-card'];
    if (primary) parts.push('combat-action-primary');
    if (pendingId === id && busy) parts.push('combat-action-pending');
    return parts.join(' ');
  };

  return (
    <div className="combat-action-deck" role="group" aria-label={t('Combat actions')}>
      <div className="combat-action-grid">
        {actions.map(item => {
          if (item.kind === 'spell') {
            return (
              <button
                type="button"
                key={item.id}
                className={cardClass(item.id, true)}
                disabled={busy || item.disabled || (modeled.length > 1)}
                title={item.disabledReason}
                aria-busy={pendingId === item.id && busy ? true : undefined}
                aria-describedby={`combat-desc-${item.id}`}
                onClick={() => {
                  if (modeled.length === 1) {
                    fire(castSpellAction(modeled[0].name, enemy), item.id);
                  }
                }}
              >
                <span className="combat-action-glyph" aria-hidden="true">{item.glyph}</span>
                <span className="combat-action-label">{item.label}</span>
              </button>
            );
          }
          const primary = item.kind === 'attack';
          return (
            <button
              type="button"
              key={item.id}
              className={cardClass(item.id, primary)}
              disabled={busy || item.disabled || !item.action}
              title={item.disabledReason}
              aria-busy={pendingId === item.id && busy ? true : undefined}
              aria-describedby={`combat-desc-${item.id}`}
              onClick={() => item.action && fire(item.action, item.id)}
            >
              <span className="combat-action-glyph" aria-hidden="true">{item.glyph}</span>
              <span className="combat-action-label">{item.label}</span>
            </button>
          );
        })}
      </div>
      <ul className="combat-action-hints">
        {actions.map(item => (
          <li key={`hint-${item.id}`} id={`combat-desc-${item.id}`}>
            <strong>{item.label}</strong> — {item.description}
            {item.disabled && item.disabledReason && <em> ({item.disabledReason})</em>}
          </li>
        ))}
      </ul>
      {modeled.length > 1 && !actions.find(a => a.id === 'spell')?.disabled && (
        <div className="combat-spell-row">
          <select
            aria-label={t('Your spells')}
            value={spellPick}
            disabled={busy || !isPlayerCombatTurn(character)}
            onChange={event => setSpellPick(event.target.value)}
          >
            <option value="">{t('Choose a spell to cast')}</option>
            {modeled.map(spell => (
              <option key={spell.name} value={spell.name}>{spell.name}</option>
            ))}
          </select>
          <button
            type="button"
            className="combat-spell-cast"
            disabled={busy || !spellPick || !isPlayerCombatTurn(character) || Boolean(spellCastBlocked)}
            title={spellCastBlocked}
            onClick={onSpellCast}
          >
            {t('Cast')}
          </button>
        </div>
      )}
    </div>
  );
}
