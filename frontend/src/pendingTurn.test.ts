import { afterEach, describe, expect, it } from 'vitest';
import {
  PENDING_ACTION_KEY,
  clearPendingAction,
  idempotencyKeyForTurn,
  readPendingAction,
} from './pendingTurn';

afterEach(() => {
  sessionStorage.clear();
});

describe('pendingTurn idempotency', () => {
  it('reuses the same key until the pending turn is cleared', () => {
    const first = idempotencyKeyForTurn('hero-1', 'look around');
    const second = idempotencyKeyForTurn('hero-1', 'look around');
    expect(second).toBe(first);
    clearPendingAction();
    const third = idempotencyKeyForTurn('hero-1', 'look around');
    expect(third).not.toBe(first);
  });

  it('isolates pending turns per character and action', () => {
    const cellar = idempotencyKeyForTurn('a', 'explore');
    const shrine = idempotencyKeyForTurn('b', 'explore');
    expect(cellar).not.toBe(shrine);
    const stored = readPendingAction();
    expect(stored).toEqual({ characterId: 'b', action: 'explore', idempotencyKey: shrine });
    expect(sessionStorage.getItem(PENDING_ACTION_KEY)).toContain(shrine);
  });
});
