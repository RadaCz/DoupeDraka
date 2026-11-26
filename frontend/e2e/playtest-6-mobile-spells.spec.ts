import { expect, test } from '@playwright/test';
import {
  mockTelegramWebApp,
  openCharacterCreation,
  signedTelegramInitData,
  STEP_BY_STEP_WIZARD_BTN,
  WIZARD_CONTINUE_BTN,
} from './telegram.ts';

const WIDTHS = [320, 375, 430] as const;

test.describe.configure({ mode: 'parallel' });

async function openWizardCs(page: import('@playwright/test').Page) {
  await page.addInitScript(() => localStorage.setItem('app_locale', 'cs'));
  await page.goto('/');
  await openCharacterCreation(page);
  await page.getByRole('button', { name: STEP_BY_STEP_WIZARD_BTN }).click();
}

async function reachSpellStep(page: import('@playwright/test').Page, classPattern: RegExp) {
  await page.getByRole('button', { name: /^Elf\b/i }).click();
  await page.getByRole('button', { name: WIZARD_CONTINUE_BTN }).click();
  await page.getByRole('button', { name: classPattern }).click();
  await page.getByRole('button', { name: WIZARD_CONTINUE_BTN }).click();
  await page.getByRole('button', { name: /mudrc|sage/i }).click();
  for (let i = 0; i < 4; i += 1) {
    await page.getByRole('button', { name: WIZARD_CONTINUE_BTN }).click();
  }
}

async function assertSpellPills(page: import('@playwright/test').Page) {
  const pills = page.locator('.option-pill:has(.wizard-spell-pill-label)');
  const count = await pills.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    const pill = pills.nth(i);
    const label = pill.locator('.wizard-spell-pill-label');
    const tag = pill.locator('.wizard-spell-tag-line');
    const pillWidth = await pill.evaluate(el => el.clientWidth);
    const labelWidth = await label.evaluate(el => el.scrollWidth);
    expect(labelWidth).toBeLessThanOrEqual(pillWidth + 1);
    if (await tag.count()) {
      const tagOneLine = await tag.evaluate(el => {
        const style = getComputedStyle(el);
        return style.whiteSpace === 'nowrap' || style.whiteSpace === 'pre';
      });
      expect(tagOneLine).toBe(true);
      const tagWidth = await tag.evaluate(el => el.scrollWidth);
      expect(tagWidth).toBeLessThanOrEqual(pillWidth + 1);
      const tagFont = await tag.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
      expect(tagFont).toBeGreaterThanOrEqual(12);
    }
  }
}

for (const width of WIDTHS) {
  test(`wizard spells fit inside pills (${width}px)`, async ({ page }) => {
    test.setTimeout(120_000);
    const telegramId = 901_000_000 + width;
    await page.setViewportSize({ width, height: 820 });
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await openWizardCs(page);
    await reachSpellStep(page, /^Čaroděj|Wizard/i);
    await assertSpellPills(page);
  });

  test(`cleric spells fit inside pills (${width}px)`, async ({ page }) => {
    test.setTimeout(120_000);
    const telegramId = 902_000_000 + width;
    await page.setViewportSize({ width, height: 820 });
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await openWizardCs(page);
    await reachSpellStep(page, /^Klerik|Cleric/i);
    await assertSpellPills(page);
  });
}