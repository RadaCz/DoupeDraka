export interface InventoryItemMeta {
  icon: string;
  nameKey: string;
  descriptionKey: string;
}

const RULES: Array<{ match: (key: string) => boolean; meta: InventoryItemMeta }> = [
  {
    match: key => key.includes('shortsword') && key.includes('+1'),
    meta: {
      icon: '🗡️',
      nameKey: 'Shortsword +1',
      descriptionKey: 'Shortsword +1: +1 to attack rolls. 1d6 piercing damage (finesse).',
    },
  },
  {
    match: key => key.includes('shortsword') || key.includes('longsword') || key.includes('rapier'),
    meta: {
      icon: '🗡️',
      nameKey: 'Shortsword',
      descriptionKey: 'One-handed blade. 1d6 piercing damage; martial characters fight with full proficiency.',
    },
  },
  {
    match: key => key.includes('longbow'),
    meta: { icon: '🏹', nameKey: 'Longbow', descriptionKey: 'Ranged weapon. Uses Dexterity for attack and damage.' },
  },
  {
    match: key => key.includes('bow') || key.includes('crossbow'),
    meta: { icon: '🏹', nameKey: 'Ranged weapon', descriptionKey: 'Ranged weapon. Uses Dexterity for attack and damage.' },
  },
  {
    match: key => key.includes('dagger'),
    meta: { icon: '🗡️', nameKey: 'Dagger', descriptionKey: 'Light blade. 1d4 piercing; finesse and throwable.' },
  },
  {
    match: key => key.includes('mace'),
    meta: { icon: '🔨', nameKey: 'Mace', descriptionKey: 'Simple bludgeon. 1d6 bludgeoning damage.' },
  },
  {
    match: key => key.includes('potion'),
    meta: {
      icon: '🧪',
      nameKey: 'Healing potion',
      descriptionKey: 'Healing potion: drink to restore 2d4+2 HP (one use).',
    },
  },
  {
    match: key => key.includes('bell'),
    meta: {
      icon: '🔔',
      nameKey: 'Shrine bell',
      descriptionKey: 'A stolen shrine bell. Caldus at the Shrine of the Forgotten will reward its return.',
    },
  },
  {
    match: key => key.includes('chain mail'),
    meta: {
      icon: '🛡️',
      nameKey: 'Chain mail',
      descriptionKey: 'Heavy armor. AC 16 when worn (Strength 13). No Dexterity bonus.',
    },
  },
  {
    match: key => key.includes('scale mail'),
    meta: {
      icon: '🛡️',
      nameKey: 'Scale mail',
      descriptionKey: 'Medium armor. AC 14 + Dexterity modifier (max +2).',
    },
  },
  {
    match: key => key.includes('studded'),
    meta: {
      icon: '🛡️',
      nameKey: 'Studded leather',
      descriptionKey: 'Light armor. AC 12 + full Dexterity modifier.',
    },
  },
  {
    match: key => key.includes('leather armor'),
    meta: {
      icon: '🛡️',
      nameKey: 'Leather armor',
      descriptionKey: 'Light armor. AC 11 + full Dexterity modifier.',
    },
  },
  {
    match: key => key.includes('clothes'),
    meta: {
      icon: '🎽',
      nameKey: 'Travel gear',
      descriptionKey: 'Adventuring clothes. No armor bonus.',
    },
  },
  {
    match: key => key.includes('shield'),
    meta: { icon: '🛡️', nameKey: 'Shield', descriptionKey: 'Shield or buckler. Extra protection when equipped.' },
  },
];

const DEFAULT_META: InventoryItemMeta = {
  icon: '🎒',
  nameKey: 'Adventuring gear',
  descriptionKey: 'Equipment carried on the road. Details may unfold as the story progresses.',
};

export function inventoryItemMeta(rawLabel: string): InventoryItemMeta & { displayName: string } {
  const key = rawLabel.toLowerCase().trim();
  const rule = RULES.find(entry => entry.match(key));
  const meta = rule?.meta ?? DEFAULT_META;
  return { ...meta, displayName: rawLabel };
}

export type InventoryCategory = 'weapon' | 'consumable' | 'gear';

export function inventoryItemCategory(rawLabel: string): InventoryCategory {
  const key = rawLabel.toLowerCase().trim();
  if (key.includes('potion') || key.includes('lektvar')) return 'consumable';
  if (key.includes('sword') || key.includes('dagger') || key.includes('mace') || key.includes('rapier') || key.includes('bow')) {
    return 'weapon';
  }
  return 'gear';
}
