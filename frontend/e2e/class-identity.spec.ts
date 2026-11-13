import { expect, test } from '@playwright/test';
import {
  ensureLevelAtLeast,
  fetchCharacterState,
  postGameAction,
  reviveIfFallen,
  startCellarCombat,
} from './chapter-one-e2e-helpers.ts';
import { apiTelegramToken, signedTelegramInitData } from './telegram.ts';
import { E2E_TELEGRAM_ID } from './test-config.ts';

const API = 'http://127.0.0.1:8001';

async function createHero(
  request: Parameters<typeof postGameAction>[0],
  token: string,
  body: Record<string, unknown>,
) {
  const response = await request.post(`${API}/characters`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: body,
  });
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<{ id: string; hp: number; max_hp: number }>;
}

test.describe.configure({ mode: 'serial' });

test('Sprint 21 class identity — engine outcomes & reload', async ({ request }, testInfo) => {
  test.setTimeout(240_000);
  const telegramId = E2E_TELEGRAM_ID.classIdentity + testInfo.workerIndex;
  const initData = signedTelegramInitData(telegramId);
  const token = await apiTelegramToken(request, initData);

  const fighter = await createHero(request, token, {
    name: 'S21 Fighter',
    race: 'human',
    character_class: 'fighter',
    fighting_style: 'defense',
    abilities: { strength: 15, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 8 }, // standard array
  });

  const rogue = await createHero(request, token, {
    name: 'S21 Rogue',
    race: 'halfling',
    character_class: 'rogue',
    background: 'criminal',
    class_skills: ['Acrobatics', 'Perception', 'Sleight of Hand', 'Investigation'],
    expertise_skills: ['Acrobatics', 'Perception'],
    abilities: { strength: 8, dexterity: 15, constitution: 14, intelligence: 12, wisdom: 10, charisma: 13 },
  });

  const cleric = await createHero(request, token, {
    name: 'S21 Cleric',
    race: 'dwarf',
    character_class: 'cleric',
    divine_domain: 'life',
    cantrips: ['Guidance', 'Sacred Flame', 'Spare the Dying'],
    level_one_spells: ['Healing Word', 'Shield of Faith', 'Cure Wounds', 'Bless'],
    abilities: { strength: 14, dexterity: 10, constitution: 13, intelligence: 8, wisdom: 15, charisma: 12 },
  });

  const wizard = await createHero(request, token, {
    name: 'S21 Wizard',
    race: 'elf',
    character_class: 'wizard',
    cantrips: ['Fire Bolt', 'Mage Hand', 'Light'],
    level_one_spells: [
      'Magic Missile',
      'Shield',
      'Burning Hands',
      'Mage Armor',
    ],
    abilities: { strength: 8, dexterity: 14, constitution: 12, intelligence: 15, wisdom: 10, charisma: 13 },
  });

  await startCellarCombat(request, token, fighter.id, 'goblin scout');
  await expect.poll(async () => {
    const s = await fetchCharacterState(request, token, fighter.id);
    return Boolean(s.in_combat);
  }, { timeout: 60_000 }).toBe(true);
  let fState = await fetchCharacterState(request, token, fighter.id);
  for (let round = 0; round < 12 && (fState.hp ?? 0) >= (fState.max_hp ?? fighter.max_hp); round += 1) {
    await postGameAction(request, token, fighter.id, 'defend');
    fState = await fetchCharacterState(request, token, fighter.id);
  }
  const hpBefore = fState.hp ?? 1;
  const maxHp = fState.max_hp ?? fighter.max_hp;
  await postGameAction(request, token, fighter.id, 'second wind');
  fState = await fetchCharacterState(request, token, fighter.id);
  expect(fState.second_wind_available).toBe(false);
  if (hpBefore < maxHp) {
    expect(fState.hp).toBeGreaterThan(hpBefore);
  }

  await ensureLevelAtLeast(request, token, rogue.id, 2, 40);
  await postGameAction(request, token, rogue.id, 'attack goblin scout');
  await postGameAction(request, token, rogue.id, 'hide');
  await postGameAction(request, token, rogue.id, 'attack goblin scout');

  await postGameAction(request, token, cleric.id, 'cast Cure Wounds');
  const cState = await fetchCharacterState(request, token, cleric.id);
  expect(cState.prepared_spells).toEqual(expect.arrayContaining(['Bless', 'Cure Wounds']));

  // Spend a modeled L1 slot outside the attack/end-turn race (G-09 modeled pool).
  await postGameAction(request, token, wizard.id, 'cast Mage Armor');
  let wState = await fetchCharacterState(request, token, wizard.id);
  expect(wState.mage_armor_active).toBe(true);
  const slots = wState.spell_slots ?? {};
  const spentSlot = slots['1'] ?? slots[1] ?? 2;
  expect(spentSlot).toBeLessThan(2);

  await postGameAction(request, token, wizard.id, 'take a breather');
  wState = await fetchCharacterState(request, token, wizard.id);
  expect(wState.arcane_recovery_ready).toBe(true);
  const afterShort = wState.spell_slots ?? {};
  expect(afterShort['1'] ?? afterShort[1]).toBe(spentSlot);

  await postGameAction(request, token, wizard.id, 'arcane recovery');
  wState = await fetchCharacterState(request, token, wizard.id);
  const recovered = wState.spell_slots ?? {};
  expect(recovered['1'] ?? recovered[1]).toBe(2);
  expect(wState.arcane_recovery_available).toBe(false);
  expect((wState.known_spells ?? []).length).toBeGreaterThanOrEqual(6);

  for (const id of [fighter.id, rogue.id, cleric.id, wizard.id]) {
    const reloaded = await fetchCharacterState(request, token, id);
    await reviveIfFallen(request, token, id);
    const marker =
      reloaded.fighting_style
      || reloaded.divine_domain
      || (Array.isArray(reloaded.expertise_skills) && reloaded.expertise_skills.length > 0)
      || (Array.isArray(reloaded.known_spells) && reloaded.known_spells.length > 0);
    expect(marker).toBeTruthy();
  }
});
