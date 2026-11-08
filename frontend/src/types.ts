export interface Character {
  id: string;
  name: string;
  race: string;
  character_class: string;
  level: number;
  abilities: Record<string, number>;
  hp: number;
  max_hp: number;
  armor_class: number;
  mana: number;
  max_mana: number;
  xp: number;
  gold: number;
  inventory: string[];
  location: string;
  visited_locations?: string[];
  quest_flags?: Record<string, boolean>;
  in_combat: boolean;
  combatant?: Combatant | null;
  spell_slots: Record<string, number>;
  max_spell_slots: Record<string, number>;
  known_spells: string[];
  prepared_spells: string[];
  spellcasting_ability: string;
  invisible?: boolean;
  difficulty: string;
  tone: string;
  humor: string;
  verbose: boolean;
  narration_language?: string;
}

export interface Combatant {
  name: string;
  hp: number;
  max_hp: number;
  armor_class: number;
}

export interface RaceReference {
  key: string;
  name: string;
  speed: number;
  ability_increase: Record<string, number>;
  subraces: string[];
  traits: Array<{ name: string; text: string }>;
}

export interface ClassReference {
  key: string;
  name: string;
  hit_die: number;
  primary: string;
  saving_throws: string[];
  armor: string[];
  weapons: string[];
  subclasses: Array<{ name: string; text: string }>;
}

export interface ReferenceCatalog {
  races: RaceReference[];
  classes: ClassReference[];
  feats: Array<{ name: string; prerequisite: string; benefits: string[] }>;
  backgrounds: Array<{
    name: string;
    skill_proficiencies: string[];
    languages: string;
    equipment: string[];
    feature: { name: string; text: string };
  }>;
  draconic_ancestry: Record<string, { damage_type: string; breath_weapon: string }>;
  locations: LocationReference[];
}

export interface LocationReference {
  name: string;
  connections: string[];
}

export interface HeroPreset {
  key: string;
  name: string;
  race: string;
  character_class: string;
  role: string;
}

export interface JournalEvent {
  id: number;
  action: string;
  result: string;
  created_at: string;
}

export interface Spell {
  name: string;
  level: number;
  school: string;
  range: string;
  text: string;
  effect_modeled: boolean;
}

export interface Economy {
  balance: number;
  balance_tenths: number;
  tier: string;
  tiers: Array<{ key: string; label: string; cost: number; description: string }>;
  packages: Array<{ key: string; label: string; mana: number; price_rub: number }>;
}

export type AppScreen =
  | 'home'
  | 'game'
  | 'create'
  | 'character'
  | 'campaign'
  | 'tools'
  | 'settings'
  | 'map'
  | 'quests'
  | 'journal'
  | 'more';

export const MORE_HUB_SCREENS: AppScreen[] = ['more', 'journal', 'settings', 'tools', 'campaign'];
