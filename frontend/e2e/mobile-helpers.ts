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

export async function assertJournalScrolledToLatest(page: Page) {
  await expect.poll(async () => page.evaluate(() => {
    const journal = document.querySelector('.journal-scene');
    const beats = journal?.querySelectorAll('.journal-beat');
    const last = beats?.[beats.length - 1] as HTMLElement | undefined;
    if (!journal || !last || beats!.length === 0) return false;
    const journalRect = journal.getBoundingClientRect();
    const lastRect = last.getBoundingClientRect();
    const pinnedToBottom = journal.scrollTop + journal.clientHeight >= journal.scrollHeight - 12;
    const lastVisible = lastRect.bottom <= journalRect.bottom + 4
      && lastRect.top >= journalRect.top - 4;
    return pinnedToBottom && lastVisible;
  })).toBe(true);
}
