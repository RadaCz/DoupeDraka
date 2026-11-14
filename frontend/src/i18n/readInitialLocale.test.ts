import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { LocaleProvider, useI18n } from '../i18n';

describe('readInitialLocale', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('lang');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to Czech when browser language is cs and no saved preference', () => {
    const prev = navigator.language;
    Object.defineProperty(navigator, 'language', { value: 'cs-CZ', configurable: true });
    const { result } = renderHook(() => useI18n(), { wrapper: LocaleProvider });
    expect(result.current.locale).toBe('cs');
    Object.defineProperty(navigator, 'language', { value: prev, configurable: true });
  });

  it('keeps explicit English preference from localStorage', () => {
    localStorage.setItem('app_locale', 'en');
    const { result } = renderHook(() => useI18n(), { wrapper: LocaleProvider });
    expect(result.current.locale).toBe('en');
    act(() => result.current.setLocale('cs'));
    expect(localStorage.getItem('app_locale')).toBe('cs');
  });
});