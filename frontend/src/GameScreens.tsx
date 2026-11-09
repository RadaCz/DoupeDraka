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
  QuestCatalog,
  Spell,
} from './types';
import { useI18n } from './i18n';
import { CHAPTER_ONE_LAYOUT, mapEdges, mapLocationEmoji, mapLockReason, mapNodeState, routeOpen } from './chapterOneMap';
import { chapterOneQuestProgress, visibleQuestTimeline } from './questProgress';
import { JournalResultBody } from './components/journalBlocks';
import { InventoryList } from './components/InventoryList';
import { ShareButton } from './components/ShareButton';
import { HpBar, SpellSlots, titleCase } from './components/characterVitals';
import { buildJournalShareMessage, journalExcerpt } from './share/adventureShare';
import { GameScreenRouter } from './screens/GameScreenRouter';

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

function ManaHelp() {
  const { t } = useI18n();
  return (
    <details className="mana-info">
      <summary aria-label={t('About narrator credits')} title={t('About narrator credits')}>?</summary>
      <div className="mana-info-popover">
        <p>{t('Narrator credits pay for changed turns at paid narration tiers. Lite turns, rests and no-op actions are free.')}</p>
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
          <div className="mana-stat-copy"><small>{t('NARRATOR CREDITS')}</small><strong>{economy ? economy.balance.toFixed(1) : '—'} <i>⚡</i></strong><ManaHelp /></div>
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
          <p>{t('Share Doupě Draka with friends — invite links help us grow the playtest.')}</p>
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
}) {
  return <GameScreenRouter {...props} turnPhase={props.turnPhase ?? 'idle'} />;
}

export function CharacterScreen({
  character,
  characters,
  spells,
  questCatalog,
  onSelect,
  onCreate,
  onOpenMap,
  onInventoryAction,
  busy,
}: {
  character: Character | null;
  characters: Character[];
  spells: Spell[];
  questCatalog?: QuestCatalog;
  onSelect: (character: Character) => void;
  onCreate: () => void;
  onOpenMap?: () => void;
  onInventoryAction?: (action: string) => void;
  busy?: boolean;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<'sheet' | 'quests'>('sheet');
  if (!character) {
    return <section className="screen empty-screen"><p className="eyebrow">{t('CHARACTER')}</p><h1>{t('Your adventurers')}</h1><p>{t('Create a hero and their full sheet will live here.')}</p><button className="primary" onClick={onCreate}>{t('Create character')}</button></section>;
  }
  if (tab === 'quests') {
    return (
      <section className="screen quest-screen">
        <div className="character-hub-tabs" role="tablist" aria-label={t('Character hub')}>
          <button type="button" role="tab" aria-selected={false} onClick={() => setTab('sheet')}>{t('Character sheet')}</button>
          <button type="button" role="tab" className="active" aria-selected onClick={() => setTab('quests')}>{t('Quests')}</button>
        </div>
        <QuestPanel character={character} questCatalog={questCatalog} />
        {onOpenMap && (
          <button type="button" className="text-button" onClick={onOpenMap}>{t('Open world map')}</button>
        )}
      </section>
    );
  }
  const modifier = (score: number) => {
    const value = Math.floor((score - 10) / 2);
    return `${value >= 0 ? '+' : ''}${value}`;
  };
  return (
    <section className="screen">
      <div className="character-hub-tabs" role="tablist" aria-label={t('Character hub')}>
        <button type="button" role="tab" className="active" aria-selected onClick={() => setTab('sheet')}>{t('Character sheet')}</button>
        <button type="button" role="tab" aria-selected={false} onClick={() => setTab('quests')}>{t('Quests')}</button>
      </div>
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
          <InventoryList character={character} busy={busy} onInventoryAction={onInventoryAction} />
        </div>
      </details>
      <details className="character-panel" open>
        <summary>{t('Spells')}</summary>
        <div className="spell-roster">
          {(() => {
            const known = new Set([...(character.known_spells ?? []), ...(character.prepared_spells ?? [])]);
            const rows = spells.filter(spell => known.has(spell.name)).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
            if (!rows.length) return <p className="empty-note">{t('No spells known yet.')}</p>;
            return rows.map(spell => (
              <div key={spell.name} className={spell.effect_modeled ? 'spell-row' : 'spell-row muted'}>
                <strong>{spell.name}</strong>
                <small>{spell.level === 0 ? t('Cantrip') : t(`Level ${spell.level}`)}</small>
                {!spell.effect_modeled && <span className="spell-tag">{t('Not modeled in MVP')}</span>}
              </div>
            ));
          })()}
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
    <section className="screen tools-screen">
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
  const [selected, setSelected] = useState<string | null>(null);
  if (!character) {
    return <section className="screen"><p>{t('Choose or create an adventurer to see the map.')}</p></section>;
  }
  const node = locations.find(item => item.name === character.location);
  const quests = character.quest_flags ?? {};
  const edges = mapEdges(locations);
  const chapterPlaces = Object.keys(CHAPTER_ONE_LAYOUT);
  const selectedRef = selected ? locations.find(item => item.name === selected) : null;
  const selectedState = selected ? mapNodeState(selected, character, locations) : null;
  const canTravelToSelected = Boolean(
    selected
    && node?.connections.includes(selected)
    && selected !== character.location
    && routeOpen(selected, quests)
    && selectedState !== 'locked',
  );

  const edgeVisible = (from: string, to: string) => {
    const a = mapNodeState(from, character, locations);
    const b = mapNodeState(to, character, locations);
    return a !== 'hidden' && b !== 'hidden';
  };

  const shortLabel = (name: string) => name.replace(/^The /, '').replace(/'/g, '');

  return (
    <section className="screen map-screen">
      <div className="page-title"><p className="eyebrow">{t('CHAPTER ONE')}</p><h1>{t('Map')}</h1><p>{t('You are here')}: <strong>{character.location}</strong></p></div>
      <div className="map-graph-wrap map-parchment" aria-label={t('Campaign map')}>
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
            return (
              <button
                type="button"
                key={place}
                className={`map-graph-node ${state}`}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                title={place}
                onClick={() => setSelected(place)}
              >
                <span className="map-node-glyph" aria-hidden="true">
                  {state === 'current' ? '◉' : state === 'locked' ? '🔒' : state === 'visited' ? '◎' : '○'}
                </span>
                <span className="map-node-label">
                  <span className="map-node-place-icon" aria-hidden="true">{mapLocationEmoji(place)}</span>
                  {shortLabel(place)}
                </span>
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
                <button type="button" className="text-button" onClick={() => setSelected(route)}>
                  <span aria-hidden="true">{mapLocationEmoji(route)}</span> {route}
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
      {selected && selectedRef && (
        <div className="map-location-sheet" role="dialog" aria-modal="true" aria-labelledby="map-sheet-title">
          <article className="map-location-sheet-card">
            <button type="button" className="icon-button map-sheet-close" aria-label={t('Close')} onClick={() => setSelected(null)}>×</button>
            <p className="eyebrow">{t(selectedState === 'current' ? 'You are here' : selectedState === 'visited' ? 'Visited' : selectedState === 'locked' ? 'Locked route' : 'Discovered')}</p>
            <h2 id="map-sheet-title"><span aria-hidden="true">{mapLocationEmoji(selected)}</span> {selected}</h2>
            <p>{selectedRef.arrival_beat ? t(selectedRef.arrival_beat) : t('No description yet for this place.')}</p>
            {canTravelToSelected ? (
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setSelected(null);
                  onTravel(`travel to ${selected}`);
                }}
              >
                {t('Set out')}
              </button>
            ) : (
              <p className="map-sheet-muted">
                {selected === character.location
                  ? t('You are already here.')
                  : t(mapLockReason(selected, quests))}
              </p>
            )}
          </article>
        </div>
      )}
    </section>
  );
}

function questStepsFromCatalog(questCatalog?: QuestCatalog) {
  const campaign = questCatalog?.campaigns?.[0];
  if (!campaign?.steps?.length) return undefined;
  return campaign.steps.map(step => ({
    id: step.id,
    label: step.label,
    hint: step.hint,
    location: step.location ?? undefined,
  }));
}

export function QuestPanel({ character, questCatalog }: { character: Character; questCatalog?: QuestCatalog }) {
  const { t } = useI18n();
  const stepSource = questStepsFromCatalog(questCatalog);
  const { done, active, teaser } = visibleQuestTimeline(character.quest_flags ?? {}, stepSource);
  const sideQuest = questCatalog?.side_quests?.[0];
  const sideComplete = sideQuest ? Boolean(character.quest_flags?.[sideQuest.reward_flag]) : false;
  const atNextLocation = active?.location && character.location === active.location;
  return (
    <>
      <div className="page-title"><p className="eyebrow">{t('CAMPAIGN')}</p><h1>{t('Quests')}</h1></div>
      <article className="quest-main-card">
        <p className="eyebrow">{t('MAIN QUEST')}</p>
        <h2>{t('The lost shrine bell')}</h2>
        <p>{t('Return Caldus’s stolen bell and quiet the Vault of Echoes.')}</p>
      </article>
      {active ? (
        <article className={`quest-next-card ${atNextLocation ? 'here' : ''}`}>
          <p className="eyebrow">{t('CURRENT OBJECTIVE')}</p>
          <h2>{t(active.label)}</h2>
          <p>{t(active.hint)}</p>
          {active.location && (
            <p className="quest-next-meta">
              {atNextLocation ? t('You are at the right location.') : `${t('Head to')}: ${active.location}`}
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
      {teaser && <p className="quest-teaser">{t(teaser)}</p>}
      {sideQuest && (
        <article className={`quest-next-card ${sideComplete ? 'done' : ''}`}>
          <p className="eyebrow">{t('SIDE QUEST')}</p>
          <h2>{t(sideQuest.title)}</h2>
          <p>{sideComplete ? t('Relic secured in the Forgotten Crypt.') : t(sideQuest.hint)}</p>
        </article>
      )}
      {done.length > 0 && (
        <ol className="quest-step-list">
          {done.map(step => (
            <li key={step.id} className="quest-step done">
              <span className="quest-step-marker" aria-hidden="true">✓</span>
              <div>
                <strong>{t(step.label)}</strong>
                <small>{t('Complete')}</small>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

export function QuestScreen({
  character,
  questCatalog,
}: {
  character: Character | null;
  questCatalog?: QuestCatalog;
}) {
  const { t } = useI18n();
  if (!character) {
    return <section className="screen"><p>{t('Choose or create an adventurer to track quests.')}</p></section>;
  }
  return (
    <section className="screen quest-screen">
      <QuestPanel character={character} questCatalog={questCatalog} />
    </section>
  );
}

export function JournalScreen({
  events,
  character,
}: {
  events: JournalEvent[];
  character: Character | null;
}) {
  const { t } = useI18n();
  return (
    <section className="screen">
      <div className="page-title"><p className="eyebrow">{t('HISTORY')}</p><h1>{t('Journal')}</h1></div>
      <div className="journal-scene journal-presentation-text-first" role="log" aria-label={t('Adventure journal')}>
        {events.length === 0 && <p>{t('Your story has not begun yet.')}</p>}
        {events.map(event => (
          <article className="journal-beat" key={event.id}>
            <div className="journal-beat-head">
              <time>{new Date(event.created_at).toLocaleString()}</time>
              {character && (
                <ShareButton
                  message={buildJournalShareMessage(
                    character,
                    journalExcerpt(event.result),
                    event.action,
                  )}
                />
              )}
            </div>
            <p className="journal-action">{event.action}</p>
            <div className="journal-narration"><JournalResultBody result={event.result} /></div>
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
    <section className="screen settings-screen">
      <div className="page-title"><p className="eyebrow">{t('YOUR PREFERENCES')}</p><h1>{t('Settings')}</h1><p>{t('Manage how each adventure turn is narrated.')}</p></div>
      <section className="section-block locale-setting">
        <label className="field-label" htmlFor="app-language">
          <span className="settings-section-icon" aria-hidden="true">🌍</span>
          {t('Language')}
        </label>
        <select id="app-language" className="form-select" value={locale} onChange={event => {
          const next = event.target.value === 'cs' ? 'cs' : 'en';
          setLocale(next);
          onLanguageChange?.(next);
        }}>
          <option value="en">{t('English')}</option>
          <option value="cs">{t('Czech')}</option>
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
        <div className="balance-icon" aria-hidden="true">⚡</div>
        <div className="balance-copy"><small>{t('AVAILABLE NARRATOR CREDITS')}</small><strong>{economy ? economy.balance.toFixed(1) : '—'} <i>⚡</i></strong><p>{t('Separate from spell slots; spellcaster classes spend slots to cast spells.')}</p></div><ManaHelp />
      </article>
      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow"><span aria-hidden="true">🎭</span> {t('THE STORYTELLER')}</p><h2>{t('Choose narration quality')}</h2></div></div>
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
        <div className="section-heading"><div><p className="eyebrow"><span aria-hidden="true">⚡</span> {t('HOW IT WORKS')}</p><h2>{t('Narrator credits')}</h2></div></div>
        <div className="mana-explainer">
          <div><strong>⚡ {t('Narrator credits')}</strong><p>{t('Pays for a story turn when the game state changes. Balance is shared by your Telegram account.')}</p></div>
          <div><strong>✦ {t('Spell slots')}</strong><p>{t('Spell slots power casting for spellcaster classes. They are separate from narrator credits, which pay only for story turns.')}</p></div>
        </div>
      </section>
      <article className="notice-card storyteller-note" role="note">
        <div><strong>{t('When is the storyteller using AI?')}</strong><p>{t('Lite always uses the built-in offline storyteller for free. Normal charges narrator credits only when an external provider (for example NVIDIA NIM or Groq) is configured and delivers paid narration. Local Ollama is not billed on Normal. Pro is disabled in closed beta. Tiers never change game rules.')}</p></div>
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
    { key: 'map', label: t('Map'), description: t('World map and travel'), glyph: '🗺' },
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
  const moreScreens: AppScreen[] = ['more', 'journal', 'settings', 'tools', 'campaign', 'map'];
  const characterScreens: AppScreen[] = ['character', 'quests'];
  const active: AppScreen =
    screen === 'create' || screen === 'home'
      ? 'home'
      : screen === 'game'
        ? 'game'
        : characterScreens.includes(screen)
          ? 'character'
          : moreScreens.includes(screen)
            ? 'more'
            : screen;
  const items: Array<{ key: AppScreen; label: string; glyph: string }> = [
    { key: 'home', label: t('Hub'), glyph: '⌂' },
    { key: 'game', label: t('Play'), glyph: '⚔' },
    { key: 'character', label: t('Character'), glyph: '♙' },
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
