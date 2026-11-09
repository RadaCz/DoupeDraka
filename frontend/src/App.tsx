import { useCallback, useEffect, useRef, useState } from 'react';
import { CharacterWizard, type CharacterDraft } from './CharacterWizard';
import {
  BottomNav,
  CampaignScreen,
  CharacterScreen,
  GameScreen,
  HomeScreen,
  JournalScreen,
  MapScreen,
  MoreScreen,
  QuestScreen,
  SettingsScreen,
  ToolsScreen,
} from './GameScreens';
import type {
  AppScreen,
  Character,
  Economy,
  HeroPreset,
  JournalEvent,
  ReferenceCatalog,
  Spell,
} from './types';
import { CHARACTER_HUB_SCREENS, MORE_HUB_SCREENS } from './types';
import { isFallenError } from './game/gameActions';
import { formatTurnDelta } from './game/turnDelta';
import { formatJournalStreamResult, mergeJournalAfterRefresh } from './journalFormat';
import { DefeatOverlay, LevelUpModal, type LevelUpNotice } from './components/TurnMoments';
import { isCombatDefeatRespawn, noticeFromLevelUp } from './game/turnMoments';
import { FallenScreen } from './screens/FallenScreen';
import {
  bindTelegramChrome,
  haptic,
  syncTelegramBackButton,
  syncTelegramMainButton,
  teardownTelegramMainButton,
} from './telegramWebApp';
import { loginWithTelegramInitData } from './telegramAuth';
import { LocaleProvider, useI18n } from './i18n';
import {
  clearPendingAction,
  idempotencyKeyForTurn,
  readPendingAction,
  type TurnPhase,
} from './pendingTurn';
import './styles.css';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: { user?: { first_name?: string } };
        ready?: () => void;
        expand?: () => void;
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
        themeParams?: {
          bg_color?: string;
          secondary_bg_color?: string;
          text_color?: string;
          hint_color?: string;
          button_color?: string;
        };
        BackButton?: {
          show: () => void;
          hide: () => void;
          onClick: (handler: () => void) => void;
          offClick: (handler: () => void) => void;
        };
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
        };
        MainButton?: {
          setText: (text: string) => void;
          color: (color: string) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          onClick: (handler: () => void) => void;
          offClick: (handler: () => void) => void;
        };
        onEvent?: (event: string, handler: () => void) => void;
        offEvent?: (event: string, handler: () => void) => void;
      };
    };
  }
}

const API_URL = import.meta.env.VITE_API_URL || '/api';
const ACTIVE_CHARACTER_KEY = 'active_character_id';
let sessionToken: string | null = null;

interface ActionResponse {
  events: string[];
  narration: string;
  narration_status?: 'narrated' | 'fallback';
  character: Character;
  energy: number;
  energy_tenths: number;
  tier: string;
  level_up_facts?: { new_level?: number; hp_gained?: number } | null;
}

interface StreamActionEvent {
  type: 'turn' | 'delta' | 'replace' | 'complete';
  data: Record<string, unknown>;
}

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (sessionToken) headers.set('Authorization', `Bearer ${sessionToken}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string') {
        message = body.detail;
      }
    } catch {
      // Keep the HTTP status when the server does not return JSON.
    }
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

async function streamRequest(
  path: string,
  init: RequestInit,
  onEvent: (event: StreamActionEvent) => void,
): Promise<void> {
  const headers = new Headers(init.headers);
  if (sessionToken) headers.set('Authorization', `Bearer ${sessionToken}`);
  headers.set('Accept', 'text/event-stream');
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string') {
        message = body.detail;
      }
    } catch {
      // Keep the HTTP status when the server does not return JSON.
    }
    throw new ApiError(message, response.status);
  }
  if (!response.body) throw new Error('The streaming response has no readable body.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  const consume = (frame: string) => {
    let type = '';
    let data = '';
    for (const line of frame.split(/\r?\n/)) {
      if (line.startsWith('event:')) type = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (type && data) onEvent({ type: type as StreamActionEvent['type'], data: JSON.parse(data) as Record<string, unknown> });
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const frames = pending.split(/\r?\n\r?\n/);
      pending = frames.pop() ?? '';
      frames.forEach(consume);
      if (done) break;
    }
    if (pending.trim()) consume(pending);
  } finally {
    reader.releaseLock();
  }
}

function LoadingScreen({ message }: { message: string }) {
  const { t } = useI18n();
  return (
    <main className="loading-screen" role="status">
      <span className="loading-sigil" aria-hidden="true">✦</span>
      <p className="eyebrow">{t('THE WHISPERING CELLAR')}</p>
      <h1>{message}</h1>
      <div className="loading-dots"><i /><i /><i /></div>
    </main>
  );
}

function App() {
  return <LocaleProvider><AppContent /></LocaleProvider>;
}

function AppContent() {
  const { t, locale, setLocale } = useI18n();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [character, setCharacter] = useState<Character | null>(null);
  const [presets, setPresets] = useState<HeroPreset[]>([]);
  const [catalog, setCatalog] = useState<ReferenceCatalog | null>(null);
  const [spells, setSpells] = useState<Spell[]>([]);
  const [economy, setEconomy] = useState<Economy | null>(null);
  const [events, setEvents] = useState<JournalEvent[]>([]);
  const [narrationStatus, setNarrationStatus] = useState<'narrated' | 'fallback' | null>(null);
  const [screen, setScreen] = useState<AppScreen>('home');
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [turnPhase, setTurnPhase] = useState<TurnPhase>('idle');
  const [calculating, setCalculating] = useState(false);
  const [calculation, setCalculation] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRetryableAction, setLastRetryableAction] = useState<string | null>(null);
  const busyRef = useRef(false);
  const [turnDelta, setTurnDelta] = useState<string | null>(null);
  const [levelUpNotice, setLevelUpNotice] = useState<LevelUpNotice | null>(null);
  const [showDefeatOverlay, setShowDefeatOverlay] = useState(false);

  const refreshEvents = useCallback(async (characterId: string) => {
    const history = await request<JournalEvent[]>(`/characters/${characterId}/events`);
    setEvents(previous => mergeJournalAfterRefresh(history, previous));
  }, []);

  const selectCharacter = useCallback(async (selected: Character) => {
    setCharacter(selected);
    setEvents([]);
    localStorage.setItem(ACTIVE_CHARACTER_KEY, selected.id);
    setScreen('home');
    setError(null);
    try {
      await refreshEvents(selected.id);
    } catch (reason) {
      setError(reason instanceof Error ? `${t('Could not load the saved journal:')} ${reason.message}` : t('Could not load the saved journal.'));
    }
  }, [refreshEvents]);

  useEffect(() => {
    if (!character) return;
    const pending = readPendingAction();
    if (pending?.characterId === character.id) {
      setTurnPhase('recovering');
    }
  }, [character?.id]);

  const telegramBack = useCallback(() => {
    if (CHARACTER_HUB_SCREENS.includes(screen) && screen !== 'character') {
      setScreen('character');
    } else if (MORE_HUB_SCREENS.includes(screen) && screen !== 'more') {
      setScreen('more');
    } else if (screen === 'create') {
      setScreen('home');
    } else {
      setScreen('game');
    }
    setError(null);
  }, [screen]);

  useEffect(() => syncTelegramBackButton(screen, telegramBack), [screen, telegramBack]);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    if (screen !== 'game' || !character || character.hp <= 0) {
      teardownTelegramMainButton();
      return;
    }
    const input = document.getElementById('adventure-action-input') as HTMLInputElement | null;
    const readDraft = () => input?.value ?? '';
    const sendDraft = () => {
      const text = readDraft().trim();
      if (text && !busyRef.current) void takeAction(text);
    };
    const paint = () => syncTelegramMainButton(readDraft, sendDraft, !busyRef.current);
    paint();
    input?.addEventListener('input', paint);
    return () => {
      input?.removeEventListener('input', paint);
      teardownTelegramMainButton();
    };
  }, [screen, character?.id, character?.hp, busy]);

  useEffect(() => {
    const telegram = window.Telegram?.WebApp;
    telegram?.ready?.();
    const unbindChrome = bindTelegramChrome();

    const initData = telegram?.initData;
    if (!initData) {
      setError('Open this app from Telegram to sign in.');
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        sessionToken = await loginWithTelegramInitData(initData);
        setAuthenticated(true);

        const [characterList, presetList, referenceData, economyData, spellList] = await Promise.all([
          request<Character[]>('/characters'),
          request<HeroPreset[]>('/characters/presets'),
          request<ReferenceCatalog>('/reference'),
          request<Economy>('/economy'),
          request<Spell[]>('/reference/spells'),
        ]);
        setCharacters(characterList);
        setPresets(presetList);
        setCatalog(referenceData);
        setEconomy(economyData);
        setSpells(spellList);
        const storedId = localStorage.getItem(ACTIVE_CHARACTER_KEY);
        const active = characterList.find(item => item.id === storedId) ?? characterList[0] ?? null;
        if (active) {
          setCharacter(active);
          localStorage.setItem(ACTIVE_CHARACTER_KEY, active.id);
          setEvents(await request<JournalEvent[]>(`/characters/${active.id}/events`));
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : t('Could not sign in or load your adventure.'));
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      unbindChrome();
      teardownTelegramMainButton();
    };
  }, []);

  const updateCharacter = (updated: Character) => {
    setCharacter(updated);
    setCharacters(previous => previous.map(item => item.id === updated.id ? updated : item));
  };

  const refreshCharacter = async (characterId: string) => {
    const list = await request<Character[]>('/characters');
    setCharacters(list);
    const fresh = list.find(item => item.id === characterId);
    if (fresh) setCharacter(fresh);
  };

  const reviveCharacter = async () => {
    if (!character || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await request<{ character: Character; gold_lost: number }>(`/characters/${character.id}/revive`, { method: 'POST' });
      updateCharacter(result.character);
      setTurnDelta(null);
      await refreshEvents(character.id);
      haptic('success');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('Could not revive the hero.'));
    } finally {
      setBusy(false);
    }
  };

  const createCharacter = async (draft: CharacterDraft) => {
    setBusy(true);
    setError(null);
    try {
      const created = await request<Character>('/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          language: locale === 'cs' ? 'cs' : 'en',
        }),
      });
      setCharacters(previous => [...previous, created]);
      setCharacter(created);
      localStorage.setItem(ACTIVE_CHARACTER_KEY, created.id);
      setEvents([]);
      setScreen('game');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('Could not create the character.'));
    } finally {
      setBusy(false);
    }
  };

  const createPreset = async (key: string) => {
    setBusy(true);
    setError(null);
    try {
      const lang = locale === 'cs' ? 'cs' : 'en';
      const created = await request<Character>(
        `/characters/presets/${key}${lang === 'cs' ? '?language=cs' : ''}`,
        { method: 'POST' },
      );
      setCharacters(previous => [...previous, created]);
      setCharacter(created);
      localStorage.setItem(ACTIVE_CHARACTER_KEY, created.id);
      setEvents([]);
      setScreen('game');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('Could not create the ready-made hero.'));
    } finally {
      setBusy(false);
    }
  };

  const takeAction = async (action: string) => {
    if (!character || busy || character.hp <= 0) return;
    setBusy(true);
    setError(null);
    setLastRetryableAction(null);
    setTurnDelta(null);
    const snapshot = character;
    const pendingEventId = -Date.now();
    let committed = false;
    let streamCompleted = false;
    let streamedNarration = '';
    let resolvedFacts: string[] = [];
    let pendingLevelUp: LevelUpNotice | null = null;
    let pendingDefeatOverlay = false;
    setTurnPhase('sending');
    setLevelUpNotice(null);
    setShowDefeatOverlay(false);
    const updatePendingNarration = (narration: string, facts: string[]) => {
      const result = formatJournalStreamResult(narration, facts);
      setEvents(previous => previous.map(event => event.id === pendingEventId
        ? { ...event, result }
        : event));
    };
    try {
      const idempotencyKey = idempotencyKeyForTurn(character.id, action);
      await streamRequest(`/characters/${character.id}/actions/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ action }),
      }, event => {
        if (event.type === 'turn') {
          committed = true;
          setTurnPhase('resolved');
          const result = event.data as unknown as ActionResponse;
          resolvedFacts = result.events;
          const delta = formatTurnDelta(snapshot, result.character);
          if (delta) setTurnDelta(delta);
          if (isCombatDefeatRespawn(result.events)) {
            pendingDefeatOverlay = true;
          }
          const levelNotice = noticeFromLevelUp(snapshot, result.character, result.level_up_facts);
          if (levelNotice) pendingLevelUp = levelNotice;
          updateCharacter(result.character);
          const narrationBlob = `${result.events.join('\n')} ${streamedNarration}`;
          if (/critical hit|misses|miss\b/i.test(narrationBlob)) {
            haptic(/miss/i.test(narrationBlob) ? 'warning' : 'heavy');
          }
          setEconomy(previous => previous ? { ...previous, balance: result.energy, balance_tenths: result.energy_tenths, tier: result.tier } : previous);
          setEvents(previous => [...previous, {
            id: pendingEventId,
            action,
            result: '',
            created_at: new Date().toISOString(),
          }]);
          updatePendingNarration(streamedNarration, resolvedFacts);
        } else if (event.type === 'delta' && typeof event.data.text === 'string') {
          setTurnPhase('narrating');
          streamedNarration += event.data.text;
          updatePendingNarration(streamedNarration, resolvedFacts);
        } else if (event.type === 'replace' && typeof event.data.narration === 'string') {
          streamedNarration = event.data.narration;
          updatePendingNarration(streamedNarration, resolvedFacts);
        } else if (event.type === 'complete') {
          streamCompleted = true;
          if (typeof event.data.narration === 'string') streamedNarration = event.data.narration;
          updatePendingNarration(streamedNarration, resolvedFacts);
          setNarrationStatus(event.data.narration_status === 'narrated' ? 'narrated' : 'fallback');
          if (typeof event.data.energy === 'number' && typeof event.data.energy_tenths === 'number') {
            setEconomy(previous => previous ? {
              ...previous,
              balance: event.data.energy,
              balance_tenths: event.data.energy_tenths,
            } : previous);
          }
          if (pendingDefeatOverlay) setShowDefeatOverlay(true);
          if (pendingLevelUp) setLevelUpNotice(pendingLevelUp);
          haptic('success');
          clearPendingAction();
          setTurnPhase('idle');
        }
      });
      await refreshEvents(character.id);
      if (streamCompleted) {
        clearPendingAction();
        setTurnPhase('idle');
      }
    } catch (reason) {
      if (committed) {
        setTurnPhase('recovering');
        setNarrationStatus('fallback');
        try {
          await refreshEvents(character.id);
          clearPendingAction();
          setTurnPhase('idle');
        } catch (refreshError) {
          setError(refreshError instanceof Error ? refreshError.message : t('Could not load the saved journal.'));
        }
      } else {
        setTurnPhase(readPendingAction() ? 'recovering' : 'idle');
        setEvents(previous => previous.filter(event => event.id !== pendingEventId));
        const message = reason instanceof Error ? reason.message : t('The turn could not be completed.');
        if (reason instanceof ApiError && reason.status === 402) setScreen('settings');
        if (reason instanceof ApiError && reason.status === 409 && isFallenError(message)) {
          setError(null);
          try {
            await refreshCharacter(character.id);
          } catch {
            updateCharacter({ ...character, hp: 0, in_combat: false, combatant: null });
          }
        } else {
          setError(message);
          setLastRetryableAction(action);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const resumePendingTurn = () => {
    const pending = readPendingAction();
    if (!pending || !character || pending.characterId !== character.id || busy) return;
    void takeAction(pending.action);
  };

  const updateCampaign = async (settings: Record<string, string | boolean>) => {
    if (!character || busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await request<Character>(`/characters/${character.id}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      updateCharacter(updated);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('Could not update campaign settings.'));
    } finally {
      setBusy(false);
    }
  };

  const changeTier = async (tier: string) => {
    setBusy(true);
    setError(null);
    try {
      await request(`/economy/tier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      setEconomy(previous => previous ? { ...previous, tier } : previous);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('Could not change the narrator tier.'));
    } finally {
      setBusy(false);
    }
  };

  const syncNarrationLanguage = useCallback(async (language: 'en' | 'cs') => {
    if (!character) return;
    try {
      const updated = await request<Character>(`/characters/${character.id}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      });
      updateCharacter(updated);
    } catch {
      // UI locale still updates even if the character patch fails.
    }
  }, [character]);

  useEffect(() => {
    const tgLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
    if (tgLang === 'cs' && localStorage.getItem('app_locale') !== 'en') {
      setLocale('cs');
    }
  }, [setLocale]);

  const calculateEncounter = async (level: number, monsters: string[]) => {
    setCalculating(true);
    setCalculation(null);
    setError(null);
    try {
      const result = await request<Record<string, unknown>>('/tools/combat-calculator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ party_levels: [level], monsters }),
      });
      setCalculation(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('Could not rate the encounter.'));
    } finally {
      setCalculating(false);
    }
  };

  if (loading) return <LoadingScreen message={t('Opening your adventure…')} />;
  if (!authenticated) {
    return (
      <main className="login-screen">
        <span className="loading-sigil" aria-hidden="true">✦</span>
        <p className="eyebrow">{t('THE WHISPERING CELLAR')}</p>
        <h1>{t('Your story begins in Telegram')}</h1>
        <p>{t('Open this Mini App from your bot to sign in and continue your adventure.')}</p>
        {error && <p className="error" role="alert">{error}</p>}
      </main>
    );
  }
  if (!catalog) {
    return <main className="login-screen"><h1>{t('The reference library could not be loaded.')}</h1><p role="alert">{error}</p></main>;
  }

  const navigate = (next: AppScreen) => {
    if (next === 'game' && !character) {
      setScreen('home');
    } else {
      setScreen(next);
    }
    setError(null);
  };

  return (
    <div className={`app-shell${screen === 'game' ? ' play-active' : ''}`}>
      <header className="app-header">
        <button type="button" className="brand-mark" onClick={() => navigate('home')} aria-label={t('Go to home')}>
          <span className="brand-sigil">✦</span><span>Doupě Draka<small>{t('ADVENTURE COMPANION')}</small></span>
        </button>
        {character && <div className="header-balance"><span>✧</span>{economy ? economy.balance.toFixed(1) : '—'} <small>⚡</small></div>}
      </header>

      <main className="main-content" key={screen}>
        {screen === 'home' && (
          <HomeScreen
            character={character}
            characters={characters}
            presets={presets}
            economy={economy}
            onContinue={() => navigate('game')}
            onCreate={() => navigate('create')}
            onPreset={createPreset}
            onSelect={selectCharacter}
            onOpenMap={() => navigate('map')}
            onOpenQuests={() => navigate('quests')}
          />
        )}
        {screen === 'create' && <CharacterWizard catalog={catalog} presets={presets} busy={busy} error={error} onCreate={createCharacter} onPreset={createPreset} onCancel={() => navigate('home')} />}
        {screen === 'game' && character && character.hp <= 0 && (
          <FallenScreen
            character={character}
            busy={busy}
            onRevive={reviveCharacter}
            onGoHub={() => navigate('home')}
          />
        )}
        {screen === 'game' && character && character.hp > 0 && (
          <GameScreen
            character={character}
            economy={economy}
            events={events}
            spells={spells}
            locations={catalog?.locations ?? []}
            busy={busy}
            turnPhase={turnPhase}
            error={error}
            turnDelta={turnDelta}
            narrationStatus={narrationStatus}
            onAction={takeAction}
            onResumePending={resumePendingTurn}
            onOpenSheet={() => navigate('character')}
            onOpenMap={() => navigate('map')}
            onOpenSettings={() => navigate('settings')}
            onRetryError={
              lastRetryableAction
                ? () => { if (!busy) void takeAction(lastRetryableAction); }
                : undefined
            }
          />
        )}
        {screen === 'more' && <MoreScreen onNavigate={navigate} />}
        {screen === 'map' && <MapScreen character={character} locations={catalog?.locations ?? []} onTravel={action => { navigate('game'); void takeAction(action); }} />}
        {screen === 'quests' && <QuestScreen character={character} questCatalog={catalog?.quests} />}
        {screen === 'journal' && <JournalScreen events={events} character={character} />}
        {screen === 'character' && (
          <CharacterScreen
            character={character}
            characters={characters}
            spells={spells}
            questCatalog={catalog?.quests}
            onSelect={selectCharacter}
            onCreate={() => navigate('create')}
            onOpenMap={() => navigate('map')}
            busy={busy}
            onInventoryAction={action => {
              navigate('game');
              void takeAction(action);
            }}
          />
        )}
        {screen === 'campaign' && <CampaignScreen character={character} events={events} busy={busy} onUpdate={updateCampaign} />}
        {screen === 'tools' && <ToolsScreen character={character} catalog={catalog} spells={spells} calculating={calculating} calculation={calculation} error={error} onCalculate={calculateEncounter} />}
        {screen === 'settings' && (
          <SettingsScreen
            economy={economy}
            busy={busy}
            error={error}
            onChangeTier={changeTier}
            onLanguageChange={syncNarrationLanguage}
            onOpenCampaign={() => navigate('campaign')}
            onOpenTools={() => navigate('tools')}
          />
        )}
        {screen === 'game' && !character && <div className="empty-screen"><p role="alert">{t('Choose or create an adventurer before beginning the story.')}</p><button className="primary" onClick={() => navigate('home')}>{t('Back to home')}</button></div>}
      </main>

      {character && screen !== 'create' && (
        <BottomNav screen={screen} onNavigate={navigate} />
      )}

      {levelUpNotice && character && (
        <LevelUpModal
          notice={levelUpNotice}
          character={character}
          onDismiss={() => setLevelUpNotice(null)}
        />
      )}
      {showDefeatOverlay && (
        <DefeatOverlay onDismiss={() => setShowDefeatOverlay(false)} />
      )}
    </div>
  );
}

export default App;
