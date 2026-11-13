import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { resetAppInitForTests } from './authSession';
import type { Character } from './types';

const mockCharacter: Character = {
  id: 'hero-1',
  name: 'Rada',
  race: 'human',
  character_class: 'ranger',
  level: 1,
  abilities: { strength: 10, dexterity: 15, constitution: 14, intelligence: 8, wisdom: 13, charisma: 12 },
  hp: 12,
  max_hp: 12,
  armor_class: 14,
  mana: 3,
  max_mana: 3,
  xp: 0,
  gold: 0,
  inventory: [],
  location: 'The Whispering Cellar',
  in_combat: false,
  combatant: null,
  spell_slots: {},
  max_spell_slots: {},
  known_spells: [],
  prepared_spells: [],
  spellcasting_ability: '',
  difficulty: 'normal',
  tone: 'balanced',
  humor: 'rare',
  verbose: true,
};

const referenceData = {
  races: [],
  classes: [],
  feats: [],
  backgrounds: [],
  character_creation: { standard_array: [], ability_order: [], skill_abilities: {}, backgrounds: [], class_skill_picks: {}, equipment_packages: {}, spell_pick_limits: {}, spell_options: {}, personality_fields: [] },
  draconic_ancestry: {},
  locations: [],
  quests: {},
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: () => Promise.resolve(body),
  } as Response);
}

function mountAppWithHero(backHandlers: Array<() => void>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname === '/api/auth/telegram') return jsonResponse({ access_token: 'tok-1' });
    if (url.pathname === '/api/characters') return jsonResponse([mockCharacter]);
    if (url.pathname === '/api/characters/presets') return jsonResponse([]);
    if (url.pathname === '/api/reference') return jsonResponse(referenceData);
    if (url.pathname === '/api/economy') return jsonResponse({ balance: 10, balance_tenths: 100, tier: 'normal', tiers: [], packages: [] });
    if (url.pathname === '/api/reference/spells') return jsonResponse([]);
    if (url.pathname === '/api/characters/hero-1/events') return jsonResponse([]);
    if (url.pathname === '/api/characters/hero-1') return jsonResponse(mockCharacter);
    return jsonResponse({ detail: 'missing' }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  const backBtn = {
    show: vi.fn(),
    hide: vi.fn(),
    onClick: vi.fn((handler: () => void) => backHandlers.push(handler)),
    offClick: vi.fn(),
  };
  window.Telegram = {
    WebApp: {
      initData: 'signed-init',
      ready: vi.fn(),
      expand: vi.fn(),
      BackButton: backBtn,
      HapticFeedback: { impactOccurred: vi.fn() },
    },
  };
  render(<App />);
  return { backBtn };
}

function pressTelegramBack(backHandlers: Array<() => void>) {
  backHandlers[backHandlers.length - 1]?.();
}

describe('Telegram back navigation', () => {
  const backHandlers: Array<() => void> = [];

  beforeEach(() => {
    backHandlers.length = 0;
    resetAppInitForTests();
    vi.clearAllMocks();
    localStorage.setItem('active_character_id', 'hero-1');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetAppInitForTests();
  });

  it('returns Home → Quests → Home', async () => {
    mountAppWithHero(backHandlers);
    await waitFor(() => expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^quests$/i }));
    await waitFor(() => expect(screen.getByRole('heading', { name: /quest/i })).toBeInTheDocument());
    pressTelegramBack(backHandlers);
    await waitFor(() => expect(screen.getByText(/adventure awaits|your next chapter/i)).toBeInTheDocument());
  });

  it('returns Adventure → Quests → Adventure', async () => {
    mountAppWithHero(backHandlers);
    await waitFor(() => expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^adventure$/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /^adventure$/i })).toHaveClass('active'));
    const questBtn = screen.queryByRole('button', { name: /view current quest/i })
      ?? screen.queryByRole('button', { name: /^quests$/i });
    expect(questBtn).toBeTruthy();
    fireEvent.click(questBtn!);
    pressTelegramBack(backHandlers);
    await waitFor(() => expect(screen.getByRole('button', { name: /adventure/i })).toHaveClass('active'));
  });

  it('hides BackButton on root tabs and shows on nested screens', async () => {
    const { backBtn } = mountAppWithHero(backHandlers);
    await waitFor(() => expect(backBtn.show).not.toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    await waitFor(() => expect(screen.getByRole('heading', { name: /more/i })).toBeInTheDocument());
    expect(backBtn.show).not.toHaveBeenCalled();
    const settings = within(screen.getByRole('main')).getByRole('button', { name: /settings/i });
    fireEvent.click(settings);
    await waitFor(() => expect(backBtn.show).toHaveBeenCalled());
  });
});
