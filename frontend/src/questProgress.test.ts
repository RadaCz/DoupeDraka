import { describe, expect, it } from 'vitest';
import { chapterOneQuestProgress, visibleQuestTimeline } from './questProgress';

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

describe('visibleQuestTimeline', () => {
  it('hides Nib/Caldus spoilers before the quest is accepted', () => {
    const { active, done, teaser } = visibleQuestTimeline({});
    expect(done).toHaveLength(0);
    expect(active?.label).toMatch(/shrine bell/i);
    expect(active?.label).not.toMatch(/Nib|Caldus/i);
    expect(teaser).toBeTruthy();
  });

  it('shows vault descent after vault is unlocked', () => {
    const { active } = visibleQuestTimeline({
      bell_quest_accepted: true,
      bell_acquired: true,
      bell_quest_complete: true,
      vault_hint_given: true,
      vault_unlocked: true,
    });
    expect(active?.id).toBe('vault_first_descent');
    expect(active?.hint).toMatch(/level 3/i);
  });

  it('points to Caldus for the vault step after the bell is returned', () => {
    const { active } = visibleQuestTimeline({
      bell_quest_accepted: true,
      bell_acquired: true,
      bell_quest_complete: true,
    });
    expect(active?.id).toBe('vault_hint_given');
    expect(active?.location).toBe('The Shrine of the Forgotten');
    expect(active?.hint).toMatch(/Caldus/i);
    expect(active?.hint).not.toMatch(/Sunken Corridor/i);
  });
});
