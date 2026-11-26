import { expect, test } from '@playwright/test';
import {
  mockTelegramWebApp,
  openCharacterCreation,
  signedTelegramInitData,
  STEP_BY_STEP_WIZARD_BTN,
  WIZARD_CONTINUE_BTN,
} from './telegram.ts';

const WIDTHS = [320, 375, 430] as const;
const STORY_SPELL_LABEL = /jen v příběhu|story only in play/i;

test.describe.configure({ mode: 'parallel' });

async function openWizardCs(page: import('@playwright/test').Page) {
  await page.addInitScript(() => localStorage.setItem('app_locale', 'cs'));
  await page.goto('/');
  await openCharacterCreation(page);
  await page.getByRole('button', { name: STEP_BY_STEP_WIZARD_BTN }).click();
}

for (const width of WIDTHS) {
  test(`spell narrative tag stays inside pill @ ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const telegramId = 881_000_000 + width;
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
    const pillWithTag = page.locator('.option-pill:has(.wizard-spell-tag-line)').first();
    await expect(pillWithTag).toBeVisible();
    const tag = pillWithTag.locator('.wizard-spell-tag-line');
    await expect(tag).toContainText(STORY_SPELL_LABEL);
    const pillBox = await pillWithTag.boundingBox();
    const tagBox = await tag.boundingBox();
    expect(pillBox).toBeTruthy();
    expect(tagBox).toBeTruthy();
    expect(tagBox!.x).toBeGreaterThanOrEqual(pillBox!.x - 1);
    expect(tagBox!.y).toBeGreaterThanOrEqual(pillBox!.y - 1);
    expect(tagBox!.x + tagBox!.width).toBeLessThanOrEqual(pillBox!.x + pillBox!.width + 1);
    expect(tagBox!.y + tagBox!.height).toBeLessThanOrEqual(pillBox!.y + pillBox!.height + 1);
    const tagFont = await tag.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect(tagFont).toBeGreaterThanOrEqual(12);
  });

  test(`race bonus badges match height across playable races @ ${width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    const telegramId = 882_000_000 + width;
    await page.setViewportSize({ width, height: 820 });
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await openWizardCs(page);
    const badges = page.locator('.race-grid .race-ability-badge');
    await expect(badges.first()).toBeVisible();
    const count = await badges.count();
    expect(count).toBeGreaterThan(4);
    const heights = await badges.evaluateAll(nodes =>
      nodes.map(node => node.getBoundingClientRect().height),
    );
    const rounded = heights.map(h => Math.round(h * 2) / 2);
    const uniq = [...new Set(rounded)];
    expect(uniq.length).toBe(1);
    for (const badge of await badges.all()) {
      await expect(badge).toHaveClass(/race-ability-badge/);
    }
  });

  test(`continue button clears safe-area bottom @ ${width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    const telegramId = 883_000_000 + width;
    await page.setViewportSize({ width, height: 820 });
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await openWizardCs(page);
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--e2e-safe-bottom', '34px');
    });
    await page.getByRole('button', { name: /^Člověk|Human/i }).click();
    const cont = page.locator('.wizard-next.primary');
    await cont.scrollIntoViewIfNeeded();
    const metrics = await page.evaluate(() => {
      const btn = document.querySelector('.wizard-next.primary');
      const viewport = window.innerHeight;
      if (!btn) return null;
      const rect = btn.getBoundingClientRect();
      const padBottom = parseFloat(getComputedStyle(btn).paddingBottom) || 0;
      return { rectBottom: rect.bottom, viewport, padBottom };
    });
    expect(metrics).toBeTruthy();
    expect(metrics!.padBottom).toBeGreaterThanOrEqual(44);
    expect(metrics!.rectBottom).toBeLessThanOrEqual(metrics!.viewport + 2);
    const box = await cont.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test(`race card scroll margin keeps card below header @ ${width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    const telegramId = 884_000_000 + width;
    await page.setViewportSize({ width, height: 640 });
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await openWizardCs(page);
    const lastRace = page.locator('.race-grid .selection-card').last();
    await lastRace.scrollIntoViewIfNeeded();
    await lastRace.click();
    const headerBottom = await page.evaluate(() => {
      const header = document.querySelector('.app-header');
      return header ? header.getBoundingClientRect().bottom : 0;
    });
    const cardTop = await lastRace.evaluate(el => el.getBoundingClientRect().top);
    expect(cardTop).toBeGreaterThanOrEqual(headerBottom - 2);
    const scrollMargin = await lastRace.evaluate(el => parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
    expect(scrollMargin).toBeGreaterThan(50);
  });

  test(`backstory caret not overlapping glyph bounds @ ${width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    const telegramId = 885_000_000 + width;
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
    await backstory.fill('Na cestě od Brodu.');
    const caretGap = await backstory.evaluate(el => {
      const style = getComputedStyle(el);
      const lineHeight = parseFloat(style.lineHeight);
      const padTop = parseFloat(style.paddingTop);
      const fontSize = parseFloat(style.fontSize);
      const minHeight = parseFloat(style.minHeight);
      return { lineHeight, padTop, fontSize, minHeight, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
    });
    expect(caretGap.fontSize).toBeGreaterThanOrEqual(14);
    expect(caretGap.minHeight).toBeGreaterThan(caretGap.lineHeight + caretGap.padTop);
    expect(caretGap.clientHeight).toBeGreaterThanOrEqual(caretGap.lineHeight * 2);
    expect(caretGap.scrollHeight).toBeLessThanOrEqual(caretGap.clientHeight + 4);
  });
}