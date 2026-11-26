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
const OUT_DIR = join(repoRoot, 'docs', 'pr-screenshots', 'playtest-6');
const WIDTHS = [320, 375, 430] as const;

test.describe.configure({ mode: 'serial' });

async function openWizardCs(page: import('@playwright/test').Page) {
  await page.addInitScript(() => localStorage.setItem('app_locale', 'cs'));
  await page.goto('/');
  await openCharacterCreation(page);
  await page.getByRole('button', { name: STEP_BY_STEP_WIZARD_BTN }).click();
}

async function reachSpells(page: import('@playwright/test').Page, classPattern: RegExp) {
  await page.getByRole('button', { name: /^Elf\b/i }).click();
  await page.getByRole('button', { name: WIZARD_CONTINUE_BTN }).click();
  await page.getByRole('button', { name: classPattern }).click();
  await page.getByRole('button', { name: WIZARD_CONTINUE_BTN }).click();
  await page.getByRole('button', { name: /mudrc|sage/i }).click();
  for (let i = 0; i < 4; i += 1) {
    await page.getByRole('button', { name: WIZARD_CONTINUE_BTN }).click();
  }
}

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

async function exposeMainContentScroll(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const main = document.querySelector('.main-content');
    if (!main) return;
    const el = main as HTMLElement;
    el.style.overflow = 'visible';
    el.style.height = 'auto';
    el.style.maxHeight = 'none';
    el.style.minHeight = `${el.scrollHeight}px`;
  });
}

for (const width of WIDTHS) {
  test(`wizard spells step ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    mkdirSync(OUT_DIR, { recursive: true });
    const telegramId = 911_000_000 + width;
    await page.setViewportSize({ width, height: 820 });
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await openWizardCs(page);
    await reachSpells(page, /^Čaroděj|Wizard/i);
    const file = `wizard-spells-wizard-${width}px.png`;
    await page.screenshot({ path: join(OUT_DIR, file), fullPage: true });
    await testInfo.attach(file, { path: join(OUT_DIR, file), contentType: 'image/png' });
  });
}

for (const width of WIDTHS) {
  test(`cleric spells step ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    mkdirSync(OUT_DIR, { recursive: true });
    const telegramId = 912_000_000 + width;
    await page.setViewportSize({ width, height: 820 });
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await openWizardCs(page);
    await reachSpells(page, /^Klerik|Cleric/i);
    const file = `wizard-spells-cleric-${width}px.png`;
    await page.screenshot({ path: join(OUT_DIR, file), fullPage: true });
    await testInfo.attach(file, { path: join(OUT_DIR, file), contentType: 'image/png' });
  });
}

for (const width of WIDTHS) {
  test(`wizard stepper ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    mkdirSync(OUT_DIR, { recursive: true });
    const telegramId = 913_000_000 + width;
    await page.setViewportSize({ width, height: 820 });
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await openWizardCs(page);
    await page.getByRole('button', { name: /^Elf\b/i }).click();
    const file = `wizard-stepper-${width}px.png`;
    await page.screenshot({ path: join(OUT_DIR, file), fullPage: true });
    await testInfo.attach(file, { path: join(OUT_DIR, file), contentType: 'image/png' });
  });
}

for (const width of WIDTHS) {
  test(`character sheet captures scroll container and race traits ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    mkdirSync(OUT_DIR, { recursive: true });
    const telegramId = 914_000_000 + width;
    await page.setViewportSize({ width, height: 900 });
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await openCharacterSheet(page, width);

    const sheet = page.locator('.character-screen.character-v2');
    const raceSection = page.locator('section[aria-labelledby="char-race-heading"]');

    await raceSection.scrollIntoViewIfNeeded();
    await expect(raceSection).toBeVisible();
    const raceText = await raceSection.textContent();
    expect(raceText ?? '').toMatch(/vidění ve tmě/i);
    expect(raceText ?? '').toMatch(/jen v příběhu/i);

    await exposeMainContentScroll(page);
    const sheetText = await sheet.textContent();
    expect(sheetText ?? '').not.toMatch(/odloženo/i);
    expect(sheetText ?? '').not.toMatch(/\bdeferred\b/i);

    const fullFile = `character-sheet-full-${width}px.png`;
    await sheet.screenshot({ path: join(OUT_DIR, fullFile) });
    await testInfo.attach(fullFile, { path: join(OUT_DIR, fullFile), contentType: 'image/png' });

    const raceFile = `character-sheet-race-traits-${width}px.png`;
    await raceSection.screenshot({ path: join(OUT_DIR, raceFile) });
    await testInfo.attach(raceFile, { path: join(OUT_DIR, raceFile), contentType: 'image/png' });

    const scrollHeight = await page.evaluate(() => {
      const main = document.querySelector('.main-content');
      const screen = document.querySelector('.character-screen.character-v2');
      return {
        mainScroll: main?.scrollHeight ?? 0,
        sheetHeight: screen?.scrollHeight ?? 0,
      };
    });
    expect(scrollHeight.sheetHeight).toBeGreaterThan(400);
  });
}