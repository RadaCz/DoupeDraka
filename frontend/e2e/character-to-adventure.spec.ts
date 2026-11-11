import { expect, test } from '@playwright/test';
import {
  ACTION_TEXTBOX,
  CELLAR_HEADING,
  SEND_ACTION_BTN,
  completeCharacterWizard,
  completeWizardWizardCaster,
  mockTelegramWebApp,
  playStreamResponse,
  signedTelegramInitData,
  waitForAdventureComposerIdle,
  waitForAdventureComposerReady,
} from './telegram.ts';
import { E2E_TELEGRAM_ID } from './test-config.ts';

const CLASS_BUILDS = [
  { label: 'Fighter', name: 'Bren FC', race: 'Human', characterClass: 'Fighter', background: 'Folk Hero', sheetSkill: /Athletics/i },
  { label: 'Rogue', name: 'Shade RK', race: 'Halfling', characterClass: 'Rogue', background: 'Criminal', sheetSkill: /Stealth/i },
  { label: 'Cleric', name: 'Mira CL', race: 'Dwarf', characterClass: 'Cleric', background: 'Acolyte', sheetSpellName: 'Bless' },
  { label: 'Wizard', name: 'Lyra WZ', useElfWizardPath: true as const },
] as const;

test.describe.configure({ mode: 'serial' });

for (const build of CLASS_BUILDS) {
  test(`${build.label}: create hero, sheet, and first Chapter One turn`, async ({ page }, testInfo) => {
    const telegramId = E2E_TELEGRAM_ID.characterToAdventure + testInfo.workerIndex * 10 + CLASS_BUILDS.indexOf(build);
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await page.goto('/');

    if ('useElfWizardPath' in build && build.useElfWizardPath) {
      await completeWizardWizardCaster(page, build.name);
    } else {
      await completeCharacterWizard(page, {
        name: build.name,
        race: build.race!,
        characterClass: build.characterClass!,
        background: build.background!,
      });
    }

    await expect(page.getByRole('heading', { name: CELLAR_HEADING })).toBeVisible({ timeout: 30_000 });
    const nav = page.getByRole('navigation', { name: /Main navigation|Hlavní navigace/i });
    await nav.getByRole('button', { name: /^Character$|^Postava$/i }).click();
    await expect(page.getByRole('heading', { name: build.name })).toBeVisible();
    await expect(page.getByText(/Combat basics|Základy boje/i)).toBeVisible();
    await expect(page.getByText(/Proficiency bonus|Bonus zdatnosti/i)).toBeVisible();
    if ('sheetSkill' in build && build.sheetSkill) {
      await expect(page.getByText(build.sheetSkill)).toBeVisible();
    }
    if ('sheetSpellName' in build && build.sheetSpellName) {
      await expect(page.locator('.char-v2-spell-list').getByText(build.sheetSpellName, { exact: true })).toBeVisible();
    }
    if ('useElfWizardPath' in build && build.useElfWizardPath) {
      await expect(page.getByRole('heading', { name: /Spells & abilities/i })).toBeVisible();
      await expect(page.getByText(/Known/i).first()).toBeVisible();
    }

    await nav.getByRole('button', { name: /^Adventure$|^Hra$/i }).click();
    await waitForAdventureComposerReady(page);
    const journal = page.getByRole('log', { name: /Adventure journal|Dobrodružný deník/i });
    const streamDone = playStreamResponse(page);
    await page.getByRole('textbox', { name: ACTION_TEXTBOX }).fill('inspect the old door');
    await page.getByRole('button', { name: SEND_ACTION_BTN }).click();
    await streamDone;
    await waitForAdventureComposerIdle(page);
    await expect(journal).toContainText(/inspect|door|dveř/i, { timeout: 45_000 });
  });
}
