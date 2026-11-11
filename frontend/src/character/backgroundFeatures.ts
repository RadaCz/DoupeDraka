import type { Character } from '../types';

export type BackgroundFeatureUi = {
  backgroundKey: string;
  nameKey: string;
  descriptionKey: string;
  location: string;
  chipAction: string;
  chipLabelKey: string;
  usedFlag: string;
};

export const BACKGROUND_FEATURES: BackgroundFeatureUi[] = [
  {
    backgroundKey: 'acolyte',
    nameKey: 'Shelter of the Faithful',
    descriptionKey: 'Temple shelter at the Shrine reveals the thief\'s route.',
    location: 'The Shrine of the Forgotten',
    chipAction: 'seek shelter of the faithful',
    chipLabelKey: 'Seek temple shelter',
    usedFlag: 'bg_acolyte_shelter_used',
  },
  {
    backgroundKey: 'criminal',
    nameKey: 'Criminal Contact',
    descriptionKey: 'A contact at the Goblin Market confirms stolen goods and bells.',
    location: 'The Goblin Market',
    chipAction: 'use criminal contact',
    chipLabelKey: 'Use criminal contact',
    usedFlag: 'bg_criminal_contact_used',
  },
  {
    backgroundKey: 'folk_hero',
    nameKey: 'Rustic Hospitality',
    descriptionKey: 'Common folk aid you in the Sunken Corridor.',
    location: 'The Sunken Corridor',
    chipAction: 'call on rustic hospitality',
    chipLabelKey: 'Call on rustic hospitality',
    usedFlag: 'bg_folk_hero_hospitality_used',
  },
  {
    backgroundKey: 'sage',
    nameKey: 'Researcher',
    descriptionKey: 'Scholarly training reveals lore in the Vault of Echoes.',
    location: 'The Vault of Echoes',
    chipAction: 'use researcher training',
    chipLabelKey: 'Use researcher training',
    usedFlag: 'bg_sage_researcher_used',
  },
  {
    backgroundKey: 'soldier',
    nameKey: 'Military Rank',
    descriptionKey: 'Bandits recognize rank at the Bandit Camp.',
    location: 'The Bandit Camp',
    chipAction: 'invoke military rank',
    chipLabelKey: 'Invoke military rank',
    usedFlag: 'bg_soldier_rank_used',
  },
  {
    backgroundKey: 'hermit',
    nameKey: 'Discovery',
    descriptionKey: 'A personal revelation lights the Underground River.',
    location: 'The Underground River',
    chipAction: 'share hermit discovery',
    chipLabelKey: 'Share hermit discovery',
    usedFlag: 'bg_hermit_discovery_used',
  },
];

export function backgroundFeatureFor(character: Character): BackgroundFeatureUi | null {
  const key = (character.background ?? '').toLowerCase().replace(/\s+/g, '_');
  return BACKGROUND_FEATURES.find(row => row.backgroundKey === key) ?? null;
}

export function backgroundFeatureUsed(character: Character, spec: BackgroundFeatureUi): boolean {
  return Boolean(character.quest_flags?.[spec.usedFlag]);
}

export function backgroundFeatureAvailable(character: Character, spec: BackgroundFeatureUi): boolean {
  if (character.in_combat || character.hp <= 0) return false;
  if (character.location !== spec.location) return false;
  return !backgroundFeatureUsed(character, spec);
}
