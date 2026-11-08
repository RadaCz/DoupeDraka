import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetTelegramChromeForTests,
  applyTelegramTheme,
  bindTelegramChrome,
  syncTelegramMainButton,
  teardownTelegramMainButton,
} from './telegramWebApp';

describe('telegramWebApp', () => {
  beforeEach(() => {
    __resetTelegramChromeForTests();
    document.documentElement.style.cssText = '';
    document.documentElement.className = '';
  });

  afterEach(() => {
    __resetTelegramChromeForTests();
  });

  it('registers a single MainButton handler across sync calls', () => {
    const clicks: string[] = [];
    const handlers: Array<() => void> = [];
    const btn = {
      setText: vi.fn(),
      color: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      enable: vi.fn(),
      onClick: vi.fn((handler: () => void) => handlers.push(handler)),
      offClick: vi.fn(),
    };
    window.Telegram = {
      WebApp: { MainButton: btn },
    };

    syncTelegramMainButton(() => 'hello', () => clicks.push('send'), true);
    syncTelegramMainButton(() => 'hello', () => clicks.push('send'), true);
    syncTelegramMainButton(() => 'hello', () => clicks.push('send'), true);

    expect(btn.onClick).toHaveBeenCalledTimes(1);
    handlers[0]?.();
    expect(clicks).toEqual(['send']);
    clicks.length = 0;
    handlers[0]?.();
    expect(clicks).toEqual(['send']);
  });

  it('tears down MainButton on unmount cleanup', () => {
    const handlers: Array<() => void> = [];
    const btn = {
      setText: vi.fn(),
      color: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      enable: vi.fn(),
      onClick: vi.fn((handler: () => void) => handlers.push(handler)),
      offClick: vi.fn(),
    };
    window.Telegram = { WebApp: { MainButton: btn } };

    syncTelegramMainButton(() => 'x', () => {}, true);
    teardownTelegramMainButton();
    expect(btn.offClick).toHaveBeenCalledWith(handlers[0]);
    expect(btn.hide).toHaveBeenCalled();
  });

  it('applies theme and viewport when Telegram fires change events', () => {
    const listeners = new Map<string, () => void>();
    window.Telegram = {
      WebApp: {
        onEvent: (event: string, handler: () => void) => listeners.set(event, handler),
        offEvent: (event: string) => listeners.delete(event),
        themeParams: { bg_color: '#112211', text_color: '#eeeeee' },
        safeAreaInset: { top: 12, bottom: 8 },
        setHeaderColor: vi.fn(),
        setBackgroundColor: vi.fn(),
        expand: vi.fn(),
      },
    };

    const unbind = bindTelegramChrome();
    expect(document.documentElement.style.getPropertyValue('--tg-bg')).toBe('#112211');

    window.Telegram!.WebApp!.themeParams = { bg_color: '#010101', text_color: '#ffffff' };
    listeners.get('themeChanged')?.();
    applyTelegramTheme();
    expect(document.documentElement.style.getPropertyValue('--tg-bg')).toBe('#010101');

    window.Telegram!.WebApp!.safeAreaInset = { top: 20, bottom: 16 };
    listeners.get('viewportChanged')?.();
    expect(document.documentElement.style.getPropertyValue('--tg-safe-top')).toBe('20px');

    unbind();
    expect(listeners.size).toBe(0);
  });
});
