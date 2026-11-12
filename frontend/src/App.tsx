import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  applyTelegramViewport,
  bindTelegramChrome,
  haptic,
  syncTelegramBackButton,
  syncTelegramMainButton,
  teardownTelegramMainButton,
} from './telegramWebApp';
import { linkTelegramAccount, loginWithTelegramInitData } from './telegramAuth';
import {
  clearBrowserSessionToken,
  loginWithPassword,
  readBrowserSessionToken,
  registerBrowserAccount,
  writeBrowserSessionToken,
} from './browserSession';
import { LocaleProvider, useI18n } from './i18n';
import { presentPlayerFacingError } from './i18n/playerFacingErrors';
import {
  clearPendingAction,
  idempotencyKeyForTurn,
  readPendingAction,
  type TurnPhase,
} from './pendingTurn';
import './styles.css';

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
  const presentError = useCallback(
    (message: string) => presentPlayerFacingError(message, locale, t),
    [locale, t],
  );

  useLayoutEffect(() => {
    window.Telegram?.WebApp?.ready?.();
    applyTelegramViewport();
  }, []);

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
  const [authViaBrowser, setAuthViaBrowser] = useState(false);
  const [telegramLinkNotice, setTelegramLinkNotice] = useState<string | null>(null);
  const [telegramLinkBusy, setTelegramLinkBusy] = useState(false);
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
      setError(reason instanceof Error ? `${t('Could not load the saved journal:')} ${presentError(reason.message)}` : t('Could not load the saved journal.'));
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

  useEffect(() => {
    return syncTelegramBackButton(screen, telegramBack);
  }, [screen, telegramBack]);

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

  const bootstrapSession = useCallback(async (token: string, viaBrowser = false) => {
    sessionToken = token;
    setAuthenticated(true);
    setAuthViaBrowser(viaBrowser);

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
  }, []);

  useEffect(() => {
    const telegram = window.Telegram?.WebApp;
    telegram?.ready?.();
    const unbindChrome = bindTelegramChrome();

    const initData = telegram?.initData;
    const browserToken = readBrowserSessionToken();

    void (async () => {
      try {
        if (browserToken) {
          await bootstrapSession(browserToken, true);
        } else if (initData) {
          const token = await loginWithTelegramInitData(initData);
          await bootstrapSession(token, false);
        }
      } catch (reason) {
        setError(reason instanceof Error ? presentError(reason.message) : t('Could not sign in or load your adventure.'));
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      unbindChrome();
      teardownTelegramMainButton();
    };
  }, [bootstrapSession]);

  const [browserUsername, setBrowserUsername] = useState('');
  const [browserPassword, setBrowserPassword] = useState('');
  const [browserBusy, setBrowserBusy] = useState(false);

  const linkTelegramFromSettings = async () => {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData || !sessionToken) {
      setTelegramLinkNotice(t('Open the Mini App from Telegram to confirm your identity.'));
      return;
    }
    setTelegramLinkBusy(true);
    setTelegramLinkNotice(null);
    try {
      await linkTelegramAccount(initData, sessionToken);
      setAuthViaBrowser(false);
      setTelegramLinkNotice(t('Telegram account linked. You can open the same heroes from Telegram or the browser.'));
      haptic('success');
    } catch (reason) {
      setTelegramLinkNotice(reason instanceof Error ? presentError(reason.message) : t('Could not link Telegram.'));
    } finally {
      setTelegramLinkBusy(false);
    }
  };

  const submitBrowserAuth = async (mode: 'login' | 'register') => {
    setBrowserBusy(true);
    setError(null);
    try {
      const token = mode === 'login'
        ? await loginWithPassword(browserUsername.trim(), browserPassword)
        : await registerBrowserAccount(browserUsername.trim(), browserPassword);
      writeBrowserSessionToken(token);
      await bootstrapSession(token, true);
    } catch (reason) {
      setError(reason instanceof Error ? presentError(reason.message) : t('Could not sign in.'));
    } finally {
      setBrowserBusy(false);
    }
  };

  const updateCharacter = (updated: Character) => {
    setCharacter(updated);
    setCharacters(previous => previous.map(item => item.id === updated.id ? updated : item));
  };

  const refreshCharacter = useCallback(async (characterId: string) => {
    const fresh = await request<Character>(`/characters/${characterId}`);
    setCharacter(fresh);
    setCharacters(previous => previous.map(item => (item.id === characterId ? fresh : item)));
  }, []);

  const prevScreenRef = useRef<AppScreen>(screen);
  useEffect(() => {
    const enteredGame = screen === 'game' && prevScreenRef.current !== 'game';
    prevScreenRef.current = screen;
    if (enteredGame && character?.id && !busy) {
      void refreshCharacter(character.id);
    }
  }, [screen, character?.id, busy, refreshCharacter]);

  useEffect(() => {
    const syncFromServer = () => {
      if (document.visibilityState !== 'visible' || screen !== 'game' || !character?.id || busy) return;
      void refreshCharacter(character.id);
    };
    window.addEventListener('pageshow', syncFromServer);
    document.addEventListener('visibilitychange', syncFromServer);
    return () => {
      window.removeEventListener('pageshow', syncFromServer);
      document.removeEventListener('visibilitychange', syncFromServer);
    };
  }, [character?.id, screen, busy, refreshCharacter]);

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
      setError(reason instanceof Error ? presentError(reason.message) : t('Could not revive the hero.'));
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
      setError(reason instanceof Error ? presentError(reason.message) : t('Could not create the character.'));
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
      setError(reason instanceof Error ? presentError(reason.message) : t('Could not create the ready-made hero.'));
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
      const result = formatJournalStreamResult(narration, facts, locale);
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
          const energy = event.data.energy;
          const energyTenths = event.data.energy_tenths;
          if (typeof energy === 'number' && typeof energyTenths === 'number') {
            setEconomy(previous => previous ? {
              ...previous,
              balance: energy,
              balance_tenths: energyTenths,
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
        await refreshCharacter(character.id);
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
          setError(refreshError instanceof Error ? presentError(refreshError.message) : t('Could not load the saved journal.'));
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
          setError(presentError(message));
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
      setError(reason instanceof Error ? presentError(reason.message) : t('Could not update campaign settings.'));
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
      setError(reason instanceof Error ? presentError(reason.message) : t('Could not change the narrator tier.'));
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
    if (!authenticated || !character) return;
    const stored = (character.narration_language || 'en').toLowerCase().split('-')[0];
    if (stored !== locale) {
      void syncNarrationLanguage(locale);
    }
  }, [authenticated, character?.id, character?.narration_language, locale, syncNarrationLanguage]);

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
      setError(reason instanceof Error ? presentError(reason.message) : t('Could not rate the encounter.'));
    } finally {
      setCalculating(false);
    }
  };

  if (loading) return <LoadingScreen message={t('Opening your adventure…')} />;
  if (!authenticated) {
    const inTelegram = Boolean(window.Telegram?.WebApp?.initData);
    return (
      <main className="login-screen">
        <span className="loading-sigil" aria-hidden="true">✦</span>
        <p className="eyebrow">{t('THE WHISPERING CELLAR')}</p>
        <h1>{inTelegram ? t('Your story begins in Telegram') : t('Sign in to continue')}</h1>
        {inTelegram ? (
          <>
            <p>{t('Sign in with your browser account to link Telegram in Settings, or wait for automatic Telegram sign-in.')}</p>
            <form
              className="browser-auth-form"
              onSubmit={event => {
                event.preventDefault();
                void submitBrowserAuth('login');
              }}
            >
              <label>
                {t('Username')}
                <input
                  autoComplete="username"
                  value={browserUsername}
                  onChange={event => setBrowserUsername(event.target.value)}
                />
              </label>
              <label>
                {t('Password')}
                <input
                  type="password"
                  autoComplete="current-password"
                  value={browserPassword}
                  onChange={event => setBrowserPassword(event.target.value)}
                />
              </label>
              <div className="browser-auth-actions">
                <button type="submit" disabled={browserBusy || !browserUsername.trim() || browserPassword.length < 6}>
                  {t('Sign in')}
                </button>
              </div>
            </form>
          </>
        ) : (
          <form
            className="browser-auth-form"
            onSubmit={event => {
              event.preventDefault();
              void submitBrowserAuth('login');
            }}
          >
            <label>
              {t('Username')}
              <input
                autoComplete="username"
                value={browserUsername}
                onChange={event => setBrowserUsername(event.target.value)}
              />
            </label>
            <label>
              {t('Password')}
              <input
                type="password"
                autoComplete="current-password"
                value={browserPassword}
                onChange={event => setBrowserPassword(event.target.value)}
              />
            </label>
            <div className="browser-auth-actions">
              <button type="submit" disabled={browserBusy || !browserUsername.trim() || browserPassword.length < 6}>
                {t('Sign in')}
              </button>
              <button
                type="button"
                disabled={browserBusy || !browserUsername.trim() || browserPassword.length < 6}
                onClick={() => void submitBrowserAuth('register')}
              >
                {t('Create account')}
              </button>
            </div>
            <p>{t('Link Telegram later from the same account once you open the Mini App.')}</p>
          </form>
        )}
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
            events={events}
            questCatalog={catalog?.quests}
            onContinue={() => navigate('game')}
            onCreate={() => navigate('create')}
            onPreset={createPreset}
            onOpenMap={() => navigate('map')}
            onOpenQuests={() => navigate('quests')}
            onOpenJournal={() => navigate('journal')}
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
        {screen === 'more' && (
          <MoreScreen
            onNavigate={navigate}
            hasHero={Boolean(character)}
            onCreateHero={() => navigate('create')}
          />
        )}
        {screen === 'map' && (
          <MapScreen
            character={character}
            locations={catalog?.locations ?? []}
            busy={busy}
            onTravel={action => {
              navigate('game');
              void takeAction(action);
            }}
            onOpenQuests={() => navigate('quests')}
            onOpenJournal={() => navigate('journal')}
            onContinueAdventure={() => navigate('game')}
            questCatalog={catalog?.quests}
          />
        )}
        {screen === 'quests' && (
          <QuestScreen
            character={character}
            questCatalog={catalog?.quests}
            journalEvents={events}
            onOpenJournal={() => navigate('journal')}
            onOpenMap={() => navigate('map')}
            onContinueAdventure={() => navigate('game')}
          />
        )}
        {screen === 'journal' && <JournalScreen events={events} character={character} />}
        {screen === 'character' && (
          <CharacterScreen
            character={character}
            characters={characters}
            spells={spells}
            onSelect={selectCharacter}
            onCreate={() => navigate('create')}
            onOpenTools={() => navigate('tools')}
            busy={busy}
            error={screen === 'character' && error && !busy ? error : undefined}
            onInventoryAction={action => {
              void takeAction(action);
            }}
          />
        )}
        {screen === 'campaign' && (
          <CampaignScreen onOpenSettings={() => navigate('settings')} />
        )}
        {screen === 'tools' && (
          <ToolsScreen
            character={character}
            catalog={catalog!}
            spells={spells}
            calculating={calculating}
            calculation={calculation}
            error={calculating ? null : error}
            busy={busy}
            actionError={screen === 'tools' && error && !busy ? error : undefined}
            onCalculate={calculateEncounter}
            onCastAction={action => {
              void takeAction(action);
            }}
          />
        )}
        {screen === 'settings' && (
          <SettingsScreen
            character={character}
            economy={economy}
            busy={busy}
            error={error}
            onChangeTier={changeTier}
            onLanguageChange={syncNarrationLanguage}
            onUpdateCampaign={updateCampaign}
            onOpenTools={() => navigate('tools')}
            showTelegramLink={authViaBrowser && Boolean(window.Telegram?.WebApp?.initData)}
            telegramLinkBusy={telegramLinkBusy}
            telegramLinkNotice={telegramLinkNotice}
            onLinkTelegram={() => void linkTelegramFromSettings()}
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
