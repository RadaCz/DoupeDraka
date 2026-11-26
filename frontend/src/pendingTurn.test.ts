import { afterEach, describe, expect, it } from 'vitest';
import {
  PENDING_ACTION_KEY,
  clearPendingAction,
  idempotencyKeyForTurn,
  readPendingAction,
  resolvePendingTurnKey,
  type StoredPendingAction,
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

  it('reuses held pending state on retry without minting a new key', () => {
    const held: StoredPendingAction = {
      characterId: 'hero-1',
      action: 'look around',
      idempotencyKey: 'stable-key-abc',
    };
    const resolved = resolvePendingTurnKey('hero-1', 'look around', held);
    expect(resolved.idempotencyKey).toBe('stable-key-abc');
    expect(readPendingAction()?.idempotencyKey).toBe('stable-key-abc');
    const again = resolvePendingTurnKey('hero-1', 'look around', held);
    expect(again.idempotencyKey).toBe('stable-key-abc');
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
