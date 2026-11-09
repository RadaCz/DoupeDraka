import type { Character } from '../types';
import { titleCase } from '../components/characterVitals';

export type ShareOutcome = 'telegram' | 'web' | 'clipboard' | 'unsupported';

export function inviteLink(): string {
  const bot = import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined;
  if (bot) return `https://t.me/${bot}?startapp=invite`;
  return window.location.href;
}

export function journalExcerpt(result: string, maxLen = 200): string {
  const lines = result
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const prose = lines.find(line => {
    const lower = line.toLowerCase();
    return !lower.startsWith('exploration roll:')
      && !lower.includes(' check:')
      && !lower.startsWith('initiative:')
      && !lower.startsWith('attack with');
  });
  const text = (prose ?? lines[0] ?? '').replace(/\s+/g, ' ');
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1).trim()}…`;
}

export function buildLevelUpShareMessage(character: Character, level: number): string {
  const race = titleCase(character.race);
  const cls = titleCase(character.character_class);
  const link = inviteLink();
  return `I just reached Level ${level} in Doupě Draka as a ${race} ${cls}! Join my adventure: ${link}`;
}

export function buildJournalShareMessage(character: Character, excerpt: string, action?: string): string {
  const race = titleCase(character.race);
  const cls = titleCase(character.character_class);
  const link = inviteLink();
  const beat = excerpt || action || 'A new chapter unfolds';
  if (/bell warden|chapter complete/i.test(beat)) {
    return `I faced a boss in Doupě Draka as a ${race} ${cls}! ${beat} Join my adventure: ${link}`;
  }
  return `A moment from my Doupě Draka adventure (${race} ${cls}): "${beat}" — Join me: ${link}`;
}

export async function shareText(message: string): Promise<ShareOutcome> {
  const tg = window.Telegram?.WebApp;
  const bot = import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined;
  const link = inviteLink();
  const sharePage = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(message)}`;

  if (tg?.openTelegramLink) {
    tg.openTelegramLink(sharePage);
    return 'telegram';
  }

  const switchInline = (tg as { switchInlineQuery?: (query: string, chooseChatTypes?: string[]) => void })
    ?.switchInlineQuery;
  if (switchInline && bot) {
    switchInline(message.slice(0, 240), ['users', 'groups', 'channels']);
    return 'telegram';
  }

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Doupě Draka', text: message, url: link });
      return 'web';
    } catch {
      // User cancelled or share failed — fall through to clipboard.
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(message);
    return 'clipboard';
  }

  return 'unsupported';
}
