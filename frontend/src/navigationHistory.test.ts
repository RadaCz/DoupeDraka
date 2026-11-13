import { describe, expect, it } from 'vitest';
import { canGoBackFrom, goBackScreen, navigateScreen } from './navigationHistory';
import type { AppScreen } from './types';

describe('navigationHistory', () => {
  it.each([
    ['home', 'quests', 'home'],
    ['game', 'quests', 'game'],
    ['map', 'quests', 'map'],
    ['game', 'map', 'game'],
    ['home', 'journal', 'home'],
    ['more', 'settings', 'more'],
    ['character', 'tools', 'character'],
    ['more', 'map', 'more'],
  ] as const)('Adventure path %s → %s → back returns %s', (from, nested, backTo) => {
    let stack: AppScreen[] = [];
    const forward = navigateScreen(stack, from, nested);
    stack = forward.stack;
    expect(forward.screen).toBe(nested);
    const back = goBackScreen(stack, nested);
    expect(back.screen).toBe(backTo);
    expect(back.stack).toEqual([]);
  });

  it('root tab switches clear history', () => {
    const { stack, screen } = navigateScreen(['home'], 'quests', 'character');
    expect(screen).toBe('character');
    expect(stack).toEqual([]);
  });

  it('does not duplicate consecutive history entries', () => {
    let stack: AppScreen[] = [];
    const first = navigateScreen(stack, 'home', 'quests');
    stack = first.stack;
    const second = navigateScreen(stack, 'quests', 'journal');
    expect(second.stack).toEqual(['home', 'quests']);
    const third = navigateScreen(second.stack, 'journal', 'journal');
    expect(third.stack).toEqual(['home', 'quests']);
  });

  it('brand home navigation clears obsolete history via root tab', () => {
    const fromNested = navigateScreen(['game'], 'map', 'home');
    expect(fromNested.screen).toBe('home');
    expect(fromNested.stack).toEqual([]);
  });

  it('character creation cancel returns home and clears stack', () => {
    const back = goBackScreen(['home'], 'create');
    expect(back.screen).toBe('home');
    expect(back.stack).toEqual([]);
  });

  it('empty history fallback from nested screen goes home', () => {
    const back = goBackScreen([], 'journal');
    expect(back.screen).toBe('home');
  });

  it('hides back on root tabs with empty history', () => {
    expect(canGoBackFrom([], 'home')).toBe(false);
    expect(canGoBackFrom([], 'game')).toBe(false);
    expect(canGoBackFrom([], 'more')).toBe(false);
  });

  it('shows back on nested screens and create', () => {
    expect(canGoBackFrom([], 'quests')).toBe(true);
    expect(canGoBackFrom([], 'create')).toBe(true);
  });
});
