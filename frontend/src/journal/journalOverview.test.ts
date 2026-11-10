import { describe, expect, it } from 'vitest';
import { visibleQuestTimeline } from '../questProgress';
import { questStakesMessage } from '../quests/questStory';

describe('Overview quest pulse', () => {
  it('shows spoiler-safe first objective aligned with Quest V2', () => {
    const { active } = visibleQuestTimeline({});
    expect(active?.label).toBe('Find out what happened to the shrine bell');
    expect(questStakesMessage({})).toBeTruthy();
  });

  it('marks chapter complete with no active step', () => {
    const { active } = visibleQuestTimeline({ chapter_one_complete: true });
    expect(active).toBeNull();
  });
});
