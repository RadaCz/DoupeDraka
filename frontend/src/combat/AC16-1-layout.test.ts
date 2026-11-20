import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('AC16-1 compact combat layout', () => {
  it('keeps four main action columns and 44px touch targets in play.css', () => {
    const css = readFileSync(resolve(__dirname, '../styles/play.css'), 'utf8');
    expect(css).toContain('.combat-action-grid-main');
    expect(css).toMatch(/grid-template-columns:\s*repeat\(4/);
    expect(css).toMatch(/min-height:\s*44px/);
    expect(css).toMatch(/max-height:\s*min\(28vh,\s*220px\)/);
  });
});