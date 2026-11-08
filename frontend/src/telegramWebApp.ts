import type { AppScreen } from './types';
import { MORE_HUB_SCREENS } from './types';

const PRIMARY_TABS: AppScreen[] = ['home', 'game', 'character', 'more'];

type MainButtonApi = {
  setText?: (text: string) => void;
  color?: (color: string) => void;
  show?: () => void;
  hide?: () => void;
  enable?: () => void;
  onClick?: (handler: () => void) => void;
  offClick?: (handler: () => void) => void;
};

type TelegramChrome = {
  onEvent?: (event: string, handler: () => void) => void;
  offEvent?: (event: string, handler: () => void) => void;
  expand?: () => void;
  themeParams?: Record<string, string | undefined>;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  contentSafeAreaInset?: { top?: number; bottom?: number };
  safeAreaInset?: { top?: number; bottom?: number };
};

const mainButtonState = {
  getDraft: () => '',
  onSend: () => {},
  active: false,
};

let mainButtonHandler: (() => void) | null = null;
let mainButtonRegistered = false;

function telegramChrome(): TelegramChrome | undefined {
  return window.Telegram?.WebApp as TelegramChrome | undefined;
}

function mainButtonApi(): MainButtonApi | undefined {
  return window.Telegram?.WebApp?.MainButton as MainButtonApi | undefined;
}

function ensureMainButtonHandler(btn: MainButtonApi) {
  if (mainButtonRegistered && mainButtonHandler) return;
  mainButtonHandler = () => {
    if (!mainButtonState.active) return;
    const text = mainButtonState.getDraft().trim();
    if (!text) return;
    mainButtonState.onSend();
  };
  btn.onClick?.(mainButtonHandler);
  mainButtonRegistered = true;
}

export function syncTelegramMainButton(
  getDraft: () => string,
  onSend: () => void,
  active: boolean,
) {
  mainButtonState.getDraft = getDraft;
  mainButtonState.onSend = onSend;
  mainButtonState.active = active;

  const btn = mainButtonApi();
  if (!btn) return;

  const text = getDraft().trim();
  const show = active && text.length > 0;
  if (show) {
    btn.setText?.('Send');
    btn.color?.('#2d6b3a');
    btn.show?.();
    btn.enable?.();
  } else {
    btn.hide?.();
  }
  ensureMainButtonHandler(btn);
}

export function teardownTelegramMainButton() {
  const btn = mainButtonApi();
  if (btn && mainButtonHandler) {
    btn.offClick?.(mainButtonHandler);
  }
  mainButtonHandler = null;
  mainButtonRegistered = false;
  mainButtonState.getDraft = () => '';
  mainButtonState.onSend = () => {};
  mainButtonState.active = false;
  btn?.hide?.();
}

export function applyTelegramViewport() {
  const tg = telegramChrome();
  if (!tg) return;
  tg.expand?.();
  const root = document.documentElement;
  const inset = tg.contentSafeAreaInset ?? tg.safeAreaInset;
  if (inset) {
    root.style.setProperty('--tg-safe-top', `${inset.top ?? 0}px`);
    root.style.setProperty('--tg-safe-bottom', `${inset.bottom ?? 0}px`);
  }
}

export function applyTelegramTheme() {
  const tg = telegramChrome();
  if (!tg) return;
  const params = tg.themeParams;
  const root = document.documentElement;
  const fallbackBg = '#101611';
  const bg = params?.bg_color ?? fallbackBg;
  const secondary = params?.secondary_bg_color ?? '#161d18';
  const text = params?.text_color ?? '#d8e6d8';
  const hint = params?.hint_color ?? '#8fa893';
  const button = params?.button_color ?? '#2d6b3a';
  root.style.setProperty('--tg-bg', bg);
  root.style.setProperty('--tg-surface', secondary);
  root.style.setProperty('--tg-text', text);
  root.style.setProperty('--tg-hint', hint);
  root.style.setProperty('--tg-button', button);
  root.classList.add('telegram-themed');
  tg.setHeaderColor?.(bg);
  tg.setBackgroundColor?.(bg);
}

let themeChangedHandler: (() => void) | null = null;
let viewportChangedHandler: (() => void) | null = null;
let chromeListenersBound = false;

/** Subscribe to Telegram theme and viewport changes; safe in browser (no-op without WebApp). */
export function bindTelegramChrome(): () => void {
  const tg = telegramChrome();
  if (!tg?.onEvent) {
    applyTelegramTheme();
    applyTelegramViewport();
    return () => {};
  }
  if (!chromeListenersBound) {
    themeChangedHandler = () => applyTelegramTheme();
    viewportChangedHandler = () => applyTelegramViewport();
    tg.onEvent('themeChanged', themeChangedHandler);
    tg.onEvent('viewportChanged', viewportChangedHandler);
    chromeListenersBound = true;
  }
  applyTelegramTheme();
  applyTelegramViewport();
  return () => {
    if (themeChangedHandler) tg.offEvent?.('themeChanged', themeChangedHandler);
    if (viewportChangedHandler) tg.offEvent?.('viewportChanged', viewportChangedHandler);
    themeChangedHandler = null;
    viewportChangedHandler = null;
    chromeListenersBound = false;
  };
}

export function haptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light') {
  const impact = window.Telegram?.WebApp?.HapticFeedback?.impactOccurred;
  const notify = window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred;
  if (type === 'success' || type === 'warning' || type === 'error') {
    notify?.(type);
    return;
  }
  impact?.(type);
}

export function syncTelegramBackButton(screen: AppScreen, onBack: () => void) {
  const back = window.Telegram?.WebApp?.BackButton;
  if (!back) return () => {};
  const hubChild = MORE_HUB_SCREENS.includes(screen) && screen !== 'more';
  const show = hubChild || (!PRIMARY_TABS.includes(screen) && screen !== 'home' && screen !== 'create');
  if (show) {
    back.show?.();
    const handler = () => {
      haptic('light');
      onBack();
    };
    back.onClick?.(handler);
    return () => {
      back.offClick?.(handler);
      back.hide?.();
    };
  }
  back.hide?.();
  return () => {};
}

/** Test hook: reset module listener state between Vitest cases. */
export function __resetTelegramChromeForTests() {
  chromeListenersBound = false;
  themeChangedHandler = null;
  viewportChangedHandler = null;
  teardownTelegramMainButton();
}
