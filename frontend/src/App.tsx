import { useCallback, useEffect, useState } from 'react';
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
import { MORE_HUB_SCREENS } from './types';
import { applyTelegramTheme, haptic, syncTelegramBackButton } from './telegramWebApp';
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
  const { t } = useI18n();
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

  const refreshEvents = useCallback(async (characterId: string) => {
    const history = await request<JournalEvent[]>(`/characters/${characterId}/events`);
    setEvents(history);
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
    if (MORE_HUB_SCREENS.includes(screen) && screen !== 'more') {
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
    const telegram = window.Telegram?.WebApp;
    telegram?.ready?.();
    telegram?.expand?.();
    applyTelegramTheme();

    const initData = telegram?.initData;
    if (!initData) {
      setError('Open this app from Telegram to sign in.');
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const token = await request<{ access_token: string }>('/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ init_data: initData }),
        });
        if (!token.access_token) throw new Error('Invalid authentication response from server.');
        sessionToken = token.access_token;
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
      sessionToken = null;
    };
  }, []);

  const updateCharacter = (updated: Character) => {
    setCharacter(updated);
    setCharacters(previous => previous.map(item => item.id === updated.id ? updated : item));
  };

  const createCharacter = async (draft: CharacterDraft) => {
    setBusy(true);
    setError(null);
    try {
      const created = await request<Character>('/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
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
      const created = await request<Character>(`/characters/presets/${key}`, { method: 'POST' });
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
    if (!character || busy) return;
    setBusy(true);
    setError(null);
    const pendingEventId = -Date.now();
    let committed = false;
    let streamCompleted = false;
    let streamedNarration = '';
    let resolvedFacts: string[] = [];
    setTurnPhase('sending');
    const updatePendingNarration = (narration: string, facts: string[]) => {
      setEvents(previous => previous.map(event => event.id === pendingEventId
        ? { ...event, result: [narration, facts.join('\n')].filter(Boolean).join('\n\n') }
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
          updateCharacter(result.character);
          setEconomy(previous => previous ? { ...previous, balance: result.energy, balance_tenths: result.energy_tenths, tier: result.tier } : previous);
          setEvents(previous => [...previous, {
            id: pendingEventId,
            action,
            result: result.events.join('\n'),
            created_at: new Date().toISOString(),
          }]);
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
        setError(message);
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

  const syncNarrationLanguage = async (language: 'en' | 'cs') => {
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
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <button type="button" className="brand-mark" onClick={() => navigate('home')} aria-label={t('Go to home')}>
          <span className="brand-sigil">✦</span><span>A.U.R.I.O.N.<small>{t('ADVENTURE COMPANION')}</small></span>
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
        {screen === 'game' && character && (
          <GameScreen
            character={character}
            events={events}
            spells={spells}
            locations={catalog?.locations ?? []}
            busy={busy}
            turnPhase={turnPhase}
            error={error}
            narrationStatus={narrationStatus}
            onAction={takeAction}
            onResumePending={resumePendingTurn}
            onOpenSheet={() => navigate('character')}
            onOpenMap={() => navigate('map')}
          />
        )}
        {screen === 'more' && <MoreScreen onNavigate={navigate} />}
        {screen === 'map' && <MapScreen character={character} locations={catalog?.locations ?? []} onTravel={action => { navigate('game'); void takeAction(action); }} />}
        {screen === 'quests' && <QuestScreen character={character} />}
        {screen === 'journal' && <JournalScreen events={events} />}
        {screen === 'character' && <CharacterScreen character={character} characters={characters} onSelect={selectCharacter} onCreate={() => navigate('create')} />}
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
    </div>
  );
}

export default App;
