import { describe, expect, it } from 'vitest';
import { formatJournalStreamResult } from '../journalFormat';
import { presentNarrationProse } from '../i18n/narrationPresent';

describe('narration presentation path', () => {
  const raw = 'You take a moment to catch your breath.\n\nThe Sunken Corridor yawns ahead.';
  const facts = ['You explore the area but find no immediate threat.'];

  it('Adventure stream blob matches journal prose helper for CS', () => {
    const viaStream = formatJournalStreamResult(raw, facts, 'cs');
    const proseOnly = presentNarrationProse(raw, 'cs');
    expect(viaStream.startsWith(proseOnly)).toBe(true);
    expect(viaStream).toContain('Potopená chodba');
    expect(viaStream).not.toMatch(/catch your breath/i);
    expect(viaStream).toMatch(/hrozbu|Průzkum/i);
    expect(viaStream).not.toMatch(/no immediate threat/i);
  });

  it('EN path leaves narration unchanged', () => {
    const viaStream = formatJournalStreamResult(raw, facts, 'en');
    expect(viaStream).toContain('catch your breath');
    expect(viaStream).toContain('The Sunken Corridor');
  });
});
