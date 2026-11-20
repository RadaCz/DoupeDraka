import type { ReactElement } from 'react';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CHAPTER_ONE_LAYOUT } from '../chapterOneMap';
import {
  actionRejectionCoach,
  playActionChips,
  primaryPlayChipKey,
  questStepCompletionLine,
  resolveNpcTopicChips,
} from '../game/gameActions';
import { HomeScreen } from '../GameScreens';
import { PlaySceneIntroCard } from '../screens/sharedPlayUI';
import { LocaleProvider } from '../i18n';
import { displayCreature, displayLocation } from '../i18n/gameDisplay';
import { characterStub } from '../test/characterStub';
import type { LocationReference } from '../types';

const locations: LocationReference[] = Object.keys(CHAPTER_ONE_LAYOUT).map(name => ({
  name,
  connections: [],
  arrival_beat: 'A quiet moment.',
}));

function renderCs(ui: ReactElement) {
  localStorage.setItem('app_locale', 'cs');
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

describe('AC15-2 play chips per chapter location', () => {
  const t = (s: string) => s;
  for (const place of Object.keys(CHAPTER_ONE_LAYOUT)) {
    it(`offers 2–4 chips at ${place}`, () => {
      const hero = characterStub({
        id: '1',
        name: 'A',
        character_class: 'fighter',
        location: place,
        quest_flags: { bell_quest_accepted: true },
      });
      const chips = playActionChips(hero, [], locations, t, false, false);
      expect(chips.length).toBeGreaterThanOrEqual(2);
      expect(chips.length).toBeLessThanOrEqual(4);
    });
  }

  it('highlights one primary chip when a quest step is active', () => {
    const hero = characterStub({
      id: '1',
      name: 'A',
      character_class: 'fighter',
      location: 'The Shrine of the Forgotten',
      quest_flags: { bell_quest_accepted: false },
    });
    const key = primaryPlayChipKey(hero, [], locations, t, false, false);
    const chips = playActionChips(hero, [], locations, t, false, false);
    expect(chips.filter(c => c.key === key)).toHaveLength(1);
  });
});

describe('AC15-3 quick start', () => {
  it('hero presets are offered without opening the multi-step wizard', () => {
    renderCs(
      <HomeScreen
        character={null}
        characters={[]}
        presets={[
          {
            key: 'striker',
            name: 'Quick striker',
            role: 'Damage dealer',
            race: 'Human',
            character_class: 'Fighter',
          },
        ]}
        economy={null}
        events={[]}
        onContinue={() => undefined}
        onCreate={() => undefined}
        onPreset={() => undefined}
      />,
    );
    expect(screen.getByText(/RYCHLY START|QUICK START/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Quick striker/i })).toBeInTheDocument();
  });
});

describe('AC15-4 Czech display labels', () => {
  it('does not leave raw English location or creature names in cs UI', () => {
    for (const place of Object.keys(CHAPTER_ONE_LAYOUT)) {
      const label = displayLocation(place, 'cs');
      expect(label).not.toMatch(/^The /);
    }
    expect(displayCreature('goblin scout', 'cs')).not.toMatch(/goblin scout/i);
  });
});

describe('AC15-5 rejected action coach', () => {
  it('maps engine rejection to a Czech reason and one alternate chip', () => {
    const hero = characterStub({
      id: '1',
      name: 'A',
      character_class: 'fighter',
      location: 'The Whispering Cellar',
    });
    const coach = actionRejectionCoach(
      'That action cannot be resolved here.',
      hero,
      [],
      locations,
      (s: string) => s,
      false,
      false,
    );
    expect(coach?.reasonKey).toMatch(/cannot be resolved/i);
    expect(coach?.alternative?.action).toBeTruthy();
  });
});

describe('AC15-6 home resume card', () => {
  it('shows resume location and active quest on Home', () => {
    const hero = characterStub({
      id: '1',
      name: 'A',
      character_class: 'fighter',
      location: 'The Whispering Cellar',
      quest_flags: {},
    });
    renderCs(
      <HomeScreen
        character={hero}
        characters={[hero]}
        presets={[]}
        economy={null}
        events={[]}
        onContinue={() => undefined}
        onCreate={() => undefined}
        onPreset={() => undefined}
      />,
    );
    expect(screen.getByText(/Pokračuj tam, kde jsi skončil|Resume where you left off/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Šeptající sklep|Whispering Cellar/i })).toBeInTheDocument();
  });
});

describe('AC15 scene intro and quest toast helpers', () => {
  it('renders scene intro with quest hint', () => {
    const hero = characterStub({
      id: '1',
      name: 'A',
      character_class: 'fighter',
      location: 'The Whispering Cellar',
      quest_flags: {},
    });
    renderCs(<PlaySceneIntroCard character={hero} locations={locations} />);
    expect(screen.getByRole('heading', { name: /Kde jsi a co chceš|Where you are/i })).toBeInTheDocument();
  });

  it('emits completion line when a quest flag flips', () => {
    const line = questStepCompletionLine(
      {},
      { bell_quest_accepted: true },
      (s: string) => s,
    );
    expect(line).toMatch(/Completed:|bell/i);
  });

  it('lists up to three NPC topics at the shrine', () => {
    const topics = resolveNpcTopicChips(
      characterStub({
        id: '1',
        name: 'A',
        character_class: 'fighter',
        location: 'The Shrine of the Forgotten',
        quest_flags: {},
      }),
      (s: string) => s,
    );
    expect(topics.length).toBeGreaterThan(0);
    expect(topics.length).toBeLessThanOrEqual(3);
  });
});

describe('AC15-7 frontend-only scope', () => {
  it('does not change app/engine in this branch diff', () => {
    let diff = '';
    try {
      diff = execSync('git diff --name-only origin/main...HEAD', {
        cwd: new URL('../..', import.meta.url).pathname,
        encoding: 'utf8',
      });
    } catch {
      diff = execSync('git diff --name-only HEAD', { encoding: 'utf8' });
    }
    const touched = diff.split('\n').filter(Boolean);
    const engine = touched.filter(path => path.startsWith('app/') || path.startsWith('engine/'));
    expect(engine).toEqual([]);
  });
});