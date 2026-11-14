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
import { ApiError } from './apiErrors';
import {
  type AuthFailureKind,
  type BootstrapOutcome,
  type BootstrapPhase,
  classifyAuthFailure,
  classifyBootstrapFailure,
  isBootstrapLoading,
  resetAppInitForTests,
  runAppInitOnce,
  shouldClearBrowserSession,
  shouldInvalidateSessionToken,
} from './authSession';
import { canGoBackFrom, goBackScreen, navigateScreen } from './navigationHistory';
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
import {
  invalidateTelegramAuthCache,
  linkTelegramAccount,
  loginWithTelegramInitData,
} from './telegramAuth';
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

/** Test-only reset for module session state between Vitest cases. */
export function __resetAppSessionForTests(): void {
  sessionToken = null;
}

export function __readAppSessionTokenForTests(): string | null {
  return sessionToken;
}

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
  const [bootstrapPhase, setBootstrapPhase] = useState<BootstrapPhase>('checking_session');
  const [authFailureKind, setAuthFailureKind] = useState<AuthFailureKind | null>(null);
  const [authViaBrowser, setAuthViaBrowser] = useState(false);
  const authenticated = bootstrapPhase === 'authenticated';
  const [telegramLinkNotice, setTelegramLinkNotice] = useState<string | null>(null);
  const [telegramLinkBusy, setTelegramLinkBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [turnPhase, setTurnPhase] = useState<TurnPhase>('idle');
  const [calculating, setCalculating] = useState(false);
  const [calculation, setCalculation] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRetryableAction, setLastRetryableAction] = useState<string | null>(null);
  const busyRef = useRef(false);
  const characterRef = useRef<Character | null>(null);
  const navStackRef = useRef<AppScreen[]>([]);
  const bootstrapInFlightRef = useRef(false);
  const bootstrapPromiseRef = useRef<Promise<BootstrapOutcome> | null>(null);

  useEffect(() => {
    characterRef.current = character;
  }, [character]);
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
    navStackRef.current = [];
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

  const navigate = useCallback((next: AppScreen) => {
    setScreen(current => {
      const transition = navigateScreen(navStackRef.current, current, next, {
        hasCharacter: Boolean(characterRef.current),
      });
      navStackRef.current = transition.stack;
      return transition.screen;
    });
    setError(null);
  }, []);

  const goBack = useCallback(() => {
    setScreen(current => {
      const transition = goBackScreen(navStackRef.current, current);
      navStackRef.current = transition.stack;
      return transition.screen;
    });
    setError(null);
  }, []);

  const canGoBack = canGoBackFrom(navStackRef.current, screen);

  useEffect(() => {
    return syncTelegramBackButton(goBack, canGoBack);
  }, [screen, goBack, canGoBack]);

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

  const bootstrapSession = useCallback((token: string, viaBrowser = false): Promise<BootstrapOutcome> => {
    if (bootstrapPromiseRef.current) {
      return bootstrapPromiseRef.current;
    }
    bootstrapInFlightRef.current = true;
    const run = async (): Promise<BootstrapOutcome> => {
      sessionToken = token;
      setBootstrapPhase('loading_account');
      setAuthFailureKind(null);
      setError(null);
      try {
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
        } else {
          setCharacter(null);
          setEvents([]);
        }
        setAuthViaBrowser(viaBrowser);
        setBootstrapPhase('authenticated');
        return 'ok';
      } catch (reason) {
        const kind = classifyBootstrapFailure(reason);
        if (viaBrowser && shouldClearBrowserSession(kind)) {
          clearBrowserSessionToken();
        }
        if (shouldInvalidateSessionToken(kind)) {
          sessionToken = null;
          invalidateTelegramAuthCache();
        }
        setAuthFailureKind(kind);
        setBootstrapPhase('auth_error');
        setError(reason instanceof Error ? presentError(reason.message) : t('Could not load your adventure data.'));
        return kind;
      } finally {
        bootstrapInFlightRef.current = false;
        bootstrapPromiseRef.current = null;
      }
    };
    bootstrapPromiseRef.current = run();
    return bootstrapPromiseRef.current;
  }, [presentError, t]);

  const retryTelegramSignIn = useCallback(async () => {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) return;
    setError(null);
    setAuthFailureKind(null);
    setBootstrapPhase('authenticating');
    try {
      invalidateTelegramAuthCache(initData);
      const token = await loginWithTelegramInitData(initData, { forceRefresh: true });
      await bootstrapSession(token, false);
    } catch (reason) {
      setAuthFailureKind('telegram_auth');
      setBootstrapPhase('auth_error');
      setError(reason instanceof Error ? presentError(reason.message) : t('Telegram sign-in failed.'));
    }
  }, [bootstrapSession, presentError, t]);

  const retryBootstrap = useCallback(async () => {
    if (!sessionToken) return;
    const outcome = await bootstrapSession(sessionToken, authViaBrowser);
    if (outcome !== 'ok') return;
  }, [authViaBrowser, bootstrapSession]);

  useEffect(() => {
    const telegram = window.Telegram?.WebApp;
    telegram?.ready?.();
    const unbindChrome = bindTelegramChrome();

    const initData = telegram?.initData;
    const browserToken = readBrowserSessionToken();

    void runAppInitOnce(async () => {
      setBootstrapPhase('checking_session');
      try {
        if (browserToken) {
          const outcome = await bootstrapSession(browserToken, true);
          if (outcome !== 'ok' && outcome === 'session_invalid' && initData) {
            setBootstrapPhase('authenticating');
            invalidateTelegramAuthCache(initData);
            const token = await loginWithTelegramInitData(initData, { forceRefresh: true });
            await bootstrapSession(token, false);
            return;
          }
          if (outcome !== 'ok') return;
          return;
        }
        if (initData) {
          setBootstrapPhase('authenticating');
          const token = await loginWithTelegramInitData(initData);
          await bootstrapSession(token, false);
          return;
        }
        setBootstrapPhase('awaiting_login');
      } catch (reason) {
        setAuthFailureKind(initData ? 'telegram_auth' : classifyAuthFailure(reason));
        setBootstrapPhase('auth_error');
        setError(reason instanceof Error ? presentError(reason.message) : t('Could not sign in or load your adventure.'));
      }
    });

    return () => {
      unbindChrome();
      teardownTelegramMainButton();
    };
  }, [bootstrapSession, presentError, t]);

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
    if (browserBusy || bootstrapInFlightRef.current) return;
    setBrowserBusy(true);
    setError(null);
    setAuthFailureKind(null);
    try {
      setBootstrapPhase('authenticating');
      const token = mode === 'login'
        ? await loginWithPassword(browserUsername.trim(), browserPassword)
        : await registerBrowserAccount(browserUsername.trim(), browserPassword);
      writeBrowserSessionToken(token);
      const outcome = await bootstrapSession(token, true);
      if (outcome !== 'ok') {
        setAuthFailureKind(outcome === 'bootstrap' ? 'browser_auth' : outcome);
      }
    } catch (reason) {
      setAuthFailureKind('browser_auth');
      setBootstrapPhase('auth_error');
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
      characterRef.current = created;
      setCharacter(created);
      localStorage.setItem(ACTIVE_CHARACTER_KEY, created.id);
      setEvents([]);
      navStackRef.current = [];
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
      characterRef.current = created;
      setCharacter(created);
      localStorage.setItem(ACTIVE_CHARACTER_KEY, created.id);
      setEvents([]);
      navStackRef.current = [];
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
        if (reason instanceof ApiError && reason.status === 402) navigate('settings');
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
    if (localStorage.getItem('app_locale')) return;
    const tgLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code?.toLowerCase();
    if (tgLang?.startsWith('cs') || tgLang?.startsWith('sk')) {
      setLocale('cs');
    }
  }, [setLocale]);

  useEffect(() => {
    if (!character || localStorage.getItem('app_locale')) return;
    const fromChar = (character.narration_language || '').toLowerCase().split('-')[0];
    if (fromChar === 'cs' || fromChar === 'en') setLocale(fromChar);
  }, [character?.id, character?.narration_language, setLocale]);

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

  const loadingMessage =
    bootstrapPhase === 'checking_session'
      ? t('Checking your session…')
      : bootstrapPhase === 'authenticating'
        ? t('Signing you in…')
        : t('Opening your adventure…');

  if (isBootstrapLoading(bootstrapPhase)) {
    return <LoadingScreen message={loadingMessage} />;
  }

  if (!authenticated) {
    const inTelegram = Boolean(window.Telegram?.WebApp?.initData);
    const telegramFailed = authFailureKind === 'telegram_auth' || authFailureKind === 'session_invalid';
    const showTelegramRetry = inTelegram && bootstrapPhase === 'auth_error' && telegramFailed;
    const authBusy = browserBusy || isBootstrapLoading(bootstrapPhase);
    const authErrorMessage =
      authFailureKind === 'network'
        ? t('A network error stopped sign-in. Check your connection and try again.')
        : authFailureKind === 'server'
          ? t('The server is temporarily unavailable. Try again in a moment.')
          : authFailureKind === 'session_invalid'
            ? t('Your saved session expired. Sign in again.')
            : authFailureKind === 'telegram_auth'
              ? t('Telegram sign-in failed. Retry below or use a browser account.')
              : authFailureKind === 'bootstrap'
                ? t('Your account loaded but game data failed. Try again.')
                : null;
    return (
      <main className="login-screen">
        <span className="loading-sigil" aria-hidden="true">✦</span>
        <p className="eyebrow">{t('THE WHISPERING CELLAR')}</p>
        <h1>{inTelegram ? t('Your story begins in Telegram') : t('Sign in to continue')}</h1>
        {sessionToken && bootstrapPhase === 'auth_error' && (authFailureKind === 'bootstrap' || authFailureKind === 'server' || authFailureKind === 'network') && (
          <div className="browser-auth-actions">
            <button type="button" className="primary" disabled={authBusy} onClick={() => void retryBootstrap()}>
              {t('Retry loading adventure data')}
            </button>
          </div>
        )}
        {inTelegram ? (
          <>
            <p>
              {showTelegramRetry
                ? t('Telegram is the preferred sign-in inside the Mini App. You can retry or use a browser account below.')
                : t('Telegram sign-in is recommended here. You can also use a browser account and link Telegram in Settings.')}
            </p>
            {showTelegramRetry && (
              <div className="browser-auth-actions">
                <button
                  type="button"
                  className="primary auth-retry-telegram"
                  disabled={authBusy}
                  onClick={() => void retryTelegramSignIn()}
                >
                  {t('Retry Telegram sign-in')}
                </button>
              </div>
            )}
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
                <button type="submit" disabled={authBusy || !browserUsername.trim() || browserPassword.length < 6}>
                  {authBusy ? t('Signing you in…') : t('Sign in with browser account')}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <p>{t('Sign in with your username and password. Link Telegram later from Settings when you open the Mini App.')}</p>
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
                <button type="submit" disabled={authBusy || !browserUsername.trim() || browserPassword.length < 6}>
                  {authBusy ? t('Signing you in…') : t('Sign in')}
                </button>
                <button
                  type="button"
                  disabled={authBusy || !browserUsername.trim() || browserPassword.length < 6}
                  onClick={() => void submitBrowserAuth('register')}
                >
                  {t('Create account')}
                </button>
              </div>
            </form>
          </>
        )}
        {(authErrorMessage || error) && (
          <p className="error" role="alert">{authErrorMessage ?? error}</p>
        )}
      </main>
    );
  }
  if (!catalog) {
    return (
      <main className="login-screen">
        <h1>{t('The reference library could not be loaded.')}</h1>
        <p role="alert">{error ?? t('Your account loaded but game data failed. Try again.')}</p>
        <div className="browser-auth-actions">
          <button type="button" className="primary" disabled={bootstrapInFlightRef.current} onClick={() => void retryBootstrap()}>
            {t('Retry loading adventure data')}
          </button>
        </div>
      </main>
    );
  }

  const accountAuth: 'telegram' | 'browser' | 'browser_pending_telegram' =
    authViaBrowser
      ? Boolean(window.Telegram?.WebApp?.initData)
        ? 'browser_pending_telegram'
        : 'browser'
      : 'telegram';

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
            onOpenQuests={() => navigate('quests')}
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
            maxLevel={catalog?.ruleset?.max_level ?? 3}
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
            accountAuth={accountAuth}
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
