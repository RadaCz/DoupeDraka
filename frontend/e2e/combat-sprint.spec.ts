import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { fetchCharacterState, postGameAction, startCellarCombat } from './chapter-one-e2e-helpers.ts';
import { apiTelegramToken, signedTelegramInitData } from './telegram.ts';
import { E2E_TELEGRAM_ID } from './test-config.ts';

const API = 'http://127.0.0.1:8001';

async function createFighter(request: Parameters<typeof test>[0]['request'], token: string, klass: string) {
  const created = await request.post(`${API}/characters`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      name: `Sprint ${klass}`,
      race: 'human',
      character_class: klass,
      abilities: {
        strength: 14,
        dexterity: 14,
        constitution: 12,
        intelligence: klass === 'wizard' ? 16 : 10,
        wisdom: klass === 'cleric' ? 16 : 10,
        charisma: 10,
      },
    },
  });
  expect(created.ok()).toBeTruthy();
  return (await created.json() as { id: string }).id;
}

test.describe.configure({ mode: 'serial' });

test('universal Sprint via API — fighter, cleric, wizard', async ({ request }, testInfo) => {
  test.setTimeout(240_000);
  const token = await apiTelegramToken(
    request,
    signedTelegramInitData(E2E_TELEGRAM_ID.classIdentity + 20_000 + testInfo.workerIndex),
  );

  for (const klass of ['fighter', 'cleric', 'wizard'] as const) {
    const id = await createFighter(request, token, klass);
    await startCellarCombat(request, token, id);
    const before = await fetchCharacterState(request, token, id);
    const moveBefore = before.combat_tactics?.movement_remaining_ft ?? before.combat_movement_remaining_ft ?? 0;
    const speed = before.combat_tactics?.speed_ft ?? before.speed ?? 30;

    await postGameAction(request, token, id, 'sprint');
    const after = await fetchCharacterState(request, token, id);
    expect(after.combat_flags?.action_used).toBe(true);
    const moveAfter = after.combat_tactics?.movement_remaining_ft ?? after.combat_movement_remaining_ft ?? 0;
    expect(moveAfter).toBeGreaterThanOrEqual(moveBefore + speed - 1);

    await postGameAction(request, token, id, 'end turn');
  }
});

test('Sprint idempotency key does not double movement', async ({ request }, testInfo) => {
  test.setTimeout(120_000);
  const token = await apiTelegramToken(
    request,
    signedTelegramInitData(E2E_TELEGRAM_ID.classIdentity + 30_000 + testInfo.workerIndex),
  );
  const id = await createFighter(request, token, 'fighter');
  await startCellarCombat(request, token, id);
  const key = randomUUID();
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': key,
  };
  const first = await request.post(`${API}/characters/${id}/actions`, { headers, data: { action: 'sprint' } });
  const second = await request.post(`${API}/characters/${id}/actions`, { headers, data: { action: 'sprint' } });
  expect(first.ok() && second.ok()).toBeTruthy();
  const moveA = (await first.json() as { character: { combat_movement_remaining_ft?: number } }).character
    .combat_movement_remaining_ft;
  const moveB = (await second.json() as { character: { combat_movement_remaining_ft?: number } }).character
    .combat_movement_remaining_ft;
  expect(moveA).toBe(moveB);
});