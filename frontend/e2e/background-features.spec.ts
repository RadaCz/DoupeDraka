import { expect, test } from '@playwright/test';
import { fetchCharacterState, postGameAction } from './chapter-one-e2e-helpers.ts';
import { apiTelegramToken, signedTelegramInitData } from './telegram.ts';

async function createHero(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  background: string,
  name: string,
  characterClass: 'cleric' | 'fighter',
  classSkills: string[],
) {
  const response = await request.post('http://127.0.0.1:8001/characters', {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      name,
      race: 'human',
      character_class: characterClass,
      background,
      class_skills: classSkills,
      abilities: { strength: 10, dexterity: 10, constitution: 14, intelligence: 12, wisdom: 15, charisma: 10 },
    },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json() as { id: string }).id;
}

test('Acolyte shelter and Criminal contact set engine flags', async ({ request }, testInfo) => {
  const base = 778_000_000 + testInfo.workerIndex * 2;

  const acolyteToken = await apiTelegramToken(request, signedTelegramInitData(base));
  const acolyteId = await createHero(request, acolyteToken, 'acolyte', 'Acolyte E2E', 'cleric', ['History', 'Persuasion']);
  for (const leg of ['travel to The Sunken Corridor', 'travel to The Shrine of the Forgotten']) {
    await postGameAction(request, acolyteToken, acolyteId, leg);
  }
  await postGameAction(request, acolyteToken, acolyteId, 'seek shelter of the faithful');
  const acolyte = await fetchCharacterState(request, acolyteToken, acolyteId);
  expect(acolyte.quest_flags?.bg_acolyte_shelter_used).toBe(true);
  expect(acolyte.quest_flags?.acolyte_shrine_sanctuary_lore).toBe(true);

  const criminalToken = await apiTelegramToken(request, signedTelegramInitData(base + 1));
  const criminalId = await createHero(request, criminalToken, 'criminal', 'Criminal E2E', 'fighter', ['Athletics', 'Insight']);
  for (const leg of [
    'travel to The Sunken Corridor',
    'travel to The Shrine of the Forgotten',
    'travel to The Goblin Market',
  ]) {
    await postGameAction(request, criminalToken, criminalId, leg);
  }
  await postGameAction(request, criminalToken, criminalId, 'use criminal contact');
  const criminal = await fetchCharacterState(request, criminalToken, criminalId);
  expect(criminal.quest_flags?.bg_criminal_contact_used).toBe(true);
  expect(criminal.quest_flags?.bell_market_rumor).toBe(true);
});
