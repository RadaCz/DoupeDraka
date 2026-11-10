import type { AppScreen } from './types';
import { MORE_HUB_SCREENS } from './types';
import { isLightUiColor } from './telegram/colorUtils';

/** Fixed dark-fantasy palette when Telegram theme is light (white cards bug). */
const GAME_DARK = {
  bg: '#0d120e',
  surface: '#182019',
  text: '#edf1e5',
  hint: '#aebaa8',
  button: '#4a8f5c',
} as const;

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
  const root = document.documentElement;
  if (!tg) {
    root.style.removeProperty('--app-safe-top');
    root.style.removeProperty('--app-safe-bottom');
    root.style.removeProperty('--tg-content-safe-top');
    root.style.removeProperty('--tg-content-safe-bottom');
    return;
  }
  tg.expand?.();
  const content = tg.contentSafeAreaInset;
  const device = tg.safeAreaInset;
  const contentTop = content?.top ?? 0;
  const contentBottom = content?.bottom ?? 0;
  const deviceTop = device?.top ?? 0;
  const deviceBottom = device?.bottom ?? 0;
  const appTop = Math.max(contentTop, deviceTop);
  const appBottom = Math.max(contentBottom, deviceBottom);
  root.style.setProperty('--tg-content-safe-top', `${contentTop}px`);
  root.style.setProperty('--tg-content-safe-bottom', `${contentBottom}px`);
  if (appTop > 0) {
    root.style.setProperty('--app-safe-top', `${appTop}px`);
  } else {
    root.style.removeProperty('--app-safe-top');
  }
  if (appBottom > 0) {
    root.style.setProperty('--app-safe-bottom', `${appBottom}px`);
  } else {
    root.style.removeProperty('--app-safe-bottom');
  }
}

function updateKeyboardOffset() {
  const viewport = window.visualViewport;
  if (!viewport) {
    document.documentElement.style.setProperty('--keyboard-offset', '0px');
    return;
  }
  const gap = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
  document.documentElement.style.setProperty('--keyboard-offset', `${Math.round(gap)}px`);
}

export function bindVisualViewportKeyboard(): () => void {
  const viewport = window.visualViewport;
  if (!viewport) return () => {};
  const onChange = () => updateKeyboardOffset();
  viewport.addEventListener('resize', onChange);
  viewport.addEventListener('scroll', onChange);
  updateKeyboardOffset();
  return () => {
    viewport.removeEventListener('resize', onChange);
    viewport.removeEventListener('scroll', onChange);
    document.documentElement.style.setProperty('--keyboard-offset', '0px');
  };
}

export function applyTelegramTheme() {
  const tg = telegramChrome();
  if (!tg) return;
  const params = tg.themeParams;
  const root = document.documentElement;
  const tgBg = params?.bg_color;
  const tgSecondary = params?.secondary_bg_color;
  const telegramLooksLight = isLightUiColor(tgBg) || isLightUiColor(tgSecondary);
  const bg = telegramLooksLight ? GAME_DARK.bg : (tgBg ?? GAME_DARK.bg);
  const secondary = telegramLooksLight ? GAME_DARK.surface : (tgSecondary ?? GAME_DARK.surface);
  const text = telegramLooksLight
    ? GAME_DARK.text
    : (params?.text_color ?? GAME_DARK.text);
  const hint = telegramLooksLight
    ? GAME_DARK.hint
    : (params?.hint_color ?? GAME_DARK.hint);
  const button = params?.button_color && !isLightUiColor(params.button_color)
    ? params.button_color
    : GAME_DARK.button;
  root.style.setProperty('--tg-bg', bg);
  root.style.setProperty('--tg-surface', secondary);
  root.style.setProperty('--tg-text', text);
  root.style.setProperty('--tg-hint', hint);
  root.style.setProperty('--tg-button', button);
  root.classList.add('telegram-themed');
  root.dataset.telegramUiTone = telegramLooksLight ? 'locked-dark' : 'native';
  tg.setHeaderColor?.(bg);
  tg.setBackgroundColor?.(bg);
}

let themeChangedHandler: (() => void) | null = null;
let viewportChangedHandler: (() => void) | null = null;
let chromeListenersBound = false;

/** Subscribe to Telegram theme and viewport changes; safe in browser (no-op without WebApp). */
export function bindTelegramChrome(): () => void {
  const tg = telegramChrome();
  const unbindKeyboard = bindVisualViewportKeyboard();
  if (!tg?.onEvent) {
    applyTelegramTheme();
    applyTelegramViewport();
    return unbindKeyboard;
  }
  if (!chromeListenersBound) {
    themeChangedHandler = () => applyTelegramTheme();
    viewportChangedHandler = () => applyTelegramViewport();
    tg.onEvent('themeChanged', themeChangedHandler);
    tg.onEvent('viewportChanged', viewportChangedHandler);
    tg.onEvent('safeAreaChanged', viewportChangedHandler);
    tg.onEvent('contentSafeAreaChanged', viewportChangedHandler);
    chromeListenersBound = true;
  }
  applyTelegramTheme();
  applyTelegramViewport();
  return () => {
    if (themeChangedHandler) tg.offEvent?.('themeChanged', themeChangedHandler);
    if (viewportChangedHandler) {
      tg.offEvent?.('viewportChanged', viewportChangedHandler);
      tg.offEvent?.('safeAreaChanged', viewportChangedHandler);
      tg.offEvent?.('contentSafeAreaChanged', viewportChangedHandler);
    }
    themeChangedHandler = null;
    viewportChangedHandler = null;
    chromeListenersBound = false;
    unbindKeyboard();
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
