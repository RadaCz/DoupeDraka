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
    match: key => key.includes('armor') || key.includes('clothes') || key.includes('leather'),
    meta: {
      icon: '🛡️',
      nameKey: 'Adventuring gear',
      descriptionKey: 'Worn gear that shapes your look in the story. Armor class comes from class and stats.',
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
