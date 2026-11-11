import { expect, test } from '@playwright/test';
import {
  completeCharacterWizard,
  completeWizardWizardCaster,
  HOME_HEADING,
  mockTelegramWebApp,
  openCharacterCreation,
  signedTelegramInitData,
} from './telegram.ts';
import { assertNoHorizontalOverflow } from './mobile-helpers.ts';

test.describe.configure({ mode: 'serial' });

test('manual step-by-step creation persists on character sheet after reload', async ({ page }, testInfo) => {
  const telegramId = 760_000_000 + testInfo.workerIndex;
  await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
  await page.goto('/');
  await completeCharacterWizard(page, {
    name: 'Manual E2E',
    race: 'Dwarf',
    characterClass: 'Fighter',
    background: 'Soldier',
  });

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /^Character$/i }).click();
  await expect(page.getByRole('heading', { name: 'Manual E2E' })).toBeVisible();
  await expect(page.getByText(/Athletics/i)).toBeVisible();
  await expect(page.getByText(/Intimidation/i)).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: /Welcome back, Manual E2E/i })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /^Character$/i }).click();
  await expect(page.getByRole('heading', { name: 'Manual E2E' })).toBeVisible();
});

test('wizard caster learns spells and enters play', async ({ page }, testInfo) => {
  const telegramId = 760_100_000 + testInfo.workerIndex;
  await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
  await page.goto('/');
  await completeWizardWizardCaster(page, 'Caster E2E');

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /^Character$/i }).click();
  await expect(page.getByRole('heading', { name: 'Caster E2E' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Spells & abilities/i })).toBeVisible();
  await expect(page.getByText(/Known/i).first()).toBeVisible();
});

test('quick generate creates a playable hero', async ({ page }, testInfo) => {
  const telegramId = 760_200_000 + testInfo.workerIndex;
  await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
  await page.goto('/');
  await completeCharacterWizard(page, { name: 'Quick E2E', mode: 'quick' });
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /^Character$/i }).click();
  await expect(page.getByRole('heading', { name: 'Quick E2E' })).toBeVisible();
});

test('wizard scrolls on narrow viewport without horizontal overflow', async ({ page }, testInfo) => {
  const telegramId = 760_300_000 + testInfo.workerIndex;
  await page.setViewportSize({ width: 375, height: 812 });
  await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
  await page.goto('/');
  await openCharacterCreation(page);
  await page.getByRole('button', { name: /step-by-step wizard|průvodce krok za krokem/i }).click();
  await assertNoHorizontalOverflow(page);
  await page.getByRole('button', { name: /^Halfling\b/i }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await assertNoHorizontalOverflow(page);
  await expect(page.getByRole('heading', { name: /Choose a class/i })).toBeVisible();
});
