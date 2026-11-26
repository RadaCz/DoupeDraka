export type TurnPhase = 'idle' | 'sending' | 'resolved' | 'narrating' | 'recovering';

export const PENDING_ACTION_KEY = 'pending_action_v1';

export interface StoredPendingAction {
  characterId: string;
  action: string;
  idempotencyKey: string;
}

export function readPendingAction(): StoredPendingAction | null {
  try {
    const raw = sessionStorage.getItem(PENDING_ACTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPendingAction;
    if (parsed?.characterId && parsed?.action && parsed?.idempotencyKey) return parsed;
  } catch {
    // Corrupt storage should not block play.
  }
  return null;
}

export function writePendingAction(pending: StoredPendingAction): void {
  sessionStorage.setItem(PENDING_ACTION_KEY, JSON.stringify(pending));
}

export function clearPendingAction(): void {
  sessionStorage.removeItem(PENDING_ACTION_KEY);
}

function mintIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Resolve the pending turn receipt for this action. Reuses `held` from React state on
 * retry so re-renders cannot rotate the idempotency key mid-recovery.
 */
export function resolvePendingTurnKey(
  characterId: string,
  action: string,
  held: StoredPendingAction | null,
): StoredPendingAction {
  if (held?.characterId === characterId && held.action === action) {
    writePendingAction(held);
    return held;
  }
  const stored = readPendingAction();
  if (stored?.characterId === characterId && stored.action === action) {
    return stored;
  }
  const pending: StoredPendingAction = {
    characterId,
    action,
    idempotencyKey: mintIdempotencyKey(),
  };
  writePendingAction(pending);
  return pending;
}

export function idempotencyKeyForTurn(characterId: string, action: string): string {
  return resolvePendingTurnKey(characterId, action, null).idempotencyKey;
}
