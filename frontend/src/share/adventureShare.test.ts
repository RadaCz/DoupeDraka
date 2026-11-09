import { describe, expect, it } from 'vitest';
import type { Character } from '../types';
import { buildJournalShareMessage, buildLevelUpShareMessage, journalExcerpt } from './adventureShare';

const hero = {
  race: 'half-elf',
  character_class: 'bard',
  name: 'Lyra',
} as Character;

describe('adventureShare', () => {
  it('builds level-up message with class and race', () => {
    const message = buildLevelUpShareMessage(hero, 2);
    expect(message).toContain('Level 2');
    expect(message).toContain('Half-Elf');
    expect(message).toContain('Bard');
    expect(message).toContain('Doupě Draka');
  });

  it('extracts prose from journal results', () => {
    const excerpt = journalExcerpt('Exploration roll: 2 on a six-sided die.\nYou find a hidden passage.');
    expect(excerpt).toBe('You find a hidden passage.');
  });

  it('flags boss beats in journal share text', () => {
    const message = buildJournalShareMessage(hero, 'The Bell Warden falls silent.', 'attack');
    expect(message.toLowerCase()).toContain('boss');
  });
});
