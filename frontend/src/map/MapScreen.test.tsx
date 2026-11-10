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
});
