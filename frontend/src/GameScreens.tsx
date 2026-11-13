import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
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
import { displayLocation } from './i18n/gameDisplay';
import { questStepsFromCatalog, visibleQuestTimeline } from './questProgress';
import { questStakesMessage } from './quests/questStory';
import { latestStoryBeatForOverview } from './journal/journalPresentation';
import { type JournalFilter } from './journalCategories';
import { InviteShareCard } from './components/InviteShareCard';
import { JournalChronicle } from './journal/JournalChronicle';
import { QuestChronicle } from './quests/QuestChronicle';
import { HpBar, SpellSlots, titleCase } from './components/characterVitals';
import { GameScreenRouter } from './screens/GameScreenRouter';

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
  events,
  questCatalog,
  onContinue,
  onCreate,
  onPreset,
  onOpenMap,
  onOpenQuests,
  onOpenJournal,
}: {
  character: Character | null;
  characters: Character[];
  presets: HeroPreset[];
  economy: Economy | null;
  events: JournalEvent[];
  questCatalog?: QuestCatalog;
  onContinue: () => void;
  onCreate: () => void;
  onPreset: (key: string) => void;
  onOpenMap?: () => void;
  onOpenQuests?: () => void;
  onOpenJournal?: () => void;
}) {
  const { t, locale } = useI18n();
  const flags = character?.quest_flags ?? {};
  const questTimeline = character
    ? visibleQuestTimeline(flags, questStepsFromCatalog(questCatalog))
  : null;
  const questStakes = character ? questStakesMessage(flags) : '';
  const lastBeat = character ? latestStoryBeatForOverview(events, locale) : '';
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
            <span>⌖ {displayLocation(character.location, locale)}</span>
          </div>
          {character.hp <= 0 ? (
            <button type="button" className="primary continue-button" onClick={onContinue}>
              {t('Revive hero')} <span aria-hidden="true">→</span>
            </button>
          ) : (
            <button type="button" className="primary continue-button" onClick={onContinue}>
              {t('Continue adventure')} <span aria-hidden="true">→</span>
            </button>
          )}
          {(questTimeline?.active || lastBeat) && (
            <div className="hub-campaign-pulse">
              {questTimeline?.active && (
                <div className="hub-quest-teaser">
                  <p className="eyebrow">{t('MAIN QUEST')}</p>
                  <strong>{t(questTimeline.active.label)}</strong>
                  <p>{t(questTimeline.active.hint)}</p>
                  {questStakes && <p className="hub-quest-stakes">{t(questStakes)}</p>}
                </div>
              )}
              {lastBeat && (
                <blockquote className="hub-last-beat">
                  <p className="eyebrow">{t('LAST STORY BEAT')}</p>
                  <p>{lastBeat}</p>
                  {onOpenJournal && (
                    <button type="button" className="text-button hub-open-journal" onClick={onOpenJournal}>
                      {t('Open full journal')} →
                    </button>
                  )}
                </blockquote>
              )}
            </div>
          )}
          <div className="home-shortcut-row">
            <button type="button" className="home-shortcut" onClick={onOpenMap}>{t('Map')}</button>
            <button type="button" className="home-shortcut" onClick={onOpenQuests}>{t('Quests')}</button>
          </div>
        </article>
      ) : (
        <article className="empty-adventure-card">
          <div className="empty-orbit" aria-hidden="true">✧</div>
          <h2>{t('Your story starts with a hero')}</h2>
          <p>{t('Choose a ready-made adventurer or create one of your own.')}</p>
          <button type="button" className="primary" onClick={onCreate}>{t('Create your character')} <span aria-hidden="true">→</span></button>
        </article>
      )}

      {!character && (
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
      )}
      {character && (
        <p className="screen-footnote">{t('Manage other heroes, invites, and references from the More tab.')}</p>
      )}
      {!character && (
        <p className="screen-footnote">{t('Pick a ready-made hero or build your own — your adventure starts on the Play tab.')}</p>
      )}
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

export { CharacterScreen } from './screens/CharacterScreen';

const CAMPAIGN_STYLE_GROUPS = [
  { key: 'difficulty' as const, label: 'Combat challenge', choices: [['easy', 'Gentle'], ['normal', 'Balanced'], ['hard', 'Dangerous']] as const },
  { key: 'tone' as const, label: 'Narrative tone', choices: [['light', 'Hopeful'], ['balanced', 'Balanced'], ['dark', 'Dark'], ['grimdark', 'Grim']] as const },
  { key: 'humor' as const, label: 'Humor', choices: [['serious', 'Serious'], ['rare', 'Dry wit'], ['frequent', 'Playful'], ['comedy', 'Comedic']] as const },
];

export function CampaignStylePanel({
  character,
  busy,
  onUpdate,
}: {
  character: Character;
  busy: boolean;
  onUpdate: (settings: Record<string, string | boolean>) => void;
}) {
  const { t, locale } = useI18n();
  return (
    <section className="section-block campaign-style-panel" aria-labelledby="campaign-style-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t('ADVENTURE STYLE')}</p>
          <h2 id="campaign-style-heading">{t('Campaign mood and tone')}</h2>
        </div>
      </div>
      <p className="section-lead">{t('Difficulty, tone, and humor apply to this character only.')}</p>
      <article className="campaign-location campaign-location-compact">
        <span aria-hidden="true">⌖</span>
        <div>
          <small>{t('CURRENT LOCATION')}</small>
          <strong>{displayLocation(character.location, locale)}</strong>
        </div>
      </article>
      {CAMPAIGN_STYLE_GROUPS.map(group => (
        <fieldset className="settings-card" key={group.key} disabled={busy}>
          <legend>{t(group.label)}</legend>
          <div className="option-row">
            {group.choices.map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={`option-card ${character[group.key] === value ? 'selected' : ''}`}
                aria-pressed={character[group.key] === value}
                onClick={() => onUpdate({ [group.key]: value })}
              >
                <strong>{t(label)}</strong>
                <small>{t(value)}</small>
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
            <button
              type="button"
              key={String(option.value)}
              className={`option-card ${character.verbose === option.value ? 'selected' : ''}`}
              aria-pressed={character.verbose === option.value}
              onClick={() => onUpdate({ verbose: option.value })}
            >
              <strong>{t(option.label)}</strong>
              <small>{t(option.detail)}</small>
            </button>
          ))}
        </div>
      </fieldset>
      </section>
  );
}

export function CampaignScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t } = useI18n();
  return (
    <section className="screen empty-screen">
      <p className="eyebrow">{t('CAMPAIGN')}</p>
      <h1>{t('Adventure style moved')}</h1>
      <p>{t('Difficulty, tone, and humor now live under Settings → Campaign mood and tone.')}</p>
      <button type="button" className="primary" onClick={onOpenSettings}>{t('Open settings')}</button>
    </section>
  );
}

export { ToolsScreen } from './screens/ToolsScreen';

export { MapScreen } from './map/MapScreen';

export function QuestPanel(props: ComponentProps<typeof QuestChronicle>) {
  return <QuestChronicle {...props} />;
}

export function QuestScreen({
  character,
  questCatalog,
  journalEvents,
  onOpenJournal,
  onOpenMap,
  onContinueAdventure,
}: {
  character: Character | null;
  questCatalog?: QuestCatalog;
  journalEvents?: JournalEvent[];
  onOpenJournal?: () => void;
  onOpenMap?: (location?: string) => void;
  onContinueAdventure?: () => void;
}) {
  const { t } = useI18n();
  if (!character) {
    return <section className="screen"><p>{t('Choose or create an adventurer to track quests.')}</p></section>;
  }
  return (
    <section className="screen quest-screen quest-screen-v2">
      <QuestChronicle
        character={character}
        questCatalog={questCatalog}
        journalEvents={journalEvents}
        onOpenJournal={onOpenJournal}
        onOpenMap={onOpenMap}
        onContinueAdventure={onContinueAdventure}
      />
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
  const [filter, setFilter] = useState<JournalFilter>('all');
  const filters: Array<{ id: JournalFilter; label: string }> = [
    { id: 'all', label: t('All beats') },
    { id: 'story', label: t('Story') },
    { id: 'talk', label: t('Talk & NPCs') },
    { id: 'discover', label: t('Discoveries') },
    { id: 'combat', label: t('Combat') },
    { id: 'quest', label: t('Quest beats') },
    { id: 'rewards', label: t('Rewards & consequences') },
  ];
  return (
    <section className="screen journal-screen journal-screen-v2">
      <div className="page-title"><p className="eyebrow">{t('HISTORY')}</p><h1>{t('Journal')}</h1><p>{t('Chronicle of your adventure — newest entries at the bottom.')}</p></div>
      <div className="journal-filter-row" role="tablist" aria-label={t('Filter journal')}>
        {filters.map(item => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            className={filter === item.id ? 'journal-filter active' : 'journal-filter'}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <JournalChronicle events={events} character={character} filter={filter} mode="page" />
    </section>
  );
}

export function SettingsScreen({
  character,
  economy,
  busy,
  error,
  onChangeTier,
  onLanguageChange,
  onUpdateCampaign,
  onOpenTools,
  showTelegramLink,
  telegramLinkBusy,
  telegramLinkNotice,
  onLinkTelegram,
}: {
  character: Character | null;
  economy: Economy | null;
  busy: boolean;
  error: string | null;
  onChangeTier: (tier: string) => void;
  onLanguageChange?: (language: 'en' | 'cs') => void;
  onUpdateCampaign?: (settings: Record<string, string | boolean>) => void;
  onOpenTools?: () => void;
  showTelegramLink?: boolean;
  telegramLinkBusy?: boolean;
  telegramLinkNotice?: string | null;
  onLinkTelegram?: () => void;
}) {
  const { t, locale, setLocale } = useI18n();
  return (
    <section className="screen settings-screen">
      <div className="page-title"><p className="eyebrow">{t('YOUR PREFERENCES')}</p><h1>{t('Settings')}</h1><p>{t('Manage how each adventure turn is narrated.')}</p></div>
      {showTelegramLink && onLinkTelegram && (
        <section className="section-block telegram-link-block" aria-labelledby="telegram-link-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t('ACCOUNT')}</p>
              <h2 id="telegram-link-heading">{t('Link Telegram')}</h2>
            </div>
          </div>
          <p>{t('Connect this browser account to your Telegram identity so both entry points share the same heroes.')}</p>
          <button type="button" className="primary" disabled={busy || telegramLinkBusy} onClick={onLinkTelegram}>
            {telegramLinkBusy ? t('Linking…') : t('Link Telegram now')}
          </button>
          {telegramLinkNotice && <p className="notice" role="status">{telegramLinkNotice}</p>}
        </section>
      )}
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
      {onOpenTools && (
        <div className="settings-shortcuts">
          <button type="button" className="text-button" onClick={onOpenTools}>{t('Rules and spell reference')}</button>
        </div>
      )}
      {character && onUpdateCampaign && (
        <CampaignStylePanel character={character} busy={busy} onUpdate={onUpdateCampaign} />
      )}
      <article className="balance-card">
        <div className="balance-icon" aria-hidden="true">⚡</div>
        <div className="balance-copy"><small>{t('AVAILABLE NARRATOR CREDITS')}</small><strong>{economy ? economy.balance.toFixed(1) : '—'} <i>⚡</i></strong><p>{t('Separate from spell slots; spellcaster classes spend slots to cast spells.')}</p></div><ManaHelp />
      </article>
      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow"><span aria-hidden="true">🎭</span> {t('THE STORYTELLER')}</p><h2>{t('Choose narration quality')}</h2></div></div>
        <div className="tier-list">
          {economy?.tiers.map(tier => (
            <button
              type="button"
              className={`tier-card ${economy.tier === tier.key ? 'selected' : ''}`}
              key={tier.key}
              disabled={busy || economy.tier === tier.key}
              onClick={() => onChangeTier(tier.key)}
            >
              <span className={`tier-dot ${tier.key}`} />
              <span className="tier-copy">
                <strong>{t(tier.label)}</strong>
                <small>{t(tier.description)}</small>
              </span>
              <span className="tier-cost">
                {tier.cost.toFixed(1)} <i>⚡</i>
                <small>{t('/ changed turn')}</small>
              </span>
            </button>
          ))}
        </div>
        {economy && economy.tiers.length === 1 && economy.tiers[0]?.key === 'lite' && (
          <p className="settings-tier-hint" role="note">
            {t('Normal paid narration needs an external provider on the server. This build uses Lite (free offline storyteller) only.')}
          </p>
        )}
        {!economy?.tiers.some(tier => tier.key === 'pro') && (
          <p className="settings-tier-hint muted" role="note">{t('Pro tier is disabled in this beta.')}</p>
        )}
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

export function MoreScreen({
  onNavigate,
  onCreateHero,
  hasHero,
}: {
  onNavigate: (screen: AppScreen) => void;
  onCreateHero?: () => void;
  hasHero?: boolean;
}) {
  const { t } = useI18n();
  const links: Array<{ key: AppScreen; label: string; description: string; glyph: string }> = [
    { key: 'map', label: t('Map'), description: t('World map and travel'), glyph: '🗺' },
    { key: 'quests', label: t('Quests'), description: t('Main quest and progress'), glyph: '🎯' },
    { key: 'journal', label: t('Journal'), description: t('Story and action history'), glyph: '📜' },
    { key: 'settings', label: t('Settings'), description: t('Language, narrator and game'), glyph: '⚙' },
    { key: 'tools', label: t('Rules & spells'), description: t('SRD reference and encounter tools'), glyph: '⬡' },
  ];
  return (
    <section className="screen more-screen">
      <div className="page-title"><p className="eyebrow">{t('MENU')}</p><h1>{t('More')}</h1></div>
      <InviteShareCard />
      {hasHero && onCreateHero && (
        <button type="button" className="text-button more-create-hero" onClick={onCreateHero}>{t('Create another adventurer')}</button>
      )}
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
  const moreScreens: AppScreen[] = ['more', 'journal', 'settings', 'tools', 'campaign', 'map', 'quests'];
  const characterScreens: AppScreen[] = ['character'];
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
    { key: 'home', label: t('Overview'), glyph: '⌂' },
    { key: 'game', label: t('Adventure'), glyph: '⚔' },
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
