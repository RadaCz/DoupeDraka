import type { AppScreen } from './types';
import { MORE_HUB_SCREENS } from './types';

const PRIMARY_TABS: AppScreen[] = ['game', 'map', 'quests', 'character', 'more'];

export function applyTelegramTheme() {
  const tg = window.Telegram?.WebApp;
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
