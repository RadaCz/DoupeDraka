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
const OUT_DIR = join(repoRoot, 'docs', 'pr-screenshots', 'playtest-5');
const WIDTHS = [320, 375, 430] as const;
const phase = process.env.PLAYTEST5_SHOT_PHASE === 'before' ? 'before' : 'after';

test.describe.configure({ mode: 'serial' });

async function openWizardCs(page: import('@playwright/test').Page) {
  await page.addInitScript(() => localStorage.setItem('app_locale', 'cs'));
  await page.goto('/');
  await openCharacterCreation(page);
  await page.getByRole('button', { name: STEP_BY_STEP_WIZARD_BTN }).click();
}

for (const width of WIDTHS) {
  test(`${phase} spells ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    mkdirSync(OUT_DIR, { recursive: true });
    const telegramId = 886_000_000 + width;
    await page.setViewportSize({ width, height: 820 });
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await openWizardCs(page);
    await page.getByRole('button', { name: /^Elf\b/i }).click();
    await page.getByRole('button', { name: WIZARD_CONTINUE_BTN }).click();
    await page.getByRole('button', { name: /^Čaroděj|Wizard/i }).click();
    await page.getByRole('button', { name: WIZARD_CONTINUE_BTN }).click();
    await page.getByRole('button', { name: /mudrc|sage/i }).click();
    for (let i = 0; i < 4; i += 1) {
      await page.getByRole('button', { name: WIZARD_CONTINUE_BTN }).click();
    }
    await expect(page.locator('.wizard-spell-tag-line').first()).toBeVisible();
    const file = `${phase}-spells-${width}px.png`;
    await page.screenshot({ path: join(OUT_DIR, file), fullPage: true });
    await testInfo.attach(file, { path: join(OUT_DIR, file), contentType: 'image/png' });
  });
}

for (const width of WIDTHS) {
  test(`${phase} races ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    mkdirSync(OUT_DIR, { recursive: true });
    const telegramId = 887_000_000 + width;
    await page.setViewportSize({ width, height: 820 });
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await openWizardCs(page);
    await page.locator('.race-grid .selection-card').last().scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /^Trpaslík|Dwarf/i }).click();
    const file = `${phase}-races-${width}px.png`;
    await page.screenshot({ path: join(OUT_DIR, file), fullPage: true });
    await testInfo.attach(file, { path: join(OUT_DIR, file), contentType: 'image/png' });
  });
}

for (const width of WIDTHS) {
  test(`${phase} backstory ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    mkdirSync(OUT_DIR, { recursive: true });
    const telegramId = 888_000_000 + width;
    await page.setViewportSize({ width, height: 820 });
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await openWizardCs(page);
    await page.getByRole('button', { name: /^Člověk|Human/i }).click();
    await page.getByRole('button', { name: WIZARD_CONTINUE_BTN }).click();
    await page.getByRole('button', { name: /^Bojovník|Fighter/i }).click();
    await page.getByRole('button', { name: WIZARD_CONTINUE_BTN }).click();
    await page.getByRole('button', { name: /lidový hrdina|folk hero/i }).click();
    for (let i = 0; i < 4; i += 1) {
      await page.getByRole('button', { name: WIZARD_CONTINUE_BTN }).click();
    }
    const backstory = page.locator('#hero-backstory');
    await backstory.scrollIntoViewIfNeeded();
    await backstory.fill('Vyrůstal jsem v údolí pod Starým mostem.');
    const file = `${phase}-backstory-${width}px.png`;
    await page.screenshot({ path: join(OUT_DIR, file), fullPage: true });
    await testInfo.attach(file, { path: join(OUT_DIR, file), contentType: 'image/png' });
  });
}

for (const width of WIDTHS) {
  test(`${phase} continue ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    mkdirSync(OUT_DIR, { recursive: true });
    const telegramId = 889_000_000 + width;
    await page.setViewportSize({ width, height: 820 });
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await openWizardCs(page);
    await page.getByRole('button', { name: /^Elf\b/i }).click();
    const cont = page.locator('.wizard-next.primary');
    await cont.scrollIntoViewIfNeeded();
    const file = `${phase}-continue-${width}px.png`;
    await page.screenshot({ path: join(OUT_DIR, file), fullPage: true });
    await testInfo.attach(file, { path: join(OUT_DIR, file), contentType: 'image/png' });
  });
}

for (const width of WIDTHS) {
  test(`${phase} character-darkvision ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    mkdirSync(OUT_DIR, { recursive: true });
    const telegramId = 890_000_000 + width;
    await page.setViewportSize({ width, height: 820 });
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
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
    await page.getByLabel(/jmeno postavy|jméno postavy|character name/i).fill(`Elf ${width}`);
    await page.getByRole('button', { name: WIZARD_CONTINUE_BTN }).click();
    await expect(page.getByRole('heading', { name: MEET_ADVENTURER_HEADING })).toBeVisible();
    await page.getByRole('button', { name: ENTER_ADVENTURE_BTN }).click();
    await page.getByRole('heading', { name: CELLAR_HEADING }).waitFor();
    await page.getByRole('navigation', { name: /hlavní navigace|main navigation/i })
      .getByRole('button', { name: /^Postava$|^Character$/i })
      .click();
    await expect(page.getByRole('heading', { name: /rasové vlastnosti/i })).toBeVisible();
    const file = `${phase}-character-darkvision-${width}px.png`;
    await page.screenshot({ path: join(OUT_DIR, file), fullPage: true });
    await testInfo.attach(file, { path: join(OUT_DIR, file), contentType: 'image/png' });
  });
}