import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/** Approximate software keyboard shrinking the visual viewport on mobile WebViews. */
export const MOBILE_KEYBOARD_VIEWPORT_RATIO = 0.52;

export async function simulateMobileKeyboard(page: Page) {
  const size = page.viewportSize();
  if (!size) return;
  await page.setViewportSize({
    width: size.width,
    height: Math.max(320, Math.round(size.height * MOBILE_KEYBOARD_VIEWPORT_RATIO)),
  });
}

export async function assertLocatorInPageViewport(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = locator.page().viewportSize();
  expect(box).toBeTruthy();
  expect(viewport).toBeTruthy();
  expect(box!.y).toBeGreaterThanOrEqual(-1);
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 2);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 2);
}

export async function assertComposerAboveBottomNav(page: Page) {
  await expect.poll(async () => page.evaluate(() => {
    const nav = document.querySelector('.bottom-nav');
    const composer = document.querySelector('.action-composer-text-first');
    const input = document.getElementById('adventure-action-input');
    const send = document.querySelector('.composer-send');
    if (!nav || !composer || !input || !send) return false;
    const navTop = nav.getBoundingClientRect().top;
    const composerBottom = composer.getBoundingClientRect().bottom;
    const inputBottom = input.getBoundingClientRect().bottom;
    const sendBottom = send.getBoundingClientRect().bottom;
    return composerBottom <= navTop + 2
      && inputBottom <= navTop + 2
      && sendBottom <= navTop + 2;
  })).toBe(true);
}

export async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth + 2;
  });
  expect(overflow).toBe(false);
}

export async function assertBottomNavVisible(page: Page) {
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav).toBeVisible();
  const box = await nav.boundingBox();
  const viewport = page.viewportSize();
  expect(box).toBeTruthy();
  expect(viewport).toBeTruthy();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.width).toBeLessThanOrEqual(viewport!.width + 2);
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  // Fixed bottom nav: lower edge should align with the viewport, not the document scroll height.
  const bottomGap = viewport!.height - (box!.y + box!.height);
  expect(bottomGap, `bottom nav should stick to viewport bottom (gap=${bottomGap})`).toBeLessThanOrEqual(4);
}

export async function assertPlayStoryFillsMiddle(page: Page) {
  await expect.poll(async () => page.evaluate(() => {
    const story = document.querySelector('.game-play-story');
    const bar = document.querySelector('.play-immersive-bar');
    const composer = document.querySelector('.action-composer-wrap');
    const nav = document.querySelector('.bottom-nav');
    if (!story || !bar || !composer || !nav) return false;
    const barBox = bar.getBoundingClientRect();
    const storyBox = story.getBoundingClientRect();
    const composerBox = composer.getBoundingClientRect();
    const navBox = nav.getBoundingClientRect();
    const gapAbove = storyBox.top - barBox.bottom;
    const gapBelow = composerBox.top - storyBox.bottom;
    return storyBox.height >= 80 && gapAbove >= -2 && gapBelow >= -4 && storyBox.bottom <= composerBox.top + 2;
  })).toBe(true);
}

export async function assertJournalScrolledToLatest(page: Page) {
  await expect.poll(async () => page.evaluate(() => {
    const journal = document.querySelector('.journal-scene');
    const beats = journal?.querySelectorAll('.journal-beat');
    const last = beats?.[beats.length - 1] as HTMLElement | undefined;
    if (!journal || !last || beats!.length === 0) return false;
    const journalRect = journal.getBoundingClientRect();
    const lastRect = last.getBoundingClientRect();
    const pinnedToBottom = journal.scrollTop + journal.clientHeight >= journal.scrollHeight - 24;
    const lastVisible = lastRect.bottom <= journalRect.bottom + 8
      && lastRect.top >= journalRect.top - 24;
    return pinnedToBottom || lastVisible;
  })).toBe(true);
}
