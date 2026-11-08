export type QuestStepId =
  | 'bell_quest_accepted'
  | 'bell_acquired'
  | 'bell_quest_complete'
  | 'vault_hint_given'
  | 'chapter_one_complete';

export interface QuestStep {
  id: QuestStepId | string;
  label: string;
  hint: string;
  location?: string;
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
    hint: 'Search the Sunken Corridor or talk to locals until the vault route opens.',
    location: 'The Sunken Corridor',
  },
  {
    id: 'chapter_one_complete',
    label: 'Defeat the Bell Warden',
    hint: 'Enter the Vault of Echoes and face the Bell Warden in the pit.',
    location: "The Bell Warden's Pit",
  },
];

function stepDone(id: QuestStepId, flags: Record<string, boolean>) {
  if (flags.chapter_one_complete) return true;
  if (id === 'bell_acquired') return Boolean(flags.bell_acquired || flags.bell_found);
  if (id === 'vault_hint_given') {
    return Boolean(flags.vault_hint_given || flags.vault_unlocked || flags.chapter_one_complete);
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
  }
  return { done, active, teaser };
}
