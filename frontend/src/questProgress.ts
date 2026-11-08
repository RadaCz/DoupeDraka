export type QuestStepId =
  | 'bell_quest_accepted'
  | 'bell_acquired'
  | 'bell_quest_complete'
  | 'vault_hint_given'
  | 'chapter_one_complete';

export interface QuestStep {
  id: QuestStepId;
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

export function chapterOneQuestProgress(flags: Record<string, boolean> = {}) {
  const steps = CHAPTER_ONE_STEPS.map(step => ({
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
