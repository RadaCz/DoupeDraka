import { expect, test } from '@playwright/test';
import {
  completeCharacterWizard,
  mockTelegramWebApp,
  signedTelegramInitData,
} from './telegram.ts';

const RACES = [
  { race: 'Human', key: 'human' },
  { race: 'Elf', key: 'elf' },
  { race: 'Dwarf', key: 'dwarf' },
  { race: 'Halfling', key: 'halfling' },
] as const;

test.describe.configure({ mode: 'serial' });

for (const { race, key } of RACES) {
  test(`${key} wizard shows engine traits and sheet persists`, async ({ page }, testInfo) => {
    const telegramId = 770_000_000 + testInfo.workerIndex * 10 + RACES.findIndex(r => r.key === key);
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await page.goto('/');
    await completeCharacterWizard(page, {
      name: `${race} S26`,
      race,
      characterClass: 'Fighter',
      background: 'Soldier',
    });

    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /^Character$/i }).click();
    await expect(page.getByRole('heading', { name: `${race} S26` })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Racial traits|Rasove vlastnosti/i })).toBeVisible();
  });
}
