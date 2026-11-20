import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('AC16-9 reduced-motion styles', () => {
  it('disables combat action transform animations under prefers-reduced-motion', () => {
    const css = readFileSync(resolve(__dirname, '../styles/play.css'), 'utf8');
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
    expect(css).toMatch(/\.combat-action-card:active:not\(:disabled\)[\s\S]*transform:\s*none/);
    expect(css).toMatch(/\.combat-battlefield-foe-token[\s\S]*transition:\s*none/);
  });
});