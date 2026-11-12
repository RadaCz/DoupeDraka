import { expect, test } from '@playwright/test';
import { fetchCharacterState, postGameAction } from './chapter-one-e2e-helpers.ts';
import { apiTelegramToken, signedTelegramInitData } from './telegram.ts';
import { E2E_TELEGRAM_ID } from './test-config.ts';

const API = 'http://127.0.0.1:8001';

test('fighter cast attempt does not spend resources', async ({ request }, testInfo) => {
  const telegramId = E2E_TELEGRAM_ID.spellIntegrity + testInfo.workerIndex;
  const initData = signedTelegramInitData(telegramId);
  const token = await apiTelegramToken(request, initData);

  const fighter = await request
    .post(`${API}/characters`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: 'S31 Fighter',
        race: 'human',
        character_class: 'fighter',
        fighting_style: 'defense',
        abilities: { strength: 15, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 8 },
      },
    })
    .then(r => {
      expect(r.ok()).toBeTruthy();
      return r.json() as Promise<{ id: string }>;
    });

  const before = await fetchCharacterState(request, token, fighter.id);
  expect(before.spell_slots ?? {}).toEqual({});

  await postGameAction(request, token, fighter.id, 'cast Fire Bolt');
  const after = await fetchCharacterState(request, token, fighter.id);
  expect(after.spell_slots ?? {}).toEqual({});
});

test('cleric Sacred Flame consumes no slot on cantrip', async ({ request }, testInfo) => {
  const telegramId = E2E_TELEGRAM_ID.spellIntegrity + 10_000 + testInfo.workerIndex;
  const initData = signedTelegramInitData(telegramId);
  const token = await apiTelegramToken(request, initData);

  const cleric = await request
    .post(`${API}/characters`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: 'S31 Cleric',
        race: 'dwarf',
        character_class: 'cleric',
        divine_domain: 'life',
        cantrips: ['Sacred Flame', 'Guidance', 'Spare the Dying'],
        level_one_spells: ['Cure Wounds', 'Bless', 'Healing Word', 'Sanctuary'],
        abilities: { strength: 10, dexterity: 10, constitution: 12, intelligence: 8, wisdom: 15, charisma: 10 },
      },
    })
    .then(r => {
      expect(r.ok()).toBeTruthy();
      return r.json() as Promise<{ id: string }>;
    });

  await postGameAction(request, token, cleric.id, 'attack goblin scout');
  await expect.poll(async () => {
    const s = await fetchCharacterState(request, token, cleric.id);
    return Boolean(s.in_combat);
  }).toBe(true);

  const before = await fetchCharacterState(request, token, cleric.id);
  const slotsBefore = before.spell_slots?.['1'] ?? before.spell_slots?.[1] ?? 2;

  await postGameAction(request, token, cleric.id, 'cast Sacred Flame');
  const after = await fetchCharacterState(request, token, cleric.id);
  const slotsAfter = after.spell_slots?.['1'] ?? after.spell_slots?.[1] ?? 2;
  expect(slotsAfter).toBe(slotsBefore);
});
