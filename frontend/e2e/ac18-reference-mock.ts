import type { Page, Route } from '@playwright/test';

const RULESET_PATCH = {
  max_level: 3,
  xp_per_level: 100,
  edition: 'SRD 5.1',
  label: 'DoupěDraka Ruleset v1',
  mvp_races: ['dwarf', 'elf', 'halfling', 'human'],
  mvp_classes: ['cleric', 'fighter', 'rogue', 'wizard'],
  notes: 'Chapter 1 level cap for e2e.',
};

/** Ensures `GET /reference` (not spells) includes `ruleset` for XP cap UI. */
export async function installMvpRulesetReferenceMock(page: Page) {
  await page.route('**/reference**', async (route: Route) => {
    const url = route.request().url();
    const isCatalog = /\/reference(?:\?|$)/.test(url) && !url.includes('/reference/spells');
    if (route.request().method() !== 'GET' || !isCatalog) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const body = await response.json() as Record<string, unknown>;
    const ruleset = (body.ruleset && typeof body.ruleset === 'object'
      ? body.ruleset
      : {}) as Record<string, unknown>;
    await route.fulfill({
      response,
      json: {
        ...body,
        ruleset: { ...ruleset, ...RULESET_PATCH },
      },
    });
  });
}