import { expect, test } from '@playwright/test';
import { fetchCharacterState, postGameAction } from './chapter-one-e2e-helpers.ts';
import { apiTelegramToken, signedTelegramInitData } from './telegram.ts';
import { E2E_TELEGRAM_ID } from './test-config.ts';

const API = 'http://127.0.0.1:8001';

test('cleric Bless sets concentration via API', async ({ request }, testInfo) => {
  const telegramId = E2E_TELEGRAM_ID.spellGameplay + testInfo.workerIndex;
  const token = await apiTelegramToken(request, signedTelegramInitData(telegramId));

  const cleric = await request
    .post(`${API}/characters`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: 'S32 Cleric',
        race: 'human',
        character_class: 'cleric',
        divine_domain: 'life',
        cantrips: ['Guidance', 'Sacred Flame', 'Spare the Dying'],
        level_one_spells: ['Bless', 'Cure Wounds', 'Healing Word', 'Shield of Faith'],
        abilities: { strength: 10, dexterity: 10, constitution: 12, intelligence: 8, wisdom: 15, charisma: 10 },
      },
    })
    .then(r => {
      expect(r.ok()).toBeTruthy();
      return r.json() as Promise<{ id: string }>;
    });

  await postGameAction(request, token, cleric.id, 'cast Bless');
  const state = await fetchCharacterState(request, token, cleric.id);
  expect(state.concentration_spell).toBe('Bless');
  expect((state.spell_slots?.['1'] ?? state.spell_slots?.[1] ?? 0) as number).toBeLessThan(2);
});

test('wizard Mage Armor changes AC', async ({ request }, testInfo) => {
  const telegramId = E2E_TELEGRAM_ID.spellGameplay + 10_000 + testInfo.workerIndex;
  const token = await apiTelegramToken(request, signedTelegramInitData(telegramId));

  const wizard = await request
    .post(`${API}/characters`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: 'S32 Wizard',
        race: 'human',
        character_class: 'wizard',
        cantrips: ['Fire Bolt', 'Mage Hand', 'Light'],
        level_one_spells: ['Magic Missile', 'Mage Armor', 'Burning Hands', 'Shield'],
        abilities: { strength: 8, dexterity: 14, constitution: 12, intelligence: 15, wisdom: 10, charisma: 8 },
      },
    })
    .then(r => {
      expect(r.ok()).toBeTruthy();
      return r.json() as Promise<{ id: string }>;
    });

  const before = await fetchCharacterState(request, token, wizard.id);
  const acBefore = before.armor_class as number;
  await postGameAction(request, token, wizard.id, 'cast Mage Armor');
  const after = await fetchCharacterState(request, token, wizard.id);
  expect(after.mage_armor_active).toBe(true);
  expect(after.armor_class as number).toBeGreaterThan(acBefore);
});
