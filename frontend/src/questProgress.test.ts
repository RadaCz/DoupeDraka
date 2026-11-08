import { describe, expect, it } from 'vitest';
import { chapterOneQuestProgress } from './questProgress';

describe('chapterOneQuestProgress', () => {
  it('starts with the Caldus quest', () => {
    const { next } = chapterOneQuestProgress({});
    expect(next?.id).toBe('bell_quest_accepted');
  });

  it('treats bell_found as acquired', () => {
    const { next } = chapterOneQuestProgress({
      bell_quest_accepted: true,
      bell_found: true,
    });
    expect(next?.id).toBe('bell_quest_complete');
  });

  it('marks the arc complete when chapter_one_complete is set', () => {
    const { next, steps } = chapterOneQuestProgress({ chapter_one_complete: true });
    expect(next).toBeNull();
    expect(steps.every(step => step.status === 'done')).toBe(true);
  });
});
