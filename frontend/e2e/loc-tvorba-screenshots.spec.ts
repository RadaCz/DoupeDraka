import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockTelegramWebApp, openCharacterCreation, signedTelegramInitData, STEP_BY_STEP_WIZARD_BTN } from './telegram.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = join(repoRoot, 'docs', 'pr-screenshots', 'loc-tvorba');
const WIDTHS = [320, 375, 430] as const;

test.describe.configure({ mode: 'serial' });

async function openWizard(page: import('@playwright/test').Page) {
  await page.goto('/');
  await openCharacterCreation(page);
  await page.getByRole('button', { name: STEP_BY_STEP_WIZARD_BTN }).click();
}

for (const width of WIDTHS) {
  test(`wizard step 1 Elf ${width}px cs`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    mkdirSync(OUT_DIR, { recursive: true });
    const telegramId = 880_100_000 + width;
    await page.setViewportSize({ width, height: 820 });
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await page.addInitScript(() => localStorage.setItem('app_locale', 'cs'));
    await openWizard(page);
    await page.getByRole('button', { name: /^Elf\b/i }).click();
    const target = page.locator('.wizard-content');
    await expect(target.getByRole('heading', { name: /rasové vlastnosti/i })).toBeVisible();
    const file = `wizard-step1-elf-${width}px.png`;
    await target.screenshot({ path: join(OUT_DIR, file) });
    await testInfo.attach(file, { path: join(OUT_DIR, file), contentType: 'image/png' });
  });
}

for (const width of WIDTHS) {
  test(`wizard step 1 Dwarf ${width}px cs`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    mkdirSync(OUT_DIR, { recursive: true });
    const telegramId = 880_200_000 + width;
    await page.setViewportSize({ width, height: 820 });
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await page.addInitScript(() => localStorage.setItem('app_locale', 'cs'));
    await openWizard(page);
    await page.getByRole('button', { name: /trpaslík/i }).click();
    const target = page.locator('.wizard-content');
    await expect(target.getByRole('heading', { name: /rasové vlastnosti/i })).toBeVisible();
    const file = `wizard-step1-dwarf-${width}px.png`;
    await target.screenshot({ path: join(OUT_DIR, file) });
    await testInfo.attach(file, { path: join(OUT_DIR, file), contentType: 'image/png' });
  });
}

for (const width of WIDTHS) {
  test(`wizard step 5 Rogue ${width}px cs`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    mkdirSync(OUT_DIR, { recursive: true });
    const telegramId = 880_300_000 + width;
    await page.setViewportSize({ width, height: 820 });
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await page.addInitScript(() => localStorage.setItem('app_locale', 'cs'));
    await openWizard(page);
    await page.getByRole('button', { name: /člověk/i }).click();
    await page.getByRole('button', { name: /pokračovat|continue/i }).click();
    await page.getByRole('button', { name: /tulák/i }).click();
    await page.getByRole('button', { name: /pokračovat|continue/i }).click();
    await page.getByRole('button', { name: /lidový hrdina/i }).click();
    await page.getByRole('button', { name: /pokračovat|continue/i }).click();
    await page.getByRole('button', { name: /pokračovat|continue/i }).click();
    const target = page.locator('.wizard-content');
    await expect(target.getByRole('heading', { name: /dovednosti povolání/i })).toBeVisible();
    const file = `wizard-step5-rogue-${width}px.png`;
    await target.screenshot({ path: join(OUT_DIR, file) });
    await testInfo.attach(file, { path: join(OUT_DIR, file), contentType: 'image/png' });
  });
}