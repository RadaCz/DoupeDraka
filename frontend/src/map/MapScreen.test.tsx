import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapScreen } from './MapScreen';
import { LocaleProvider } from '../i18n';
import type { Character, LocationReference } from '../types';

const locations: LocationReference[] = [
  { name: 'The Whispering Cellar', connections: ['The Sunken Corridor'], arrival_beat: 'A cold draft.' },
  { name: 'The Sunken Corridor', connections: ['The Whispering Cellar'], arrival_beat: 'Mara warns you.' },
];

const hero = {
  id: '1',
  name: 'Test',
  location: 'The Whispering Cellar',
  visited_locations: ['The Whispering Cellar'],
  quest_flags: {},
} as Character;

const pitReadyFlags = {
  bell_quest_accepted: true,
  bell_acquired: true,
  bell_found: true,
  bell_quest_complete: true,
  vault_hint_given: true,
  vault_unlocked: true,
  vault_first_descent_story_awarded: true,
};

const allLocations: LocationReference[] = [
  { name: 'The Whispering Cellar', connections: ['The Sunken Corridor'], arrival_beat: 'A cold draft.' },
  { name: 'The Sunken Corridor', connections: ['The Whispering Cellar', 'The Vault of Echoes', "The Bell Warden's Pit"], arrival_beat: 'Mara warns you.' },
  { name: 'The Vault of Echoes', connections: ['The Sunken Corridor', "The Bell Warden's Pit"], arrival_beat: 'Damp stone.' },
  { name: "The Bell Warden's Pit", connections: ['The Vault of Echoes'], arrival_beat: 'Chains rattle.' },
];

function renderMap(ui: ReactElement) {
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

describe('MapScreen', () => {
  it('renders current location and reachable route', () => {
    renderMap(
      <MapScreen character={hero} locations={locations} onTravel={() => undefined} />,
    );
    expect(screen.getByRole('heading', { level: 2, name: /Whispering Cellar/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Reachable from here/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Sunken Corridor/i }).length).toBeGreaterThan(0);
  });

  it('shows empty guidance without catalog data', () => {
    renderMap(
      <MapScreen character={hero} locations={[]} onTravel={() => undefined} />,
    );
    expect(screen.getByText(/Location data is not available/i)).toBeInTheDocument();
  });

  it('labels the Bell Warden pit with the active quest objective', () => {
    const preBoss = {
      ...hero,
      level: 2,
      location: 'The Vault of Echoes',
      visited_locations: ['The Whispering Cellar', 'The Vault of Echoes'],
      quest_flags: pitReadyFlags,
    } as Character;
    renderMap(
      <MapScreen character={preBoss} locations={allLocations} onTravel={() => undefined} />,
    );
    expect(screen.getAllByText(/Defeat the Bell Warden/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Bell Warden requires at least level/i)).toBeInTheDocument();
  });
});
