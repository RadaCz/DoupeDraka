import { useEffect, useMemo, useRef, useState } from 'react';
import type { TurnPhase } from './pendingTurn';
import type {
  AppScreen,
  Character,
  Economy,
  HeroPreset,
  JournalEvent,
  ReferenceCatalog,
  LocationReference,
  Spell,
} from './types';
import { useI18n } from './i18n';
import { CHAPTER_ONE_LAYOUT, mapEdges, mapNodeState, routeOpen } from './chapterOneMap';
import { chapterOneQuestProgress } from './questProgress';

const ABILITIES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
const MONSTERS = ['kobold', 'goblin', 'wolf', 'bandit', 'ghoul', 'ogre'];
const FULL_CASTER_CLASSES = new Set(['bard', 'cleric', 'druid', 'sorcerer', 'wizard']);
const HALF_CASTER_CLASSES = new Set(['paladin', 'ranger']);

function highestSpellLevel(character: Character | null) {
  if (!character) return 0;
  const level = character.level;
  if (FULL_CASTER_CLASSES.has(character.character_class)) {
    return Math.min(9, Math.ceil(level / 2));
  }
  if (HALF_CASTER_CLASSES.has(character.character_class)) {
    return level < 2 ? 0 : Math.min(5, Math.ceil(level / 4));
  }
  if (character.character_class === 'warlock') {
    return Math.min(5, Math.ceil(level / 2));
  }
  return 0;
}

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

interface SuggestedAction {
  label: string;
  action: string;
}

interface QuickAction {
  id: string;
  label: string;
  description: string;
  glyph: string;
  action?: string;
  mode: 'submit' | 'map' | 'custom' | 'spells' | 'prefill';
}

function buildQuickActions(
  character: Character,
  events: JournalEvent[],
  locations: LocationReference[],
  t: (value: string) => string,
  hasSpells: boolean,
  hasPotion: boolean,
): QuickAction[] {
  const enemy = character.combatant?.name ?? 'the enemy';
  if (character.in_combat) {
    const actions: QuickAction[] = [
      { id: 'attack', label: t('Attack'), description: t('Strike the enemy'), glyph: '⚔', action: `attack ${enemy}`, mode: 'submit' },
      { id: 'defend', label: t('Defend'), description: t('Brace against the next hit'), glyph: '🛡', action: 'defend', mode: 'submit' },
      { id: 'flee', label: t('Flee'), description: t('Try to break away'), glyph: '↩', action: 'flee', mode: 'submit' },
    ];
    if (hasSpells) {
      actions.push({ id: 'spell', label: t('Cast spell'), description: t('Choose a spell to cast'), glyph: '✦', mode: 'spells' });
    }
    if (hasPotion) {
      actions.push({ id: 'potion', label: t('Use potion'), description: t('Drink a healing potion'), glyph: '⚗', action: 'use potion', mode: 'submit' });
    }
    return actions;
  }
  const contextual = suggestedActions(character, events, locations, t);
  const talk = contextual.find(item => /talk|ask|return|caldus|nib|bell/i.test(item.action));
  const talkMode: QuickAction['mode'] = talk ? 'submit' : 'prefill';
  return [
    {
      id: 'explore',
      label: t('Explore'),
      description: t('Search the area for tracks or loot'),
      glyph: '⌕',
      action: `search ${character.location}`,
      mode: 'submit',
    },
    {
      id: 'talk',
      label: t('Talk'),
      description: talk ? t(talk.label) : t('Speak or persuade'),
      glyph: '♙',
      action: talk?.action ?? 'listen for movement',
      mode: talkMode,
    },
    {
      id: 'travel',
      label: t('Travel'),
      description: t('Pick the next location on the map'),
      glyph: '⌖',
      mode: 'map',
    },
    {
      id: 'custom',
      label: t('Custom action'),
      description: t('Describe your own intent in words'),
      glyph: '✎',
      mode: 'custom',
    },
  ];
}

function suggestedActions(
  character: Character,
  events: JournalEvent[],
  locations: LocationReference[],
  t: (value: string) => string,
): SuggestedAction[] {
  if (character.hp <= 0) return [];
  const injured = character.hp < character.max_hp;

  if (character.in_combat) {
    const enemy = character.combatant?.name ?? 'the enemy';
    const escape = { label: 'Try to escape', action: 'flee' };
    const attack = { label: 'Attack', action: `attack ${enemy}` };
    return injured && character.hp / character.max_hp <= 0.3
      ? [escape, attack]
      : [attack, escape];
  }

  const latest = events[events.length - 1]?.result.toLowerCase() ?? '';
  const actions: SuggestedAction[] = [];
  const quests = character.quest_flags ?? {};
  if (character.location === 'The Shrine of the Forgotten' && (quests.bell_found || quests.bell_acquired) && !quests.bell_quest_complete) {
    actions.push({ label: t('Return the shrine bell'), action: 'return the shrine bell to Caldus' });
  } else if (character.location === 'The Shrine of the Forgotten' && !quests.bell_quest_accepted && !quests.bell_quest_complete) {
    actions.push({ label: t('Talk to Caldus'), action: 'talk to Caldus about the shrine bell' });
  } else if (character.location === 'The Goblin Market' && quests.bell_quest_accepted && !quests.bell_found && !quests.bell_acquired && !quests.bell_quest_complete) {
    actions.push({ label: t('Ask Nib about the shrine bell'), action: 'ask Nib about the shrine bell' });
  }
  if (injured) actions.push({ label: 'Recover your strength', action: 'rest' });

  if (latest.includes('tracks')) {
    actions.push({ label: 'Study the fresh tracks', action: 'inspect the fresh tracks' });
  } else if (latest.includes('panel') || latest.includes('scratches')) {
    actions.push({ label: 'Inspect the stone panel', action: 'inspect the stone panel' });
  } else if (latest.includes('gold pieces')) {
    actions.push({ label: 'Search for more clues', action: `search ${character.location}` });
  }

  actions.push({ label: t('Search the area'), action: `search ${character.location}` });
  actions.push({ label: 'Listen for movement', action: 'listen for movement' });
  actions.push({ label: 'Inspect the stonework', action: 'inspect the stonework' });
  const node = locations.find(location => location.name === character.location);
  const nextLocation = node?.connections.find(route => routeOpen(route, quests));
  if (nextLocation) {
    actions.push({ label: t(`Travel to ${nextLocation}`), action: `travel to ${nextLocation}` });
    return [...actions.slice(0, 2), actions[actions.length - 1]];
  }
  return actions.slice(0, 3);
}

function contextualChips(
  character: Character,
  events: JournalEvent[],
  locations: LocationReference[],
  t: (value: string) => string,
) {
  const chips = suggestedActions(character, events, locations, t);
  const talk = chips.find(item => /talk|ask|return|caldus|nib|bell/i.test(item.action));
  return chips.filter(item => {
    if (item.action === `search ${character.location}`) return false;
    if (talk && item.action === talk.action) return false;
    if (character.in_combat) {
      if (item.action === 'flee' || item.action.startsWith('attack ')) return false;
    }
    return true;
  }).slice(0, 4);
}

function scenePrompt(character: Character, events: JournalEvent[], t: (value: string) => string) {
  if (character.hp <= 0) return t('You have fallen. The cellar falls quiet around you.');
  if (character.in_combat) return t('A hostile creature is in front of you. Fight or make a run for it.');
  if (character.hp < character.max_hp) return t('The immediate danger has passed. Catch your breath or press on.');

  const latest = events[events.length - 1]?.result.toLowerCase() ?? '';
  if (latest.includes('tracks')) {
    return character.location === 'The Whispering Cellar'
      ? t('Fresh tracks cross the dust and lead farther into the cellar.')
      : t('Fresh tracks lead onward from this place.');
  }
  if (latest.includes('panel') || latest.includes('scratches')) {
    return character.location === 'The Whispering Cellar'
      ? t('Scratches mark a stone panel nearby. It may be worth a closer look.')
      : t('Something nearby bears marks worth a closer look.');
  }
  if (latest.includes('return the shrine bell')) return t('Caldus welcomes the shrine bell back into the quiet shrine.');
  if (latest.includes('gold pieces tucked beneath loose stones')) {
    return character.location === 'The Whispering Cellar'
      ? t('The loose stones conceal a few coins. There may be more to find.')
      : t('You find a few coins here. There may be more to uncover.');
  }
  if (latest.includes('defeated') || latest.includes('escape')) return t('For now, the passage is quiet. You have a moment to choose your next move.');
  return character.location === 'The Whispering Cellar'
    ? t('The cellar is quiet for now. Search, listen, or inspect what catches your eye.')
    : t('This place is quiet for now. Search, listen, or travel onward.');
}

function HpBar({ character }: { character: Character }) {
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

function SpellSlots({ character, t }: { character: Character; t: (value: string) => string }) {
  const maximum = Object.entries(character.max_spell_slots ?? {})
    .map(([level, count]) => [Number(level), count] as const)
    .filter(([, count]) => count > 0)
    .sort(([left], [right]) => left - right);
  if (!maximum.length) return <>{t('None')}</>;
  return <>{maximum.map(([level, count]) => `L${level}: ${character.spell_slots?.[level] ?? 0}/${count}`).join(' · ')}</>;
}

function ManaHelp() {
  const { t } = useI18n();
  return (
    <details className="mana-info">
      <summary aria-label={t('About Adventure Mana')} title={t('About Adventure Mana')}>?</summary>
      <div className="mana-info-popover">
        <p>{t('Adventure Mana pays for changed turns at paid narration tiers. Lite turns, rests and no-op actions are free.')}</p>
        <p>{t('Top-ups are not available yet')}</p>
      </div>
    </details>
  );
}

export function HomeScreen({
  character,
  characters,
  presets,
  economy,
  onContinue,
  onCreate,
  onPreset,
  onSelect,
  onOpenMap,
  onOpenQuests,
}: {
  character: Character | null;
  characters: Character[];
  presets: HeroPreset[];
  economy: Economy | null;
  onContinue: () => void;
  onCreate: () => void;
  onPreset: (key: string) => void;
  onSelect: (character: Character) => void;
  onOpenMap?: () => void;
  onOpenQuests?: () => void;
}) {
  const { t } = useI18n();
  return (
    <section className="screen home-screen">
      <div className="welcome-banner">
        <div>
          <p className="eyebrow">{t('YOUR NEXT CHAPTER')}</p>
          <h1>{character ? `${t('Welcome back,')} ${character.name}.` : t('An adventure awaits.')}</h1>
          <p>{character ? t('The Whispering Cellar is waiting. What will you do next?') : t('Step into a world of danger, discovery and dice.')}</p>
        </div>
        <span className="banner-mark" aria-hidden="true">✦</span>
      </div>

      <div className="home-stat-grid">
        <article className="stat-card mana-card">
          <span className="stat-icon" aria-hidden="true">✧</span>
          <div className="mana-stat-copy"><small>{t('ADVENTURE MANA')}</small><strong>{economy ? economy.balance.toFixed(1) : '—'} <i>⚡</i></strong><ManaHelp /></div>
          <small>{economy?.tier ?? 'normal'} {t('tier')}</small>
        </article>
        <article className="stat-card">
          <span className="stat-icon" aria-hidden="true">◈</span>
          <div><small>{t('YOUR ADVENTURERS')}</small><strong>{characters.length}</strong></div>
          <small>{character ? `${t('Active:')} ${character.name}` : t('Ready when you are')}</small>
        </article>
      </div>

      {character ? (
        <article className="active-hero-card">
          <div className="active-hero-top">
            <div className="hero-portrait">{character.name.charAt(0).toUpperCase()}</div>
            <div className="active-hero-copy">
              <span className="eyebrow">{t('CURRENT ADVENTURER')}</span>
              <h2>{character.name}</h2>
              <p>{t(titleCase(character.race))} {t(titleCase(character.character_class))} <span>·</span> {t('Level')} {character.level}</p>
            </div>
            <span className="level-chip">{t('LV.')} {character.level}</span>
          </div>
          <HpBar character={character} />
          <div className="hero-card-footer">
            <span>◈ AC {character.armor_class}</span>
            <span>✦ {character.xp} XP</span>
            <span>⌖ {character.location}</span>
          </div>
          <button type="button" className="primary continue-button" onClick={onContinue}>{t('Continue adventure')} <span aria-hidden="true">→</span></button>
          <div className="home-shortcut-row">
            <button type="button" className="home-shortcut" onClick={onOpenMap}>{t('Map')}</button>
            <button type="button" className="home-shortcut" onClick={onOpenQuests}>{t('Quests')}</button>
          </div>
          <button type="button" className="text-button home-new-hero" onClick={onCreate}>{t('New adventurer')}</button>
        </article>
      ) : (
        <article className="empty-adventure-card">
          <div className="empty-orbit" aria-hidden="true">✧</div>
          <h2>{t('Your story starts with a hero')}</h2>
          <p>{t('Choose a ready-made adventurer or create one of your own.')}</p>
          <button type="button" className="primary" onClick={onCreate}>{t('Create your character')} <span aria-hidden="true">→</span></button>
        </article>
      )}

      {characters.length > 1 && (
        <section className="section-block">
          <div className="section-heading"><div><p className="eyebrow">{t('YOUR ROSTER')}</p><h2>{t('Other adventurers')}</h2></div></div>
          <div className="roster-list">
            {characters.filter(item => item.id !== character?.id).map(item => (
              <button type="button" className="roster-card" key={item.id} onClick={() => onSelect(item)}>
                <span className="mini-portrait">{item.name.charAt(0).toUpperCase()}</span>
                <span className="roster-copy"><strong>{item.name}</strong><small>{t(titleCase(item.race))} {t(titleCase(item.character_class))} · {t('Lv.')} {item.level}</small></span>
                <span className="choice-arrow" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <article className="home-invite-card">
        <div>
          <p className="eyebrow">{t('GROW THE PARTY')}</p>
          <h2>{t('Invite friends')}</h2>
          <p>{t('Share Doupě Draka — your link will count toward future in-game rewards.')}</p>
        </div>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            const bot = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;
            const url = bot ? `https://t.me/${bot}?startapp=invite` : window.location.href;
            const telegram = window.Telegram?.WebApp;
            if (telegram?.openTelegramLink && bot) {
              telegram.openTelegramLink(url);
            } else if (navigator.share) {
              void navigator.share({ title: 'Doupě Draka', url });
            } else {
              void navigator.clipboard?.writeText(url);
            }
          }}
        >
          {t('Share invite link')} →
        </button>
      </article>

      <section className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">{t('QUICK START')}</p><h2>{t('Meet your first hero')}</h2></div>
          <button type="button" className="text-button" onClick={onCreate}>{t('Build your own')}</button>
        </div>
        <div className="preset-grid">
          {presets.map(preset => (
            <button type="button" className="preset-tile" key={preset.key} onClick={() => onPreset(preset.key)}>
              <span className={`preset-glyph ${preset.key}`} aria-hidden="true">{preset.key === 'healer' ? '♡' : preset.key === 'tank' ? '⬡' : preset.key === 'support' ? '♫' : '➶'}</span>
              <strong>{preset.name}</strong>
              <small>{t(preset.role)} · {t(titleCase(preset.character_class))}</small>
            </button>
          ))}
        </div>
      </section>
      <p className="screen-footnote">{t('A quiet moment is a good time to review your sheet, campaign mood or spell references.')}</p>
    </section>
  );
}

export function GameScreen(props: {
  character: Character;
  events: JournalEvent[];
  spells: Spell[];
  locations: LocationReference[];
  busy: boolean;
  turnPhase?: TurnPhase;
  error: string | null;
  narrationStatus: 'narrated' | 'fallback' | null;
  onAction: (action: string) => void;
  onResumePending?: () => void;
  onOpenSheet: () => void;
  onOpenMap?: () => void;
  onOpenSettings?: () => void;
  onCancelTurn?: () => void;
}) {
  const {
  character,
  events,
  spells,
  locations,
  busy,
  turnPhase = 'idle',
  error,
  narrationStatus,
  onAction,
  onResumePending,
  onOpenSheet,
  onOpenMap,
  onOpenSettings,
  onCancelTurn,
} = props;
  const { t } = useI18n();
  const actionInputRef = useRef<HTMLInputElement>(null);
  const [action, setAction] = useState('');
  const [selectedSpell, setSelectedSpell] = useState('');
  const [errorHidden, setErrorHidden] = useState(false);
  const [thinkingSeconds, setThinkingSeconds] = useState(0);
  useEffect(() => { setErrorHidden(false); }, [error]);
  useEffect(() => {
    if (!busy) { setThinkingSeconds(0); return; }
    setThinkingSeconds(0);
    const started = Date.now();
    const timer = window.setInterval(() => setThinkingSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);
  const enemy = character.in_combat ? character.combatant : null;
  const accessibleSpells = new Set([...(character.known_spells ?? []), ...(character.prepared_spells ?? [])]);
  const characterSpells = spells
    .filter(spell => accessibleSpells.has(spell.name))
    .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name));
  const hasPotion = character.inventory.some(item => item.toLowerCase().includes('potion'));
  const quickActions = buildQuickActions(character, events, locations, t, characterSpells.length > 0, hasPotion);
  const extraChips = contextualChips(character, events, locations, t);

  const runQuickAction = (quick: QuickAction) => {
    if (busy) return;
    if (quick.mode === 'map') {
      onOpenMap?.();
      return;
    }
    if (quick.mode === 'custom') {
      actionInputRef.current?.focus();
      return;
    }
    if (quick.mode === 'prefill') {
      if (quick.action) setAction(quick.action);
      actionInputRef.current?.focus();
      return;
    }
    if (quick.mode === 'spells') {
      document.getElementById('cast-spell')?.focus();
      return;
    }
    if (quick.action) {
      onAction(quick.action);
    }
  };
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
  return (
    <section className="screen game-screen">
      <div className="scene-heading">
        <div><p className="eyebrow">{character.in_combat ? t('DANGER') : t('CHAPTER ONE')}</p><h1>{character.location || t('The Whispering Cellar')}</h1><p>{scenePrompt(character, events, t)}</p></div>
        <button type="button" className="icon-button" aria-label={t('Open character sheet')} onClick={onOpenSheet}>☷</button>
      </div>
      <article className="game-hud">
        <div className="game-hud-identity"><span className="mini-portrait large">{character.name.charAt(0).toUpperCase()}</span><div><strong>{character.name}</strong><small>{t(titleCase(character.race))} {t(titleCase(character.character_class))} · {t('Lv.')} {character.level}</small></div></div>
        <div className="hud-vitals">
          <div><span>HP</span><strong>{character.hp}<small> / {character.max_hp}</small></strong></div>
          <div><span>{t('Spell slots')}</span><strong className="spell-slots"><SpellSlots character={character} t={t} /></strong></div>
          <div><span>{t('Armor')}</span><strong>{character.armor_class}</strong></div>
          {character.invisible && <div><span>{t('Condition')}</span><strong>{t('Invisible')}</strong></div>}
        </div>
        <HpBar character={character} />
        {enemy && (
          <div className="enemy-card" role="group" aria-label={t('Current threat')}>
            <div className="enemy-card-heading"><span aria-hidden="true">⚔</span><div><small>{t('CURRENT THREAT')}</small><strong>{enemy.name}</strong></div><b>{t('AC')} {enemy.armor_class}</b></div>
            <div className="resource-bar-label"><span>{t('Enemy hit points')}</span><strong>{enemy.hp} / {enemy.max_hp}</strong></div>
            <div className="hp-track enemy-hp-track" role="progressbar" aria-label={t('Enemy hit points')} aria-valuenow={enemy.max_hp > 0 ? Math.max(0, Math.min(100, (enemy.hp / enemy.max_hp) * 100)) : 0} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${enemy.max_hp > 0 ? Math.max(0, Math.min(100, (enemy.hp / enemy.max_hp) * 100)) : 0}%` }} />
            </div>
          </div>
        )}
      </article>
      <div className="journal-scene" role="log" aria-label={t('Adventure journal')} aria-live="polite">
        {events.length === 0 && <div className="scene-empty"><span aria-hidden="true">✦</span>        <p>{t(character.location === 'The Whispering Cellar'
          ? 'The cellar waits in silence. Describe what you try — explore, talk, attack, flee or rest.'
          : 'This place waits in silence. Describe what you try — explore, talk, attack, flee or rest.')}</p></div>}
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
            <p className="journal-narration">{event.result}</p>
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
      {error && !errorHidden && (
        <div className="error-panel" role="alert" title={error} data-error={error}>
          <p className="error-panel-title">{t('The thread of the weave has slipped.')}</p>
          <p className="error-panel-body">{t('A.U.R.I.O.N. lost its connection to the narrator. Check your narrator settings and try again.')}</p>
          <div className="error-panel-actions">
            {onOpenSettings && (
              <button type="button" className="primary" onClick={onOpenSettings}>{t('Open settings')}</button>
            )}
            <button type="button" className="ghost" onClick={() => setErrorHidden(true)}>{t('Try again')}</button>
          </div>
          <details className="error-panel-technical">
            <summary>{t('Technical detail')}</summary>
            <code>{error}</code>
          </details>
        </div>
      )}
      <div className="action-composer-wrap">
        <p className="quick-actions-heading">{character.in_combat ? t('YOUR MOVE') : t('What do you want to do?')}</p>
        <div className="quick-action-grid" aria-label={t('Quick actions')}>
          {quickActions.map(quick => (
            <button
              type="button"
              key={quick.id}
              className="quick-action-card"
              disabled={busy}
              onClick={() => runQuickAction(quick)}
            >
              <span className="quick-action-glyph" aria-hidden="true">{quick.glyph}</span>
              <span className="quick-action-label">{quick.label}</span>
              <small>{quick.description}</small>
            </button>
          ))}
        </div>
        {extraChips.length > 0 && (
          <div className="suggested-actions" aria-label={t('Suggested actions')}>
            <span className="suggestion-heading">{t('SUGGESTED')}</span>
            {extraChips.map(chip => (
              <button
                type="button"
                key={chip.action}
                disabled={busy}
                onClick={() => onAction(chip.action)}
              >
                {t(chip.label)}
              </button>
            ))}
          </div>
        )}
        <form className="action-box" onSubmit={handleSubmit}>
          <input ref={actionInputRef} value={action} onChange={event => setAction(event.target.value)} placeholder={busy ? t('The narrator is writing…') : t('What do you do?')} disabled={busy} aria-label={t('Your action')} />
          <button type="submit" className="primary" disabled={busy || !action.trim() || Boolean(spellWarning)} aria-label={t('Send action')}>→</button>
        </form>
        {characterSpells.length > 0 && (
          <div className="spell-picker">
              <label htmlFor="cast-spell">{t('Your spells')}</label>
            <select
              id="cast-spell"
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
              }}
              aria-label={t('Your spells')}
            >
              <option value="">{t('Choose a spell to cast')}</option>
              {characterSpells.some(spell => spell.level === 0) && (
                <optgroup label={t('Cantrips')}>
                  {characterSpells.filter(spell => spell.level === 0).map(spell => <option key={spell.name} value={spell.name}>{spell.name}</option>)}
                </optgroup>
              )}
              {[...new Set(characterSpells.filter(spell => spell.level > 0).map(spell => spell.level))].sort((a, b) => a - b).map(level => (
                <optgroup key={level} label={t(`Level ${level} spells`)}>
                  {characterSpells.filter(spell => spell.level === level).map(spell => <option key={spell.name} value={spell.name}>{spell.name}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        )}
        {spellWarning && <p className="spell-warning" role="status">{spellWarning}</p>}
        {!spellWarning && spellNotice && <p className="spell-warning" role="status">{spellNotice}</p>}
        <details className="game-help">
          <summary>{t('How actions and exploration work')}</summary>
          <small className="composer-note">{t('Each search uses one six-sided die: a 1 brings an enemy; other results may reveal clues, quiet, or 1–4 gold coins. After a fight or escape, your next search is safe. Rejected actions cost no Adventure Mana.')}</small>
          <small className="composer-note">{t('Action words guide ability checks: strength for force, dexterity for stealth, constitution to endure, intelligence to inspect, wisdom to notice, and charisma to persuade.')}</small>
        </details>
      </div>
    </section>
  );
}

export function CharacterScreen({
  character,
  characters,
  onSelect,
  onCreate,
}: {
  character: Character | null;
  characters: Character[];
  onSelect: (character: Character) => void;
  onCreate: () => void;
}) {
  const { t } = useI18n();
  if (!character) {
    return <section className="screen empty-screen"><p className="eyebrow">{t('CHARACTER')}</p><h1>{t('Your adventurers')}</h1><p>{t('Create a hero and their full sheet will live here.')}</p><button className="primary" onClick={onCreate}>{t('Create character')}</button></section>;
  }
  const modifier = (score: number) => {
    const value = Math.floor((score - 10) / 2);
    return `${value >= 0 ? '+' : ''}${value}`;
  };
  return (
    <section className="screen">
      <div className="page-title"><p className="eyebrow">{t('YOUR ADVENTURER')}</p><h1>{t('Character sheet')}</h1><p>{t('All the details you need before stepping into danger.')}</p></div>
      <article className="profile-card character-summary">
        <div className="profile-heading"><span className="hero-portrait">{character.name.charAt(0).toUpperCase()}</span><div><h2>{character.name}</h2><p>{t(titleCase(character.race))} {t(titleCase(character.character_class))}</p><span className="level-chip">{t('LEVEL')} {character.level}</span></div></div>
        <p className="stat-block-line">
          <span>{t('AC')} {character.armor_class}</span>
          <span>{t('HP')} {character.hp}/{character.max_hp}</span>
          <span>{character.gold} {t('gp')}</span>
        </p>
      </article>
      <details className="character-panel" open>
        <summary>{t('Combat & resources')}</summary>
        <div className="profile-vitals">
          <div><small>{t('HIT POINTS')}</small><strong>{character.hp} <i>/ {character.max_hp}</i></strong><HpBar character={character} /></div>
          <div><small>{t('ARMOR CLASS')}</small><strong>{character.armor_class}</strong></div>
          <div><small>{t('EXPERIENCE')}</small><strong>{character.xp} <i>XP</i></strong></div>
          <div><small>{t('GOLD')}</small><strong>{character.gold} <i>gp</i></strong></div>
          <details className="legacy-mana">
            <summary>{t('Mana (historical)')}</summary>
            <strong>{character.mana} <i>/ {character.max_mana}</i></strong>
            <p>{t('This legacy character resource does not power spells or Adventure Mana.')}</p>
          </details>
          <div><small>{t('Spell slots')}</small><strong><SpellSlots character={character} t={t} /></strong></div>
          {character.invisible && <div><small>{t('Condition')}</small><strong>{t('Invisible')}</strong></div>}
        </div>
      </details>
      <details className="character-panel" open>
        <summary>{t('Ability scores')}</summary>
        <div className="ability-grid">
          {ABILITIES.map(ability => {
            const score = character.abilities?.[ability] ?? 10;
            return <article className="ability-card" key={ability}><small>{ability.slice(0, 3).toUpperCase()}</small><strong>{score}</strong><span>{modifier(score)}</span></article>;
          })}
        </div>
      </details>
      <details className="character-panel" open>
        <summary>{t('Inventory')}</summary>
        <div className="inventory-card">
          {(character.inventory?.length ? character.inventory : [t('Your pack is empty')]).map((item, index) => <div key={`${item}-${index}`}><span aria-hidden="true">◇</span>{item}</div>)}
        </div>
      </details>
      {characters.length > 1 && (
        <section className="section-block">
          <div className="section-heading"><div><p className="eyebrow">{t('ROSTER')}</p><h2>{t('Switch adventurer')}</h2></div></div>
          <div className="roster-list">{characters.map(item => <button type="button" className={`roster-card ${item.id === character.id ? 'current' : ''}`} key={item.id} onClick={() => onSelect(item)}><span className="mini-portrait">{item.name.charAt(0).toUpperCase()}</span><span className="roster-copy"><strong>{item.name}</strong><small>{t(titleCase(item.race))} {t(titleCase(item.character_class))} · {t('Lv.')} {item.level}</small></span><span className="choice-arrow">{item.id === character.id ? '✓' : '›'}</span></button>)}</div>
        </section>
      )}
    </section>
  );
}

export function CampaignScreen({
  character,
  events,
  busy,
  onUpdate,
}: {
  character: Character | null;
  events: JournalEvent[];
  busy: boolean;
  onUpdate: (settings: Record<string, string | boolean>) => void;
}) {
  const { t } = useI18n();
  if (!character) return <section className="screen empty-screen"><p className="eyebrow">{t('CAMPAIGN')}</p><h1>{t('Your world awaits')}</h1><p>{t('Create a character to begin a campaign.')}</p></section>;
  const settings = [
    { key: 'difficulty', label: 'Combat challenge', choices: [['easy', 'Gentle'], ['normal', 'Balanced'], ['hard', 'Dangerous']] },
    { key: 'tone', label: 'Narrative tone', choices: [['light', 'Hopeful'], ['balanced', 'Balanced'], ['dark', 'Dark'], ['grimdark', 'Grim']] },
    { key: 'humor', label: 'Humor', choices: [['serious', 'Serious'], ['rare', 'Dry wit'], ['frequent', 'Playful'], ['comedy', 'Comedic']] },
  ] as const;
  return (
    <section className="screen">
      <div className="page-title"><p className="eyebrow">{t('THE WHISPERING CELLAR')}</p><h1>{t('Your campaign')}</h1><p>{t('A persistent story shaped by your choices. Settings apply to this character.')}</p></div>
      <article className="campaign-location"><span aria-hidden="true">⌖</span><div><small>{t('CURRENT LOCATION')}</small><strong>{character.location}</strong><p>{t(character.in_combat ? 'You are in the middle of a fight.' : 'The path is open. Decide where the story goes next.')}</p></div></article>
      {settings.map(group => (
        <fieldset className="settings-card" key={group.key} disabled={busy}>
          <legend>{t(group.label)}</legend>
          <div className="option-row">
            {group.choices.map(([value, label]) => (
              <button type="button" key={value} className={`option-card ${character[group.key] === value ? 'selected' : ''}`} aria-pressed={character[group.key] === value} onClick={() => onUpdate({ [group.key]: value })}>
                <strong>{t(label)}</strong><small>{t(value)}</small>
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <fieldset className="settings-card verbose-setting" disabled={busy}>
        <legend>{t('Story detail')}</legend>
        <p>{t('Choose how much descriptive prose you want between the game facts.')}</p>
        <div className="option-row">
          {[{ value: true, label: 'Immersive', detail: '3–5 sentences' }, { value: false, label: 'Concise', detail: '1–2 sentences' }].map(option => (
            <button type="button" key={String(option.value)} className={`option-card ${character.verbose === option.value ? 'selected' : ''}`} aria-pressed={character.verbose === option.value} onClick={() => onUpdate({ verbose: option.value })}><strong>{t(option.label)}</strong><small>{t(option.detail)}</small></button>
          ))}
        </div>
      </fieldset>
      <section className="section-block campaign-journal">
        <div className="section-heading"><div><p className="eyebrow">{t('YOUR CHOICES')}</p><h2>{t('Recent journal')}</h2></div><span className="event-count">{events.length} {t(events.length === 1 ? 'entry' : 'entries')}</span></div>
        {events.length ? (
          <div className="timeline">
            {[...events].reverse().slice(0, 12).map(event => (
              <article className="timeline-entry" key={event.id}><span className="timeline-dot" /><time>{new Date(event.created_at).toLocaleString()}</time><strong>{event.action}</strong><p>{event.result}</p></article>
            ))}
          </div>
        ) : <p className="empty-note">{t('Your first journal entry will appear when you take an action in the adventure.')}</p>}
      </section>
    </section>
  );
}

export function ToolsScreen({
  character,
  catalog,
  spells,
  calculating,
  calculation,
  error,
  onCalculate,
}: {
  character: Character | null;
  catalog: ReferenceCatalog;
  spells: Spell[];
  calculating: boolean;
  calculation: Record<string, unknown> | null;
  error: string | null;
  onCalculate: (level: number, monsters: string[]) => void;
}) {
  const { t } = useI18n();
  const [tool, setTool] = useState<'library' | 'calculator'>('library');
  const [search, setSearch] = useState('');
  const [spellLevel, setSpellLevel] = useState('all');
  const [spellScope, setSpellScope] = useState<'level' | 'catalog'>('level');
  const [level, setLevel] = useState(character?.level ?? 1);
  const [monster, setMonster] = useState('goblin');
  const [count, setCount] = useState(1);
  const maxSpellLevel = highestSpellLevel(character);
  const spellsAtProgression = maxSpellLevel > 0 ? spells.filter(spell => spell.level <= maxSpellLevel) : [];
  const filteredSpells = useMemo(() => spells.filter(spell => {
    const matchesSearch = `${spell.name} ${spell.school} ${spell.text}`.toLowerCase().includes(search.toLowerCase());
    const matchesLevel = spellLevel === 'all' || spell.level === Number(spellLevel);
    const matchesProgression = spellScope === 'catalog' || (maxSpellLevel > 0 && spell.level <= maxSpellLevel);
    return matchesSearch && matchesLevel && matchesProgression;
  }).slice(0, 60), [spells, search, spellLevel, spellScope, maxSpellLevel]);
  return (
    <section className="screen">
      <div className="page-title"><p className="eyebrow">{t('FIELD GUIDE')}</p><h1>{t("Adventurer's tools")}</h1><p>{t('Reference material and planning tools from the SRD catalog.')}</p></div>
      <div className="tool-switch" role="tablist" aria-label={t('Choose a tool')}>
        <button type="button" role="tab" aria-selected={tool === 'library'} className={tool === 'library' ? 'active' : ''} onClick={() => setTool('library')}>✧ {t('Spell library')} <span>{spells.length}</span></button>
        <button type="button" role="tab" aria-selected={tool === 'calculator'} className={tool === 'calculator' ? 'active' : ''} onClick={() => setTool('calculator')}>⚔ {t('Combat balance')}</button>
      </div>
      {tool === 'library' ? (
        <section className="tool-panel">
          <div className="spell-scope" role="group" aria-label={t('Spell reference range')}>
            <button type="button" aria-pressed={spellScope === 'level'} className={spellScope === 'level' ? 'selected' : ''} onClick={() => { setSpellScope('level'); setSpellLevel('all'); }}>
              {t('By level')}
            </button>
            <button type="button" aria-pressed={spellScope === 'catalog'} className={spellScope === 'catalog' ? 'selected' : ''} onClick={() => { setSpellScope('catalog'); setSpellLevel('all'); }}>
              {t('Full SRD reference')}
            </button>
          </div>
          {spellScope === 'level' && (
            <p className="notice-card spell-note" role="note">
              {maxSpellLevel > 0
                ? `${t('Showing spell levels up to')} ${maxSpellLevel}${t(', based on your character level. This full reference library is broader than your spellbook; class spell lists and known spells are not enforced yet in this library view. Use the game screen to see spells available to your character.')}`
                : t('This character does not currently have spell levels in the rules progression. Paladins and rangers gain their first spell slots at level 2. Open the full reference to browse SRD spells.')}
            </p>
          )}
          <div className="tool-search-row">
            <input className="form-input" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('Search spells, schools or descriptions…')} aria-label={t('Search spell library')} />
            <select className="form-select" value={spellLevel} onChange={event => setSpellLevel(event.target.value)} aria-label={t('Filter by spell level')} disabled={spellScope === 'level' && maxSpellLevel === 0}>
              <option value="all">{t('All levels')}</option>
              {Array.from({ length: spellScope === 'catalog' ? 10 : maxSpellLevel > 0 ? maxSpellLevel + 1 : 0 }, (_, index) => <option value={index} key={index}>{index === 0 ? t('Cantrips') : `${t('Level')} ${index}`}</option>)}
            </select>
          </div>
          <p className="results-caption">
            {t('Showing')} {filteredSpells.length} {t(filteredSpells.length === 60 ? 'of more' : 'of')} {spellScope === 'catalog' ? spells.length : spellsAtProgression.length} {t('spells')}
            {spellScope === 'level' && ` · ${t('through level')} ${maxSpellLevel}`}
          </p>
          <div className="spell-list">
            {filteredSpells.map(spell => (
              <details className="spell-card" key={spell.name}>
                <summary><span className="spell-level">{spell.level === 0 ? 'C' : spell.level}</span><span className="spell-name"><strong>{spell.name}</strong><small>{t(titleCase(spell.school))} · {spell.range}</small></span><span className="choice-arrow">⌄</span></summary>
                <p>{spell.text}</p>
              </details>
            ))}
            {!filteredSpells.length && <p className="empty-note">{t('No spells match that search. Try another name or level.')}</p>}
          </div>
          <p className="screen-footnote">{t('Search results are limited to 60 entries at a time. This library is only a reference; the game picker shows your class spells. Only selected damage and healing spells currently have modeled effects.')}</p>
        </section>
      ) : (
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

export function MapScreen({
  character,
  locations,
  onTravel,
}: {
  character: Character | null;
  locations: LocationReference[];
  onTravel: (action: string) => void;
}) {
  const { t } = useI18n();
  if (!character) {
    return <section className="screen"><p>{t('Choose or create an adventurer to see the map.')}</p></section>;
  }
  const node = locations.find(item => item.name === character.location);
  const quests = character.quest_flags ?? {};
  const edges = mapEdges(locations);
  const chapterPlaces = Object.keys(CHAPTER_ONE_LAYOUT);

  const edgeVisible = (from: string, to: string) => {
    const a = mapNodeState(from, character, locations);
    const b = mapNodeState(to, character, locations);
    return a !== 'hidden' && b !== 'hidden';
  };

  const shortLabel = (name: string) => name.replace(/^The /, '').replace(/'/g, '');

  return (
    <section className="screen map-screen">
      <div className="page-title"><p className="eyebrow">{t('WORLD')}</p><h1>{t('Map')}</h1><p>{t('You are here')}: <strong>{character.location}</strong></p></div>
      <div className="map-graph-wrap" aria-label={t('Campaign map')}>
        <svg className="map-graph" viewBox="0 0 100 100" role="img" aria-hidden="true">
          {edges.filter(edge => edgeVisible(edge.from, edge.to)).map(edge => {
            const a = CHAPTER_ONE_LAYOUT[edge.from];
            const b = CHAPTER_ONE_LAYOUT[edge.to];
            if (!a || !b) return null;
            const locked = !routeOpen(edge.to, quests) || !routeOpen(edge.from, quests);
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className={locked ? 'map-edge locked' : 'map-edge'}
              />
            );
          })}
        </svg>
        <div className="map-graph-nodes">
          {chapterPlaces.map(place => {
            const pos = CHAPTER_ONE_LAYOUT[place];
            const state = mapNodeState(place, character, locations);
            if (state === 'hidden') return null;
            const canTravel = Boolean(
              node?.connections.includes(place)
              && place !== character.location
              && routeOpen(place, quests)
              && state !== 'locked',
            );
            return (
              <button
                type="button"
                key={place}
                className={`map-graph-node ${state}`}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                disabled={!canTravel}
                title={place}
                onClick={() => onTravel(`travel to ${place}`)}
              >
                <span className="map-node-glyph" aria-hidden="true">
                  {state === 'current' ? '◉' : state === 'locked' ? '🔒' : state === 'visited' ? '◎' : '○'}
                </span>
                <span className="map-node-label">{shortLabel(place)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <ul className="map-legend" aria-label={t('Map legend')}>
        <li><span className="legend-dot current" /> {t('You are here')}</li>
        <li><span className="legend-dot adjacent" /> {t('Next stop')}</li>
        <li><span className="legend-dot visited" /> {t('Visited')}</li>
        <li><span className="legend-dot locked" /> {t('Locked route')}</li>
      </ul>
      {node && (
        <section className="map-routes-card">
          <h2>{t('Open routes')}</h2>
          <ol className="map-route-list">
            {node.connections.filter(route => routeOpen(route, quests)).map(route => (
              <li key={route}>
                <button type="button" className="text-button" onClick={() => onTravel(`travel to ${route}`)}>{route}</button>
              </li>
            ))}
          </ol>
        </section>
      )}
    </section>
  );
}

export function QuestScreen({ character }: { character: Character | null }) {
  const { t } = useI18n();
  if (!character) {
    return <section className="screen"><p>{t('Choose or create an adventurer to track quests.')}</p></section>;
  }
  const { steps, next } = chapterOneQuestProgress(character.quest_flags ?? {});
  const atNextLocation = next?.location && character.location === next.location;
  return (
    <section className="screen quest-screen">
      <div className="page-title"><p className="eyebrow">{t('CAMPAIGN')}</p><h1>{t('Quests')}</h1></div>
      {next ? (
        <article className={`quest-next-card ${atNextLocation ? 'here' : ''}`}>
          <p className="eyebrow">{t('NEXT STEP')}</p>
          <h2>{t(next.label)}</h2>
          <p>{t(next.hint)}</p>
          {next.location && (
            <p className="quest-next-meta">
              {atNextLocation ? t('You are at the right location.') : `${t('Head to')}: ${next.location}`}
            </p>
          )}
        </article>
      ) : (
        <article className="quest-next-card done">
          <p className="eyebrow">{t('CHAPTER ONE')}</p>
          <h2>{t('Bell quest complete')}</h2>
          <p>{t('The shrine bell is home and the Bell Warden is defeated.')}</p>
        </article>
      )}
      <ol className="quest-step-list">
        {steps.map(step => {
          const active = next?.id === step.id;
          return (
            <li key={step.id} className={`quest-step ${step.status} ${active ? 'active' : ''}`}>
              <span className="quest-step-marker" aria-hidden="true">{step.status === 'done' ? '✓' : active ? '→' : '·'}</span>
              <div>
                <strong>{t(step.label)}</strong>
                <small>{step.status === 'done' ? t('Complete') : active ? t('Current objective') : t('Not started')}</small>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function JournalScreen({ events }: { events: JournalEvent[] }) {
  const { t } = useI18n();
  return (
    <section className="screen">
      <div className="page-title"><p className="eyebrow">{t('HISTORY')}</p><h1>{t('Journal')}</h1></div>
      <div className="journal-scene" role="log" aria-label={t('Adventure journal')}>
        {events.length === 0 && <p>{t('Your story has not begun yet.')}</p>}
        {events.map(event => (
          <article className="journal-beat" key={event.id}>
            <time>{new Date(event.created_at).toLocaleString()}</time>
            <p className="journal-action">{event.action}</p>
            <p className="journal-narration">{event.result}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function SettingsScreen({
  economy,
  busy,
  error,
  onChangeTier,
  onLanguageChange,
  onOpenCampaign,
  onOpenTools,
}: {
  economy: Economy | null;
  busy: boolean;
  error: string | null;
  onChangeTier: (tier: string) => void;
  onLanguageChange?: (language: 'en' | 'cs') => void;
  onOpenCampaign?: () => void;
  onOpenTools?: () => void;
}) {
  const { t, locale, setLocale } = useI18n();
  return (
    <section className="screen">
      <div className="page-title"><p className="eyebrow">{t('YOUR PREFERENCES')}</p><h1>{t('Settings')}</h1><p>{t('Manage how each adventure turn is narrated.')}</p></div>
      <section className="section-block locale-setting">
        <label className="field-label" htmlFor="app-language">{t('Language')}</label>
        <select id="app-language" className="form-select" value={locale} onChange={event => {
          const next = event.target.value === 'cs' ? 'cs' : 'en';
          setLocale(next);
          onLanguageChange?.(next);
        }}>
          <option value="en">{t('English')}</option>
          <option value="cs">{t('Czech (no diacritics)')}</option>
        </select>
      </section>
      <div className="settings-shortcuts">
        {onOpenCampaign && (
          <button type="button" className="text-button" onClick={onOpenCampaign}>{t('Campaign mood and tone')}</button>
        )}
        {onOpenTools && (
          <button type="button" className="text-button" onClick={onOpenTools}>{t('Rules and spell reference')}</button>
        )}
      </div>
      <article className="balance-card">
        <div className="balance-icon">✧</div><div className="balance-copy"><small>{t('AVAILABLE ADVENTURE MANA')}</small><strong>{economy ? economy.balance.toFixed(1) : '—'} <i>⚡</i></strong><p>{t('Separate from spell slots; spellcaster classes spend slots to cast spells.')}</p></div><ManaHelp />
      </article>
      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">{t('THE STORYTELLER')}</p><h2>{t('Choose narration quality')}</h2></div></div>
        <div className="tier-list">
          {economy?.tiers.map(tier => (
            <button type="button" className={`tier-card ${economy.tier === tier.key ? 'selected' : ''}`} key={tier.key} disabled={busy || economy.tier === tier.key} onClick={() => onChangeTier(tier.key)}>
              <span className={`tier-dot ${tier.key}`} /><span className="tier-copy"><strong>{t(tier.label)}</strong><small>{t(tier.description)}</small></span><span className="tier-cost">{tier.cost.toFixed(1)} <i>⚡</i><small>{t('/ changed turn')}</small></span>
            </button>
          ))}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </section>
      <article className="notice-card"><span aria-hidden="true">ⓘ</span><div><strong>{t('Top-ups are not available yet')}</strong><p>{t('This build does not process payments. No real-money purchase can be made from the Mini App.')}</p></div></article>
      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">{t('HOW IT WORKS')}</p><h2>{t('Adventure Mana')}</h2></div></div>
        <div className="mana-explainer">
          <div><strong>⚡ {t('Adventure Mana')}</strong><p>{t('Pays for a story turn when the game state changes. Balance is shared by your Telegram account.')}</p></div>
          <div><strong>✦ {t('Spell slots')}</strong><p>{t('Spell slots power casting for spellcaster classes. They are separate from Adventure Mana, which pays only for story turns.')}</p></div>
        </div>
      </section>
      <article className="notice-card storyteller-note" role="note">
        <div><strong>{t('When is the storyteller using AI?')}</strong><p>{t('AI-written narration requires')} <code>MODEL_PROVIDER=ollama</code> {t('and a running Ollama service. Otherwise the game uses its built-in offline storyteller. Narrator tiers do not change game rules.')} {t("You can confirm it's live in Settings → Narrator when the offline-storyteller banner disappears.")}</p></div>
      </article>
      <section className="section-block license-section">
        <div className="section-heading"><div><p className="eyebrow">{t('CONTENT CREDITS')}</p><h2>{t('SRD 5.1 license')}</h2></div></div>
        <details>
          <summary>{t('Show attribution and license')}</summary>
          <p>
            This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at{' '}
            <a href="https://dnd.wizards.com/resources/systems-reference-document">{t('the official SRD page')}</a>.
            {' '}The SRD 5.1 is licensed under the{' '}
            <a href="https://creativecommons.org/licenses/by/4.0/legalcode">{t('Creative Commons Attribution 4.0 International License')}</a>.
          </p>
        </details>
      </section>
    </section>
  );
}

export function MoreScreen({ onNavigate }: { onNavigate: (screen: AppScreen) => void }) {
  const { t } = useI18n();
  const links: Array<{ key: AppScreen; label: string; description: string; glyph: string }> = [
    { key: 'journal', label: t('Journal'), description: t('Story and action history'), glyph: '📜' },
    { key: 'settings', label: t('Settings'), description: t('Language, narrator and game'), glyph: '⚙' },
    { key: 'tools', label: t('Rules & spells'), description: t('SRD reference and encounter tools'), glyph: '⬡' },
    { key: 'campaign', label: t('Campaign mood'), description: t('Difficulty, tone and humor'), glyph: '◇' },
  ];
  return (
    <section className="screen more-screen">
      <div className="page-title"><p className="eyebrow">{t('MENU')}</p><h1>{t('More')}</h1></div>
      <ul className="more-link-list">
        {links.map(link => (
          <li key={link.key}>
            <button type="button" className="more-link-card" onClick={() => onNavigate(link.key)}>
              <span aria-hidden="true">{link.glyph}</span>
              <div><strong>{link.label}</strong><small>{link.description}</small></div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BottomNav({ screen, onNavigate }: { screen: AppScreen; onNavigate: (screen: AppScreen) => void }) {
  const { t } = useI18n();
  const moreScreens: AppScreen[] = ['more', 'journal', 'settings', 'tools', 'campaign'];
  const active: AppScreen =
    screen === 'create' || screen === 'home'
      ? 'home'
      : screen === 'game'
        ? 'game'
        : moreScreens.includes(screen)
          ? 'more'
          : screen;
  const items: Array<{ key: AppScreen; label: string; glyph: string }> = [
    { key: 'home', label: t('Hub'), glyph: '⌂' },
    { key: 'game', label: t('Play'), glyph: '⚔' },
    { key: 'map', label: t('Map'), glyph: '⌖' },
    { key: 'quests', label: t('Quests'), glyph: '◇' },
    { key: 'character', label: t('Hero'), glyph: '♙' },
    { key: 'more', label: t('More'), glyph: '•••' },
  ];
  return (
    <nav className="bottom-nav" aria-label={t('Main navigation')}>
      {items.map(item => (
        <button
          type="button"
          className={active === item.key ? 'active' : ''}
          aria-current={active === item.key ? 'page' : undefined}
          key={item.key}
          onClick={() => onNavigate(item.key)}
        >
          <span aria-hidden="true">{item.glyph}</span>
          <small>{item.label}</small>
        </button>
      ))}
    </nav>
  );
}
