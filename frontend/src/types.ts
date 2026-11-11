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
  item_instances?: ItemInstance[];
  location: string;
  visited_locations?: string[];
  quest_flags?: Record<string, boolean>;
  in_combat: boolean;
  combat_turn?: string;
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
  background?: string;
  skill_proficiencies?: string[];
  saving_throw_proficiencies?: string[];
  speed?: number;
  equipment_package?: string;
  alignment?: string;
  ideal?: string;
  bond?: string;
  flaw?: string;
  backstory?: string;
}

export interface ItemInstance {
  instance_id: string;
  definition_id: string;
  name: string;
  equipped: boolean;
  attack_bonus: number;
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
  mvp_playable?: boolean;
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
  mvp_playable?: boolean;
}

export interface QuestStepReference {
  id: string;
  label: string;
  hint: string;
  location?: string | null;
}

export interface QuestCatalog {
  campaigns: Array<{
    id: string;
    title: string;
    category: string;
    steps: QuestStepReference[];
  }>;
  side_quests: Array<{
    id: string;
    title: string;
    hint: string;
    location: string;
    reward_flag: string;
  }>;
}

export interface RulesetReference {
  edition: string;
  label: string;
  max_level: number;
  mvp_races: string[];
  mvp_classes: string[];
  notes: string;
}

export interface BackgroundReference {
  key?: string;
  name: string;
  mvp_playable?: boolean;
  skill_proficiencies: string[];
  languages: string | number;
  equipment: string[];
  feature: { name: string; text: string };
}

export interface CharacterCreationReference {
  standard_array: number[];
  ability_order: string[];
  skill_abilities: Record<string, string>;
  backgrounds: BackgroundReference[];
  class_skill_picks: Record<string, { options: string[]; count: number }>;
  equipment_packages: Record<string, Record<string, string[]>>;
  spell_pick_limits: Record<string, Record<string, number>>;
  spell_options?: Record<string, { cantrips: string[]; level_one: string[] }>;
  personality_fields: string[];
}

export interface ReferenceCatalog {
  ruleset?: RulesetReference;
  quests?: QuestCatalog;
  races: RaceReference[];
  classes: ClassReference[];
  feats: Array<{ name: string; prerequisite: string; benefits: string[] }>;
  backgrounds: BackgroundReference[];
  character_creation?: CharacterCreationReference;
  draconic_ancestry: Record<string, { damage_type: string; breath_weapon: string }>;
  locations: LocationReference[];
}

export interface LocationReference {
  name: string;
  connections: string[];
  arrival_beat?: string;
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

export const MORE_HUB_SCREENS: AppScreen[] = ['more', 'journal', 'settings', 'tools', 'campaign', 'map'];
export const CHARACTER_HUB_SCREENS: AppScreen[] = ['character'];
