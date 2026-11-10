import { describe, expect, it } from 'vitest';
import { splitJournalResult, splitNarrationAndFacts } from './journalBlocks';

describe('journalBlocks', () => {
  it('splits narrator prose from engine facts', () => {
    const result = 'The corridor yawns ahead.\n\nAttack roll: 18 vs AC 14 — hit.\nSkeleton takes 6 damage.';
    const parts = splitNarrationAndFacts(result);
    expect(parts.narration).toBe('The corridor yawns ahead.');
    expect(parts.facts).toContain('Attack roll');
  });

  it('localizes Czech mechanic lines', () => {
    const blocks = splitJournalResult(
      'Scéna.\n\nDexterity check: 14 vs DC 12 — success.',
      'cs',
    );
    const mechanic = blocks.find(block => block.kind === 'mechanic');
    expect(mechanic?.text).toContain('obratnosti');
    expect(mechanic?.text).toContain('úspěch');
  });

  it('localizes engine attack-with-weapon lines in CS', () => {
    const blocks = splitJournalResult(
      'Steel rings.\n\nAttack with shortsword: 18 (d20+5) vs AC 13 — hit.',
      'cs',
    );
    const mechanic = blocks.find(block => block.kind === 'mechanic');
    expect(mechanic?.text).toMatch(/krátkým mečem/i);
    expect(mechanic?.text).toContain('18');
    expect(mechanic?.text).toMatch(/zásah/i);
  });

  it('localizes exploration prose lines in CS facts', () => {
    const blocks = splitJournalResult(
      'Narrace.\n\nYou explore the area but find no immediate threat.\n\nExploration roll: 5 on a six-sided die.',
      'cs',
    );
    const explorationProse = blocks.find(
      block => block.kind === 'prose' && block.text.includes('hrozbu'),
    );
    expect(explorationProse).toBeTruthy();
    expect(blocks.some(block => block.kind === 'mechanic' && block.text.startsWith('Průzkum:'))).toBe(true);
  });

  it('labels quest and mechanic lines in the facts block', () => {
    const blocks = splitJournalResult(
      'Caldus nods grimly.\n\nYou accept the quest to recover the shrine bell.\n\nAttack roll: 12 vs AC 10 — hit.',
      'en',
    );
    expect(blocks.some(block => block.kind === 'quest')).toBe(true);
    expect(blocks.some(block => block.kind === 'mechanic')).toBe(true);
  });
});
