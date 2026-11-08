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

export function idempotencyKeyForTurn(characterId: string, action: string): string {
  const existing = readPendingAction();
  if (existing && existing.characterId === characterId && existing.action === action) {
    return existing.idempotencyKey;
  }
  const key = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  writePendingAction({ characterId, action, idempotencyKey: key });
  return key;
}
