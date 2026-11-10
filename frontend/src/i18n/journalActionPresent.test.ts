import { describe, expect, it } from 'vitest';
import { presentJournalAction } from './journalActionPresent';

describe('presentJournalAction', () => {
  it('localizes explore/search with location', () => {
    expect(presentJournalAction('search The Forgotten Crypt', 'cs')).toBe('Prohledat: Zapomenutá krypta');
    expect(presentJournalAction('search The Underground River', 'cs')).toMatch(/Podzemní řeka/);
  });

  it('localizes rest and attack', () => {
    expect(presentJournalAction('rest', 'cs')).toBe('Odpočinek');
    expect(presentJournalAction('attack Kobold skirmisher', 'cs')).toMatch(/Koboldí záškodník/);
  });

  it('passes through EN', () => {
    expect(presentJournalAction('search The Forgotten Crypt', 'en')).toBe('search The Forgotten Crypt');
  });
});
