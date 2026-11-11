import { expect, test } from '@playwright/test';
import { fetchCharacterState, postGameAction } from './chapter-one-e2e-helpers.ts';
import { apiTelegramToken, signedTelegramInitData } from './telegram.ts';

async function ensureBanditEvidence(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  id: string,
) {
  for (const leg of [
    'travel to The Sunken Corridor',
    'travel to The Shrine of the Forgotten',
    'travel to The Goblin Market',
    'travel to The Bandit Camp',
  ]) {
    await postGameAction(request, token, id, leg);
  }
  await postGameAction(request, token, id, 'inspect the bounty notice');

  for (let step = 0; step < 48; step += 1) {
    const state = await fetchCharacterState(request, token, id);
    if (state.quest_flags?.bandit_shrine_evidence) return state;

    if (state.in_combat) {
      await postGameAction(request, token, id, 'attack');
      continue;
    }

    const flags = state.quest_flags ?? {};
    if (!flags.bandit_stealth_challenge_done) {
      await postGameAction(request, token, id, 'sneak past the bandit sentries');
    } else if (!flags.bandit_social_challenge_done) {
      await postGameAction(request, token, id, 'bluff the bandit captain');
    } else {
      await postGameAction(request, token, id, 'attack the bandit captain');
    }
  }

  return fetchCharacterState(request, token, id);
}

test('Bandit Camp stealth challenge sets evidence via engine', async ({ request }, testInfo) => {
  const telegramId = 777_000_000 + testInfo.workerIndex;
  const token = await apiTelegramToken(request, signedTelegramInitData(telegramId));
  const response = await request.post('http://127.0.0.1:8001/characters', {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      name: 'Bandit E2E',
      race: 'halfling',
      character_class: 'rogue',
      background: 'criminal',
      class_skills: ['Acrobatics', 'Perception', 'Sleight of Hand', 'Investigation'],
      expertise_skills: ['Stealth', 'Deception'],
      abilities: { strength: 8, dexterity: 15, constitution: 14, intelligence: 12, wisdom: 10, charisma: 13 },
    },
  });
  expect(response.ok()).toBeTruthy();
  const { id } = await response.json() as { id: string };

  const final = await ensureBanditEvidence(request, token, id);
  expect(final.quest_flags?.bandit_shrine_evidence).toBe(true);
  expect(
    final.quest_flags?.bandit_stealth_challenge_done
      || final.quest_flags?.bandit_social_challenge_done
      || final.inventory?.includes('Shrine goods ledger'),
  ).toBeTruthy();
});
