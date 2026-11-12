import { expect, test } from '@playwright/test';
import { fetchCharacterState, postGameAction } from './chapter-one-e2e-helpers.ts';
import { apiTelegramToken, signedTelegramInitData } from './telegram.ts';
import { E2E_TELEGRAM_ID } from './test-config.ts';

const API = 'http://127.0.0.1:8001';

test('wizard Shield is reaction-only outside combat window', async ({ request }, testInfo) => {
  const telegramId = E2E_TELEGRAM_ID.reactiveSpell + testInfo.workerIndex;
  const token = await apiTelegramToken(request, signedTelegramInitData(telegramId));

  const wizard = await request
    .post(`${API}/characters`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: 'S33 Wizard',
        race: 'human',
        character_class: 'wizard',
        cantrips: ['Fire Bolt', 'Mage Hand', 'Light'],
        level_one_spells: ['Magic Missile', 'Mage Armor', 'Shield', 'Sleep'],
        abilities: { strength: 8, dexterity: 14, constitution: 12, intelligence: 15, wisdom: 10, charisma: 8 },
      },
    })
    .then(r => {
      expect(r.ok()).toBeTruthy();
      return r.json() as Promise<{ id: string }>;
    });

  const before = await fetchCharacterState(request, token, wizard.id);
  const slotsBefore = (before.spell_slots?.['1'] ?? before.spell_slots?.[1] ?? 0) as number;
  const cast = await postGameAction(request, token, wizard.id, 'cast Shield');
  expect(cast.ok()).toBeTruthy();
  const body = (await cast.json()) as { events?: string[] };
  const blob = (body.events ?? []).join(' ').toLowerCase();
  expect(blob).toContain('reaction');
  const after = await fetchCharacterState(request, token, wizard.id);
  const slotsAfter = (after.spell_slots?.['1'] ?? after.spell_slots?.[1] ?? 0) as number;
  expect(slotsAfter).toBe(slotsBefore);
});
