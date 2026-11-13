import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { resetAppInitForTests } from './authSession';
import { __resetAppSessionForTests } from './App';
import type { Character, JournalEvent } from './types';

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
  inventory: ['Traveler’s clothes', 'Longbow'],
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

const presetList = [
  { key: 'tank', name: 'Grath', race: 'half_orc', character_class: 'barbarian', role: 'Tank' },
  { key: 'skirmisher', name: 'Vela', race: 'human', character_class: 'rogue', role: 'Skirmisher' },
];

const referenceData = {
  races: [
    { key: 'human', name: 'Human', speed: 30, ability_increase: { strength: 1 }, subraces: [], traits: [{ name: 'Versatile', text: 'Extra language.' }], mvp_playable: true },
    { key: 'elf', name: 'Elf', speed: 30, ability_increase: { dexterity: 2 }, subraces: ['high_elf'], traits: [{ name: 'Keen Senses', text: 'Perception training.' }], mvp_playable: true },
    { key: 'halfling', name: 'Halfling', speed: 25, ability_increase: { dexterity: 2 }, subraces: [], traits: [{ name: 'Lucky', text: 'Reroll 1s.' }], mvp_playable: true },
  ],
  classes: [
    { key: 'fighter', name: 'Fighter', hit_die: 10, primary: 'strength', saving_throws: ['strength', 'constitution'], armor: ['light', 'heavy'], weapons: ['simple', 'martial'], subclasses: [{ name: 'Champion', text: 'A focused martial path.' }], mvp_playable: true },
    { key: 'rogue', name: 'Rogue', hit_die: 8, primary: 'dexterity', saving_throws: ['dexterity', 'intelligence'], armor: ['light'], weapons: ['simple'], subclasses: [{ name: 'Thief', text: 'Fast hands.' }], mvp_playable: true },
    { key: 'cleric', name: 'Cleric', hit_die: 8, primary: 'wisdom', saving_throws: ['wisdom', 'charisma'], armor: ['light'], weapons: ['simple'], subclasses: [{ name: 'Life', text: 'Healing.' }], mvp_playable: true },
    { key: 'wizard', name: 'Wizard', hit_die: 6, primary: 'intelligence', saving_throws: ['intelligence', 'wisdom'], armor: [], weapons: ['daggers'], subclasses: [{ name: 'School of Evocation', text: 'Shape your spells.' }], mvp_playable: true },
  ],
  feats: [{ name: 'Grappler', prerequisite: 'Strength 13', benefits: ['Pin a foe.'] }],
  backgrounds: [
    { key: 'acolyte', mvp_playable: true, name: 'Acolyte', skill_proficiencies: ['Insight', 'Religion'], languages: 2, equipment: [], feature: { name: 'Shelter', text: 'Help from temples.' } },
  ],
  character_creation: {
    standard_array: [15, 14, 13, 12, 10, 8],
    ability_order: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'],
    skill_abilities: { Stealth: 'dexterity', Arcana: 'intelligence' },
    backgrounds: [
      { key: 'acolyte', mvp_playable: true, name: 'Acolyte', skill_proficiencies: ['Insight', 'Religion'], languages: 2, equipment: [], feature: { name: 'Shelter', text: 'Help from temples.' } },
      { key: 'folk_hero', mvp_playable: true, name: 'Folk Hero', skill_proficiencies: ['Animal Handling', 'Survival'], languages: 0, equipment: [], feature: { name: 'Hospitality', text: 'Common folk help you.' } },
      { key: 'sage', mvp_playable: true, name: 'Sage', skill_proficiencies: ['Arcana', 'History'], languages: 2, equipment: [], feature: { name: 'Researcher', text: 'Libraries grant lore.' } },
      { key: 'criminal', mvp_playable: true, name: 'Criminal', skill_proficiencies: ['Deception', 'Stealth'], languages: 0, equipment: [], feature: { name: 'Contact', text: 'Underworld contact.' } },
    ],
    class_skill_picks: {
      wizard: { options: ['Arcana', 'History', 'Investigation'], count: 2 },
      fighter: { options: ['Athletics', 'Perception'], count: 2 },
      rogue: { options: ['Stealth', 'Perception', 'Acrobatics', 'Deception'], count: 4 },
      cleric: { options: ['Insight', 'Medicine', 'Religion'], count: 2 },
    },
    equipment_packages: {
      wizard: { scholar: ['dagger', 'spellbook'] },
      fighter: { guardian: ['shortsword'] },
      rogue: { scout: ['shortsword', 'dagger'] },
      cleric: { warpriest: ['mace'] },
    },
    spell_pick_limits: {
      wizard: { cantrips: 3, level_one_known: 3 },
      cleric: { cantrips: 3, level_one_prepared: 4 },
    },
    spell_options: {
      wizard: { cantrips: ['Fire Bolt', 'Light', 'Mage Hand'], level_one: ['Magic Missile', 'Shield', 'Detect Magic'] },
      cleric: { cantrips: ['Guidance', 'Sacred Flame', 'Thaumaturgy'], level_one: ['Cure Wounds', 'Bless', 'Shield of Faith', 'Guiding Bolt'] },
    },
    personality_fields: ['alignment', 'ideal', 'bond', 'flaw', 'backstory'],
  },
  draconic_ancestry: {},
  locations: [
    { name: 'The Whispering Cellar', connections: ['The Sunken Corridor'] },
    { name: 'The Sunken Corridor', connections: ['The Whispering Cellar', 'The Shrine of the Forgotten'] },
    { name: 'The Shrine of the Forgotten', connections: ['The Sunken Corridor', 'The Goblin Market'] },
    { name: 'The Goblin Market', connections: ['The Shrine of the Forgotten'] },
  ],
};

const economyData = {
  balance: 100,
  balance_tenths: 1000,
  tier: 'normal',
  tiers: [
    { key: 'lite', label: 'Lite', cost: 0, description: 'Built-in offline storyteller; free changed turns.' },
    { key: 'normal', label: 'Normal', cost: 1, description: 'Balanced for most turns.' },
  ],
  packages: [{ key: 'starter', label: 'Starter', mana: 50, price_rub: 100 }],
};

const spellList = [
  { name: 'Light', level: 0, school: 'evocation', range: 'Touch', text: 'An object shines.', effect_modeled: false },
  { name: 'Fire Bolt', level: 0, school: 'evocation', range: '120 feet', text: 'A mote of fire.', effect_modeled: true },
  { name: 'Cure Wounds', level: 1, school: 'evocation', range: 'Touch', text: 'Restore hit points.', effect_modeled: true },
  { name: 'Magic Missile', level: 1, school: 'evocation', range: '120 feet', text: 'Darts of force.', effect_modeled: true },
  { name: 'Shield', level: 1, school: 'abjuration', range: 'Self', text: 'A magical barrier.', effect_modeled: false },
  { name: 'Fireball', level: 3, school: 'evocation', range: '150 feet', text: 'A bright streak flashes.', effect_modeled: false },
];

function ensureBottomNav() {
  if (!screen.queryByRole('button', { name: 'More' })) {
    fireEvent.click(screen.getByRole('button', { name: /continue adventure/i }));
  }
}

function openMoreSubscreen(label: string | RegExp) {
  ensureBottomNav();
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  const pattern = typeof label === 'string'
    ? new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    : label;
  fireEvent.click(screen.getByRole('button', { name: pattern }));
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 402 ? 'Payment Required' : 'Error',
    json: () => Promise.resolve(body),
  } as Response);
}

function setupApp(initialCharacters: Character[] = [], initialHistory: Record<string, JournalEvent[]> = {}) {
  let characters = [...initialCharacters];
  const history = { ...initialHistory };
  const requests: Array<{ url: string; method: string; body: Record<string, unknown> | null }> = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : null;
    requests.push({ url: `${url.pathname}${url.search}`, method, body });

    if (url.pathname === '/api/auth/telegram') return jsonResponse({ access_token: 'memory-only-token' });
    if (url.pathname === '/api/characters' && method === 'GET') return jsonResponse(characters);
    if (url.pathname === '/api/characters/presets' && method === 'GET') return jsonResponse(presetList);
    if (url.pathname === '/api/reference') return jsonResponse(referenceData);
    if (url.pathname === '/api/reference/spells') return jsonResponse(spellList);
    if (url.pathname === '/api/economy' && method === 'GET') return jsonResponse(economyData);

    const eventMatch = url.pathname.match(/^\/api\/characters\/([^/]+)\/events$/);
    if (eventMatch && method === 'GET') return jsonResponse(history[eventMatch[1]] ?? []);

    const characterMatch = url.pathname.match(/^\/api\/characters\/([^/]+)$/);
    if (characterMatch && method === 'GET') {
      const current = characters.find(item => item.id === characterMatch[1]);
      if (!current) return jsonResponse({ detail: 'missing' }, 404);
      return jsonResponse(current);
    }

    if (url.pathname === '/api/characters' && method === 'POST') {
      const created = {
        ...mockCharacter,
        ...body,
        id: 'created-hero',
        abilities: mockCharacter.abilities,
        max_hp: 12,
        hp: 12,
        location: 'The Whispering Cellar',
      } as Character;
      characters = [...characters, created];
      return jsonResponse(created, 201);
    }

    const presetMatch = url.pathname.match(/^\/api\/characters\/presets\/([^/]+)$/);
    if (presetMatch && method === 'POST') {
      const preset = presetList.find(item => item.key === presetMatch[1]);
      const created = { ...mockCharacter, id: `preset-${presetMatch[1]}`, ...preset } as Character;
      characters = [...characters, created];
      return jsonResponse(created, 201);
    }

    const reviveMatch = url.pathname.match(/^\/api\/characters\/([^/]+)\/revive$/);
    if (reviveMatch && method === 'POST') {
      const current = characters.find(item => item.id === reviveMatch[1])!;
      const lost = Math.min(current.gold, Math.max(1, Math.floor(current.gold / 10)));
      const updated = { ...current, hp: 1, gold: current.gold - lost, in_combat: false, combatant: null };
      characters = characters.map(item => item.id === updated.id ? updated : item);
      return jsonResponse({ character: updated, gold_lost: lost });
    }

    const settingsMatch = url.pathname.match(/^\/api\/characters\/([^/]+)\/settings$/);
    if (settingsMatch && method === 'PATCH') {
      const base = characters.find(item => item.id === settingsMatch[1])!;
      const updated = {
        ...base,
        ...body,
        narration_language: typeof body?.language === 'string' ? body.language : base.narration_language,
      } as Character;
      characters = characters.map(item => item.id === updated.id ? updated : item);
      return jsonResponse(updated);
    }

    if (url.pathname === '/api/economy/tier' && method === 'POST') return jsonResponse({ tier: body?.tier });
    if (url.pathname === '/api/tools/combat-calculator' && method === 'POST') {
      return jsonResponse({ base_xp: 50, adjusted_xp: 50, multiplier: 1, band: 'medium', thresholds: { easy: 25, medium: 50, hard: 75, deadly: 100 } });
    }

    const actionMatch = url.pathname.match(/^\/api\/characters\/([^/]+)\/actions\/stream$/);
    if (actionMatch && method === 'POST') {
      const current = characters.find(item => item.id === actionMatch[1])!;
      const updated = { ...current, hp: current.hp - 1 };
      characters = characters.map(item => item.id === updated.id ? updated : item);
      const nextEvent = { id: (history[updated.id]?.length ?? 0) + 1, action: String(body?.action), result: 'Steel rings.\n\nAttack roll: hit.', created_at: new Date().toISOString() };
      history[updated.id] = [...(history[updated.id] ?? []), nextEvent];
      const payload = {
        events: ['Attack roll: hit.'],
        narration: 'Steel rings.',
        narration_status: 'fallback',
        character: updated,
        energy: 99,
        energy_tenths: 990,
        tier: 'normal',
      };
      const encoder = new TextEncoder();
      const frames = [
        `event: turn\ndata: ${JSON.stringify(payload)}\n\n`,
        'event: delta\ndata: {"text":"Steel "}\n\n',
        'event: delta\ndata: {"text":"rings."}\n\n',
        'event: complete\ndata: {"narration":"Steel rings.","narration_status":"fallback"}\n\n',
      ];
      return new Response(new ReadableStream({
        start(controller) {
          void (async () => {
            controller.enqueue(encoder.encode(frames[0]));
            controller.enqueue(encoder.encode(frames[1]));
            await new Promise(resolve => setTimeout(resolve, 80));
            frames.slice(2).forEach(frame => controller.enqueue(encoder.encode(frame)));
            controller.close();
          })();
        },
      }), { headers: { 'Content-Type': 'text/event-stream' } });
    }
    return jsonResponse({ detail: `Unhandled mock route ${method} ${url.pathname}` }, 404);
  }));
  window.Telegram = { WebApp: { initData: 'signed-init-data', ready: vi.fn(), expand: vi.fn() } };
  return requests;
}

describe('Telegram Mini App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAppInitForTests();
    __resetAppSessionForTests();
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
    window.Telegram = { WebApp: { initData: 'signed-init-data' } };
  });

  it('shows browser sign-in when Telegram initData is absent', async () => {
    window.Telegram = undefined;
    render(<App />);
    expect(await screen.findByRole('heading', { name: /sign in to continue/i })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('loads the real home hub and keeps the access token out of localStorage', async () => {
    const requests = setupApp();
    render(<App />);
    expect(await screen.findByRole('heading', { name: /an adventure awaits/i })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument();
    expect(screen.getByText('100.0')).toBeInTheDocument();
    expect(requests.map(item => item.url)).toContain('/api/reference');
    expect(localStorage.getItem('api_token')).toBeNull();
    expect(localStorage.getItem('active_character_id')).toBeNull();
  });

  it('restores a selected hero and loads its saved campaign journal', async () => {
    localStorage.setItem('active_character_id', mockCharacter.id);
    const requests = setupApp([mockCharacter]);
    render(<App />);
    expect(await screen.findByRole('heading', { name: /welcome back, rada/i })).toBeInTheDocument();
    await waitFor(() => expect(requests.some(item => item.url === `/api/characters/${mockCharacter.id}/events`)).toBe(true));
    expect(screen.getByText(/ranger/i)).toBeInTheDocument();
  });

  it('refreshes combat conditions from the server when entering adventure play', async () => {
    localStorage.setItem('active_character_id', mockCharacter.id);
    const paralyzed: Character = {
      ...mockCharacter,
      in_combat: true,
      combatant: { name: 'Cellar ghoul', hp: 12, max_hp: 22, armor_class: 12 },
      conditions: [{ condition_id: 'paralyzed' }],
    };
    const requests = setupApp([paralyzed]);
    render(<App />);
    await screen.findByRole('heading', { name: /welcome back, rada/i });
    fireEvent.click(screen.getByRole('button', { name: /continue adventure/i }));
    await waitFor(() => {
      expect(requests.some(
        item => item.url === `/api/characters/${mockCharacter.id}` && item.method === 'GET',
      )).toBe(true);
    });
    expect(await screen.findByText(/paralyz/i)).toBeInTheDocument();
  });

  it('shows the active enemy and only relevant combat choices during a fight', async () => {
    const combatant = { name: 'Goblin scout', hp: 4, max_hp: 7, armor_class: 13 };
    setupApp([{ ...mockCharacter, in_combat: true, combatant }]);
    render(<App />);
    await screen.findByRole('heading', { name: /welcome back, rada/i });
    fireEvent.click(screen.getByRole('button', { name: /continue adventure/i }));

    expect(await screen.findByRole('heading', { name: 'Goblin scout' })).toBeInTheDocument();
    expect(screen.getByText(/HP.*4\/7/)).toBeInTheDocument();
    const combatActions = screen.getByRole('group', { name: 'Combat actions' });
    expect(within(combatActions).getByRole('button', { name: /^Attack\b/ })).toBeInTheDocument();
    expect(within(combatActions).getByRole('button', { name: /^Flee\b/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Suggested actions')).not.toBeInTheDocument();
  });

  it('shows known spells, slot counts, and blocks an unmodeled spell before submit', async () => {
    const wizard: Character = {
      ...mockCharacter,
      character_class: 'wizard',
      in_combat: true,
      combatant: { name: 'Goblin scout', hp: 7, max_hp: 7, armor_class: 13 },
      spell_slots: { '1': 2 },
      max_spell_slots: { '1': 2 },
      known_spells: ['Fire Bolt', 'Magic Missile', 'Shield'],
      spellcasting_ability: 'int',
    };
    const requests = setupApp([wizard]);
    render(<App />);
    await screen.findByRole('heading', { name: /welcome back, rada/i });
    fireEvent.click(screen.getByRole('button', { name: /continue adventure/i }));

    expect(await screen.getByText('L1: 2/2')).toBeInTheDocument();
    const combatActions = screen.getByRole('group', { name: 'Combat actions' });
    expect(within(combatActions).getByRole('button', { name: /^Cast spell\b/ })).toBeInTheDocument();
    const picker = screen.getByRole('combobox', { name: 'Your spells' });
    expect(within(picker).getByRole('option', { name: 'Fire Bolt' })).toBeInTheDocument();
    expect(within(picker).getByRole('option', { name: 'Magic Missile' })).toBeInTheDocument();
    expect(within(picker).queryByRole('option', { name: 'Cure Wounds' })).not.toBeInTheDocument();
    expect(within(picker).queryByRole('option', { name: 'Shield' })).not.toBeInTheDocument();
    expect(requests.some(item => item.url.endsWith('/actions'))).toBe(false);
  });

  it('suggests recovery and responds to the latest discovery outside combat', async () => {
    const injured = { ...mockCharacter, hp: 5 };
    const discovery = {
      id: 1,
      action: 'search',
      result: 'You find fresh tracks leading deeper into the cellar.',
      created_at: new Date().toISOString(),
    };
    setupApp([injured], { [injured.id]: [discovery] });
    render(<App />);
    await screen.findByRole('heading', { name: /welcome back, rada/i });
    fireEvent.click(screen.getByRole('button', { name: /continue adventure/i }));

    fireEvent.click(await screen.findByRole('button', { name: 'Study the fresh tracks' }));
    expect(screen.queryByRole('button', { name: /^Attack\b/ })).not.toBeInTheDocument();
  });

  it('creates a character through the guided race, class and campaign steps', async () => {
    const requests = setupApp();
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /create your character/i }));
    fireEvent.click(screen.getByRole('button', { name: /quick generate/i }));
    fireEvent.change(screen.getByLabelText('Character name'), { target: { value: 'Rada' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByRole('heading', { name: /meet your adventurer/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /enter the adventure/i }));
    expect(await screen.findByRole('heading', { name: /the whispering cellar/i })).toBeInTheDocument();
    const createRequest = requests.find(item => item.url === '/api/characters' && item.method === 'POST');
    expect(createRequest?.body).toMatchObject({ name: 'Rada', difficulty: 'normal', abilities: expect.any(Object) });
  });

  it('creates a ready-made hero from the quick start cards', async () => {
    const requests = setupApp();
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /grath.*tank.*barbarian/i }));
    expect(await screen.findByRole('heading', { name: /the whispering cellar/i })).toBeInTheDocument();
    expect(requests.some(item => item.url === '/api/characters/presets/tank' && item.method === 'POST')).toBe(true);
  });

  it('shows the character sheet and navigates to the spell library', async () => {
    setupApp([mockCharacter]);
    render(<App />);
    await screen.findByRole('heading', { name: /welcome back, rada/i });
    ensureBottomNav();
    fireEvent.click(screen.getByRole('button', { name: /^(Character|Postava)$/ }));
    expect(await screen.findByRole('heading', { name: /^Rada$/i })).toBeInTheDocument();
    expect(screen.getByText(/ability scores/i)).toBeInTheDocument();
    expect(screen.getByText('Longbow')).toBeInTheDocument();
    expect(screen.queryByText('LEGACY CHARACTER MANA')).not.toBeInTheDocument();
    expect(screen.queryByText('Mana (historical)')).not.toBeInTheDocument();
    openMoreSubscreen('Settings');
    fireEvent.click(screen.getByRole('button', { name: /rules and spell reference/i }));
    expect(await screen.findByRole('heading', { name: /adventurer's tools/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /SRD reference/i }));
    fireEvent.click(screen.getByRole('button', { name: /Full SRD reference/i }));
    expect(screen.getByText('Cure Wounds')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /search spell library/i }), { target: { value: 'light' } });
    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.queryByText('Cure Wounds')).not.toBeInTheDocument();
  });

  it('limits the default spell reference to the character level', async () => {
    const wizard = { ...mockCharacter, character_class: 'wizard', level: 1 };
    setupApp([wizard]);
    render(<App />);
    await screen.findByRole('heading', { name: /welcome back, rada/i });
    openMoreSubscreen('Settings');
    fireEvent.click(screen.getByRole('button', { name: /rules and spell reference/i }));
    fireEvent.click(await screen.findByRole('tab', { name: /SRD reference/i }));
    expect(screen.getByText('Cure Wounds')).toBeInTheDocument();
    expect(screen.queryByText('Fireball')).not.toBeInTheDocument();
    expect(screen.getByText(/through level/i)).toBeInTheDocument();
  });

  it('runs the encounter calculator against the game API', async () => {
    const requests = setupApp([mockCharacter]);
    render(<App />);
    await screen.findByRole('heading', { name: /welcome back, rada/i });
    openMoreSubscreen('Settings');
    fireEvent.click(screen.getByRole('button', { name: /rules and spell reference/i }));
    fireEvent.click(await screen.findByRole('tab', { name: /combat balance/i }));
    fireEvent.click(screen.getByRole('button', { name: /rate this encounter/i }));
    expect(await screen.findByText('Medium')).toBeInTheDocument();
    expect(requests.some(item => item.url === '/api/tools/combat-calculator' && item.method === 'POST')).toBe(true);
  });

  it('offers travel to a connected location from the game screen', async () => {
    const requests = setupApp([mockCharacter]);
    render(<App />);
    await screen.findByRole('heading', { name: /welcome back, rada/i });
    fireEvent.click(screen.getByRole('button', { name: /continue adventure/i }));

    const travelButtons = screen.getAllByRole('button', { name: 'Travel' });
    fireEvent.click(travelButtons[travelButtons.length - 1]);
    fireEvent.click(await screen.findByRole('button', { name: 'The Sunken Corridor' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Set out' }));

    await waitFor(() => {
      expect(requests.some(item =>
        item.url.endsWith('/actions/stream') && item.body?.action === 'travel to The Sunken Corridor',
      )).toBe(true);
    });
  });

  it('offers the shrine quest at the correct location', async () => {
    const requests = setupApp([{
      ...mockCharacter,
      location: 'The Shrine of the Forgotten',
      quest_flags: {},
    }]);
    render(<App />);
    await screen.findByRole('heading', { name: /welcome back, rada/i });
    fireEvent.click(screen.getByRole('button', { name: /continue adventure/i }));

    const input = screen.getByLabelText('Your action');
    fireEvent.change(input, { target: { value: 'talk to Caldus about the shrine bell' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send action' }));

    await waitFor(() => {
      expect(requests.some(item =>
        item.url.endsWith('/actions/stream') && item.body?.action === 'talk to Caldus about the shrine bell',
      )).toBe(true);
    });
  });

  it('saves campaign settings and shows persistent journal events', async () => {
    const requests = setupApp([mockCharacter]);
    render(<App />);
    await screen.findByRole('heading', { name: /welcome back, rada/i });
    ensureBottomNav();
    openMoreSubscreen('Settings');
    expect(await screen.findByRole('heading', { name: /campaign mood and tone/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /dangerous hard/i }));
    await waitFor(() => expect(requests.some(item => item.url === `/api/characters/${mockCharacter.id}/settings` && item.body?.difficulty === 'hard')).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Adventure' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Your action' }), { target: { value: 'attack goblin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send action' }));
    await waitFor(() => expect(requests.some(item => item.url.endsWith('/actions/stream'))).toBe(true));
    const journal = screen.getByRole('log', { name: 'Adventure journal' });
    await waitFor(() => expect(journal.querySelector('.journal-narration')).toHaveTextContent('Steel rings.'));
    expect(await screen.findByText(/Attack roll: hit\./)).toBeInTheDocument();
    expect(within(journal).getByText('attack goblin')).toBeInTheDocument();
    expect(screen.queryByText(/built-in offline storyteller is narrating/i)).not.toBeInTheDocument();
    expect(requests.some(item => item.url.endsWith('/actions/stream') && item.method === 'POST')).toBe(true);
  });

  it('does not PATCH narration language when UI locale already matches the character', async () => {
    localStorage.setItem('app_locale', 'cs');
    const csHero = { ...mockCharacter, id: 'cs-hero', name: 'Mila', narration_language: 'cs' };
    const requests = setupApp([csHero]);
    render(<App />);
    await screen.findByRole('heading', { name: /Vítej zpět, mila/i });
    fireEvent.click(screen.getByRole('button', { name: /Pokračovat/i }));
    await screen.findByRole('heading', { name: /šeptající sklep/i });
    expect(requests.filter(item => item.url.endsWith('/settings') && item.body?.language)).toHaveLength(0);
  });

  it('syncs narration language to UI locale when the saved character differs', async () => {
    localStorage.setItem('app_locale', 'cs');
    const enHero = { ...mockCharacter, id: 'en-hero', name: 'Olek', narration_language: 'en' };
    const requests = setupApp([enHero]);
    render(<App />);
    await screen.findByRole('heading', { name: /Vítej zpět, olek/i });
    fireEvent.click(screen.getByRole('button', { name: /Pokračovat/i }));
    await screen.findByRole('heading', { name: /šeptající sklep/i });
    await waitFor(() => {
      expect(requests.some(
        item => item.url.endsWith('/settings') && item.body?.language === 'cs',
      )).toBe(true);
    });
  });

  it('changes narrator tier but makes no false promise of payments', async () => {
    const requests = setupApp([mockCharacter]);
    render(<App />);
    await screen.findByRole('heading', { name: /welcome back, rada/i });
    openMoreSubscreen('Settings');
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('?', { selector: 'summary' }));
    expect(screen.getByText('Narrator credits pay for changed turns at paid narration tiers. Lite turns, rests and no-op actions are free.')).toBeInTheDocument();
    expect(screen.getByText('Top-ups are not available yet', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Separate from spell slots; spellcaster classes spend slots to cast spells.')).toBeInTheDocument();
    expect(screen.getByText('Spell slots power casting for spellcaster classes. They are separate from narrator credits, which pay only for story turns.')).toBeInTheDocument();
    expect(screen.queryByText(/spell effects are not implemented yet/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'cs' } });
    expect(screen.getByText(/Kouzelné sloty pohánějí sesílání u sesílacích povolání/i)).toBeInTheDocument();
    expect(screen.getByText(/Je oddělena od kouzelných slotů/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Jazyk' }), { target: { value: 'en' } });
    expect(screen.queryByText(/SRD 5\.1 · Creative Commons/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Show attribution and license'));
    expect(screen.getByRole('link', { name: /official srd page/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /lite built-in offline storyteller/i }));
    await waitFor(() => expect(requests.some(item => item.url === '/api/economy/tier' && item.body?.tier === 'lite')).toBe(true));
    expect(screen.getByText(/top-ups are not available yet/i, { selector: 'p' })).toBeInTheDocument();
  });

  it('shows revive flow for a fallen hero instead of the narrator error panel', async () => {
    const fallen = { ...mockCharacter, hp: 0, in_combat: false, combatant: null, gold: 10 };
    const requests = setupApp([fallen]);
    render(<App />);
    await screen.findByRole('heading', { name: /welcome back, rada/i });
    fireEvent.click(screen.getByRole('button', { name: /revive hero/i }));
    expect(await screen.findByRole('heading', { name: 'You have fallen' })).toBeInTheDocument();
    expect(screen.queryByText(/thread of the weave/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Revive hero' }));
    await waitFor(() => expect(requests.some(item => item.url.endsWith('/revive'))).toBe(true));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'The Whispering Cellar' })).toBeInTheDocument());
  });

  const pitReadyFlags = {
    bell_quest_accepted: true,
    bell_acquired: true,
    bell_found: true,
    bell_quest_complete: true,
    vault_hint_given: true,
    vault_unlocked: true,
    vault_first_descent_story_awarded: true,
  };

  it('shows contextual coaching on Adventure for a new hero in the Whispering Cellar', async () => {
    setupApp([mockCharacter]);
    render(<App />);
    await screen.findByRole('heading', { name: /welcome back, rada/i });
    fireEvent.click(screen.getByRole('button', { name: 'Adventure' }));
    expect(
      await screen.findByText(/stolen shrine bell is missing somewhere below/i),
    ).toBeInTheDocument();
  });

  it('opens the Quests screen from View current quest on Adventure', async () => {
    setupApp([mockCharacter]);
    render(<App />);
    await screen.findByRole('heading', { name: /welcome back, rada/i });
    fireEvent.click(screen.getByRole('button', { name: 'Adventure' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View current quest' }));
    expect(await screen.findByRole('heading', { name: 'Quests' })).toBeInTheDocument();
  });

  it('warns below level 3 when the Bell Warden quest is active', async () => {
    const preBoss = {
      ...mockCharacter,
      level: 2,
      quest_flags: { ...pitReadyFlags },
    };
    setupApp([preBoss]);
    render(<App />);
    await screen.findByRole('heading', { name: /welcome back, rada/i });
    fireEvent.click(screen.getByRole('button', { name: 'Adventure' }));
    expect(await screen.findByText(/Bell Warden requires at least level 3/i)).toBeInTheDocument();
    expect(screen.getByText(/You are level 2/i)).toBeInTheDocument();
  });

  it('hides the Bell Warden level warning at level 3', async () => {
    const ready = {
      ...mockCharacter,
      level: 3,
      quest_flags: { ...pitReadyFlags },
    };
    setupApp([ready]);
    render(<App />);
    await screen.findByRole('heading', { name: /welcome back, rada/i });
    fireEvent.click(screen.getByRole('button', { name: 'Adventure' }));
    await screen.findByRole('button', { name: 'View current quest' });
    expect(screen.queryByText(/Bell Warden requires at least level 3/i)).not.toBeInTheDocument();
  });

  it('switches the interface to Czech and saves the preference', async () => {
    setupApp([mockCharacter]);
    const { container } = render(<App />);
    await screen.findByRole('heading', { name: /welcome back, rada/i });
    openMoreSubscreen('Settings');
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'cs' } });

    expect(await screen.findByRole('heading', { name: 'Nastavení' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Hlavní navigace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Přehled' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hra' })).toBeInTheDocument();
    expect(localStorage.getItem('app_locale')).toBe('cs');
    expect(document.documentElement.lang).toBe('cs');
    fireEvent.click(screen.getByRole('button', { name: 'Hra' }));
    expect(await screen.findByRole('heading', { name: 'Šeptající sklep' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Přehled' }));
    fireEvent.click(screen.getByRole('button', { name: 'Více' }));
    fireEvent.click(await screen.findByRole('button', { name: /dalsiho dobrodruha|dalšího dobrodruha/i }));
    expect(document.getElementById('wizard-title')).toHaveTextContent(/begin|zacit|začít/i);
  });
});
