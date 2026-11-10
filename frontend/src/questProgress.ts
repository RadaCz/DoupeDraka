import type { QuestCatalog } from './types';

export type QuestStepId =
  | 'bell_quest_accepted'
  | 'bell_acquired'
  | 'bell_quest_complete'
  | 'vault_hint_given'
  | 'vault_first_descent'
  | 'chapter_one_complete';

export interface QuestStep {
  id: QuestStepId | string;
  label: string;
  hint: string;
  location?: string;
}

export function questStepsFromCatalog(questCatalog?: QuestCatalog): QuestStep[] | undefined {
  const campaign = questCatalog?.campaigns?.[0];
  if (!campaign?.steps?.length) return undefined;
  return campaign.steps.map(step => ({
    id: step.id,
    label: step.label,
    hint: step.hint,
    location: step.location ?? undefined,
  }));
}

const CHAPTER_ONE_STEPS: QuestStep[] = [
  {
    id: 'bell_quest_accepted',
    label: 'Recover the stolen shrine bell',
    hint: 'At the Shrine of the Forgotten, talk to Caldus about the bell.',
    location: 'The Shrine of the Forgotten',
  },
  {
    id: 'bell_acquired',
    label: 'Obtain the bell from Nib',
    hint: 'Travel to the Goblin Market and ask Nib about the shrine bell.',
    location: 'The Goblin Market',
  },
  {
    id: 'bell_quest_complete',
    label: 'Return the bell to Caldus',
    hint: 'Return to the shrine and give the bell back to Caldus.',
    location: 'The Shrine of the Forgotten',
  },
  {
    id: 'vault_hint_given',
    label: 'Learn about the Vault of Echoes',
    hint: 'Return to the Shrine of the Forgotten and speak with Caldus again. After the bell is returned, he reveals the path to the Vault of Echoes.',
    location: 'The Shrine of the Forgotten',
  },
  {
    id: 'vault_first_descent',
    label: 'Brave the Vault of Echoes',
    hint: 'Travel into the vault — survive the first descent and grow strong enough (at least level 3) before the Bell Warden.',
    location: 'The Vault of Echoes',
  },
  {
    id: 'chapter_one_complete',
    label: 'Defeat the Bell Warden',
    hint: "Enter the Bell Warden's Pit when you are at least level 3, then face the Warden.",
    location: "The Bell Warden's Pit",
  },
];

function stepDone(id: QuestStepId, flags: Record<string, boolean>) {
  if (flags.chapter_one_complete) return true;
  if (id === 'bell_acquired') return Boolean(flags.bell_acquired || flags.bell_found);
  if (id === 'vault_hint_given') {
    return Boolean(flags.vault_hint_given || flags.vault_unlocked || flags.chapter_one_complete);
  }
  if (id === 'vault_first_descent') {
    return Boolean(flags.vault_first_descent_story_awarded || flags.chapter_one_complete);
  }
  return Boolean(flags[id]);
}

export function chapterOneQuestProgress(
  flags: Record<string, boolean> = {},
  stepSource: QuestStep[] = CHAPTER_ONE_STEPS,
) {
  const steps = stepSource.map(step => ({
    ...step,
    status: stepDone(step.id, flags) ? 'done' as const : 'open' as const,
  }));
  for (const step of steps) {
    if (step.status === 'open') {
      return { steps, next: step };
    }
  }
  return { steps, next: null as QuestStep | null };
}

/** Player-visible steps only — no spoilers for future objectives. */
export function visibleQuestTimeline(
  flags: Record<string, boolean> = {},
  stepSource: QuestStep[] = CHAPTER_ONE_STEPS,
) {
  const { steps, next } = chapterOneQuestProgress(flags, stepSource);
  const done = steps.filter(step => step.status === 'done');
  if (!next) {
    return { done, active: null as QuestStep | null, teaser: null as string | null };
  }
  const quests = flags;
  let active = { ...next };
  let teaser: string | null = null;
  if (!quests.bell_quest_accepted) {
    active = {
      ...next,
      label: 'Find out what happened to the shrine bell',
      hint: 'Explore the cellar and follow clues deeper underground.',
      location: undefined,
    };
    teaser = 'Further objectives unlock as you meet people along the way.';
  } else if (
    next.id === 'vault_hint_given' &&
    quests.bell_quest_complete &&
    !quests.vault_hint_given &&
    !quests.vault_unlocked
  ) {
    active = {
      ...next,
      hint: 'Return to the Shrine of the Forgotten and speak with Caldus again. After the bell is returned, he reveals the path to the Vault of Echoes.',
      location: 'The Shrine of the Forgotten',
    };
  }
  return { done, active, teaser };
}
