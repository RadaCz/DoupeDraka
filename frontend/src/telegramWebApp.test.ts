import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetTelegramChromeForTests,
  applyTelegramTheme,
  applyTelegramViewport,
  bindTelegramChrome,
  syncTelegramMainButton,
  syncTelegramBackButton,
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

  it('applyTelegramViewport uses max of content and device insets and clears when absent', () => {
    window.Telegram = {
      WebApp: {
        expand: vi.fn(),
        contentSafeAreaInset: { top: 44, bottom: 20 },
        safeAreaInset: { top: 12, bottom: 8 },
      },
    };
    applyTelegramViewport();
    expect(document.documentElement.style.getPropertyValue('--tg-content-safe-top')).toBe('44px');
    expect(document.documentElement.style.getPropertyValue('--app-safe-top')).toBe('44px');
    expect(document.documentElement.style.getPropertyValue('--app-safe-bottom')).toBe('20px');

    window.Telegram!.WebApp!.contentSafeAreaInset = { top: 0, bottom: 0 };
    window.Telegram!.WebApp!.safeAreaInset = { top: 0, bottom: 0 };
    applyTelegramViewport();
    expect(document.documentElement.style.getPropertyValue('--app-safe-top')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--app-safe-bottom')).toBe('');
  });

  it('applyTelegramViewport clears Telegram overrides outside WebApp', () => {
    window.Telegram = {
      WebApp: {
        expand: vi.fn(),
        contentSafeAreaInset: { top: 30, bottom: 10 },
        safeAreaInset: { top: 20, bottom: 5 },
      },
    };
    applyTelegramViewport();
    expect(document.documentElement.style.getPropertyValue('--app-safe-top')).toBe('30px');

    window.Telegram = undefined;
    applyTelegramViewport();
    expect(document.documentElement.style.getPropertyValue('--app-safe-top')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--tg-content-safe-top')).toBe('');
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
    window.Telegram!.WebApp!.contentSafeAreaInset = { top: 44, bottom: 20 };
    listeners.get('viewportChanged')?.();
    expect(document.documentElement.style.getPropertyValue('--tg-content-safe-top')).toBe('44px');
    expect(document.documentElement.style.getPropertyValue('--app-safe-top')).toBe('44px');

    listeners.get('safeAreaChanged')?.();
    expect(document.documentElement.style.getPropertyValue('--app-safe-top')).toBe('44px');

    window.Telegram!.WebApp!.contentSafeAreaInset = { top: 52, bottom: 24 };
    listeners.get('contentSafeAreaChanged')?.();
    expect(document.documentElement.style.getPropertyValue('--app-safe-top')).toBe('52px');
    expect(document.documentElement.style.getPropertyValue('--tg-content-safe-top')).toBe('52px');

    unbind();
    expect(listeners.size).toBe(0);
  });

  it('uses single safe-top on app-shell without duplicating on header rule', () => {
    window.Telegram = {
      WebApp: {
        expand: vi.fn(),
        contentSafeAreaInset: { top: 44, bottom: 20 },
        safeAreaInset: { top: 12, bottom: 8 },
      },
    };
    applyTelegramViewport();
    expect(document.documentElement.style.getPropertyValue('--app-safe-top')).toBe('44px');
  });

  it('updates BackButton callback without duplicate listeners', () => {
    const calls: string[] = [];
    const handlers: Array<() => void> = [];
    const btn = {
      show: vi.fn(),
      hide: vi.fn(),
      onClick: vi.fn((handler: () => void) => handlers.push(handler)),
      offClick: vi.fn(),
    };
    window.Telegram = { WebApp: { BackButton: btn } };

    syncTelegramBackButton(() => calls.push('first'), true);
    syncTelegramBackButton(() => calls.push('second'), true);
    expect(btn.onClick).toHaveBeenCalledTimes(1);
    handlers[0]?.();
    expect(calls).toEqual(['second']);
  });

  it('hides BackButton on root tabs and shows on nested screens', () => {
    const btn = {
      show: vi.fn(),
      hide: vi.fn(),
      onClick: vi.fn(),
      offClick: vi.fn(),
    };
    window.Telegram = { WebApp: { BackButton: btn } };
    syncTelegramBackButton(() => {}, false);
    expect(btn.hide).toHaveBeenCalled();
    syncTelegramBackButton(() => {}, true);
    expect(btn.show).toHaveBeenCalled();
  });

  it('registers a single BackButton handler across sync calls', () => {
    const calls: string[] = [];
    const handlers: Array<() => void> = [];
    const btn = {
      show: vi.fn(),
      hide: vi.fn(),
      onClick: vi.fn((handler: () => void) => handlers.push(handler)),
      offClick: vi.fn(),
    };
    window.Telegram = { WebApp: { BackButton: btn } };

    const cleanup = syncTelegramBackButton(() => calls.push('back'), true);
    syncTelegramBackButton(() => calls.push('back'), true);
    syncTelegramBackButton(() => calls.push('back'), true);

    expect(btn.onClick).toHaveBeenCalledTimes(1);
    handlers[0]?.();
    expect(calls).toEqual(['back']);
    cleanup();
    expect(btn.offClick).toHaveBeenCalledWith(handlers[0]);
    expect(btn.hide).toHaveBeenCalled();
  });

  it('locks dark surfaces when Telegram sends light theme params', () => {
    window.Telegram = {
      WebApp: {
        themeParams: {
          bg_color: '#ffffff',
          secondary_bg_color: '#f5f5f5',
          text_color: '#000000',
        },
        setHeaderColor: vi.fn(),
        setBackgroundColor: vi.fn(),
        expand: vi.fn(),
      },
    };
    applyTelegramTheme();
    expect(document.documentElement.style.getPropertyValue('--tg-bg')).toBe('#0d120e');
    expect(document.documentElement.style.getPropertyValue('--tg-surface')).toBe('#182019');
    expect(document.documentElement.dataset.telegramUiTone).toBe('locked-dark');
  });
});
