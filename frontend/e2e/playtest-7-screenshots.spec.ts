import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mockTelegramWebApp,
  openCharacterCreation,
  signedTelegramInitData,
  STEP_BY_STEP_WIZARD_BTN,
  WIZARD_CONTINUE_BTN,
  ENTER_ADVENTURE_BTN,
  MEET_ADVENTURER_HEADING,
  CELLAR_HEADING,
} from './telegram.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = join(repoRoot, 'docs', 'pr-screenshots', 'playtest-7');
const WIDTHS = [320, 375, 430] as const;

test.describe.configure({ mode: 'serial' });

async function openCharacterSheet(page: import('@playwright/test').Page, width: number) {
  await page.addInitScript(() => localStorage.setItem('app_locale', 'cs'));
  await page.goto('/');
  await openCharacterCreation(page);
  await page.getByRole('button', { name: STEP_BY_STEP_WIZARD_BTN }).click();
  await page.getByRole('button', { name: /^Elf\b/i }).click();
  await page.getByRole('button', { name: WIZARD_CONTINUE_BTN }).click();
  await page.getByRole('button', { name: /^Bojovník|Fighter/i }).click();
  await page.getByRole('button', { name: WIZARD_CONTINUE_BTN }).click();
  await page.getByRole('button', { name: /lidový hrdina|folk hero/i }).click();
  for (let i = 0; i < 4; i += 1) {
    await page.getByRole('button', { name: WIZARD_CONTINUE_BTN }).click();
  }
  await page.getByLabel(/jméno postavy|character name/i).fill(`Elf ${width}`);
  await page.getByRole('button', { name: WIZARD_CONTINUE_BTN }).click();
  await expect(page.getByRole('heading', { name: MEET_ADVENTURER_HEADING })).toBeVisible();
  await page.getByRole('button', { name: ENTER_ADVENTURE_BTN }).click();
  await page.getByRole('heading', { name: CELLAR_HEADING }).waitFor();
  await page.getByRole('navigation', { name: /hlavní navigace|main navigation/i })
    .getByRole('button', { name: /^Postava$|^Character$/i })
    .click();
  await expect(page.locator('.character-screen.character-v2')).toBeVisible();
}

/** Hide fixed chrome and grow the viewport so element screenshots include full sheet content. */
async function prepareFullSheetCapture(page: import('@playwright/test').Page, width: number) {
  const metrics = await page.evaluate(() => {
    const sheet = document.querySelector('.character-screen.character-v2') as HTMLElement | null;
    const main = document.querySelector('.main-content') as HTMLElement | null;
    const nav = document.querySelector('.bottom-nav') as HTMLElement | null;
    if (nav) nav.style.display = 'none';
    if (main) {
      main.style.overflow = 'visible';
      main.style.height = 'auto';
      main.style.maxHeight = 'none';
      main.style.minHeight = `${main.scrollHeight}px`;
      main.scrollTop = 0;
    }
    document.body.style.paddingBottom = '0';
    return {
      sheetHeight: sheet?.scrollHeight ?? 900,
      mainScroll: main?.scrollHeight ?? 900,
    };
  });
  const viewportHeight = Math.min(
    Math.max(metrics.sheetHeight + 48, metrics.mainScroll + 24, 900),
    8000,
  );
  await page.setViewportSize({ width, height: viewportHeight });
  await page.evaluate(() => window.scrollTo(0, 0));
}

for (const width of WIDTHS) {
  test(`playtest-7 character sheet full and cs texts ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    mkdirSync(OUT_DIR, { recursive: true });
    const telegramId = 915_000_000 + width;
    await page.setViewportSize({ width, height: 900 });
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await openCharacterSheet(page, width);

    const sheet = page.locator('.character-screen.character-v2');
    const darkvision = page.getByTestId('char-darkvision-lead');
    await expect(darkvision).toHaveText('Vidění ve tmě: 18 m. Zatím se projevuje jen v příběhu.');

    const inventory = page.locator('section[aria-labelledby="char-inventory-heading"]');
    await inventory.scrollIntoViewIfNeeded();
    const inventoryText = await inventory.textContent();
    expect(inventoryText ?? '').toMatch(/zbraně/i);
    expect(inventoryText ?? '').toMatch(/krátký meč/i);

    await prepareFullSheetCapture(page, width);

    const fullFile = `character-sheet-full-${width}px.png`;
    await sheet.screenshot({ path: join(OUT_DIR, fullFile) });
    await testInfo.attach(fullFile, { path: join(OUT_DIR, fullFile), contentType: 'image/png' });

    const textsFile = `character-sheet-inventory-texts-${width}px.png`;
    await inventory.screenshot({ path: join(OUT_DIR, textsFile) });
    await testInfo.attach(textsFile, { path: join(OUT_DIR, textsFile), contentType: 'image/png' });

    const lastSection = sheet.locator('section[aria-labelledby="char-progress-heading"]');
    await expect(lastSection).toBeVisible();
    const sheetBox = await sheet.boundingBox();
    const progressBox = await lastSection.boundingBox();
    expect(sheetBox).toBeTruthy();
    expect(progressBox).toBeTruthy();
    if (sheetBox && progressBox) {
      expect(progressBox.y + progressBox.height).toBeLessThanOrEqual(sheetBox.y + sheetBox.height + 2);
    }
  });
}