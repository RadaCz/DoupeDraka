import { describe, expect, it } from 'vitest';
import { presentNarrationProse } from './narrationPresent';

describe('narrationPresent', () => {
  it('strips English engine cooldown from CS prose display', () => {
    const raw = 'You take a moment to catch your breath.\n\nZastavíš se na chvíli.';
    expect(presentNarrationProse(raw, 'cs')).not.toMatch(/catch your breath/i);
    expect(presentNarrationProse(raw, 'cs')).toContain('Zastavíš');
  });

  it('localizes embedded location names in CS prose', () => {
    const raw = 'V The Sunken Corridor je klid.';
    expect(presentNarrationProse(raw, 'cs')).toContain('Potopená chodba');
    expect(presentNarrationProse(raw, 'cs')).not.toContain('Sunken Corridor');
  });

  it('leaves EN prose unchanged', () => {
    const raw = 'You pause in The Sunken Corridor.';
    expect(presentNarrationProse(raw, 'en')).toBe(raw);
  });
});
