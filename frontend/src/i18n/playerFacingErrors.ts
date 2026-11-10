import type { Locale } from '../i18n';

/** Stable API `detail` strings from FastAPI — keys must exist in `i18n.tsx` cs map. */
export const PLAYER_FACING_API_ERRORS: Record<string, string> = {
  'Not enough narrator credits for this turn. Top up to continue.':
    'Not enough narrator credits for this turn. Top up to continue.',
  'Character has fallen and can no longer act': 'Character has fallen and can no longer act',
  'Action cannot be empty': 'Action cannot be empty',
  'Character not found': 'Character not found',
  'Character state changed during the turn; retry': 'Character state changed during the turn; retry',
  'Character changed while saving settings; retry': 'Character changed while saving settings; retry',
  'Character changed while updating; retry': 'Character changed while updating; retry',
  'Character changed while reviving; retry': 'Character changed while reviving; retry',
  'Concurrent idempotency conflict; retry': 'Concurrent idempotency conflict; retry',
  'Idempotency key belongs to another account': 'Idempotency key belongs to another account',
  'Pro tier is not available in this build.': 'Pro tier is not available in this build.',
  'Paid narration tiers require a configured external provider; use lite.':
    'Paid narration tiers require a configured external provider; use lite.',
  'Database unavailable': 'Database unavailable',
  'Invalid credentials': 'Invalid credentials',
  'User not found': 'User not found',
};

const PREFIX_ERRORS: Array<{ prefix: string; key: string }> = [
  { prefix: 'Invalid Telegram credentials:', key: 'Invalid Telegram credentials:' },
  { prefix: 'Unknown tier:', key: 'Unknown narrator tier.' },
];

/**
 * Map raw API / transport errors to translatable UI keys (EN canonical).
 * Falls back to the original message when no catalog match exists.
 */
export function playerFacingErrorKey(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return trimmed;
  if (PLAYER_FACING_API_ERRORS[trimmed]) return trimmed;
  for (const { prefix, key } of PREFIX_ERRORS) {
    if (trimmed.startsWith(prefix)) return key;
  }
  return trimmed;
}

export function presentPlayerFacingError(
  message: string,
  locale: Locale,
  t: (text: string) => string,
): string {
  if (locale !== 'cs') return message;
  const key = playerFacingErrorKey(message);
  const translated = t(key);
  return translated === key ? message : translated;
}
