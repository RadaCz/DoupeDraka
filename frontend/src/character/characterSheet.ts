import type { Character, ItemInstance } from '../types';
import { inventoryItemMeta, inventoryItemCategory } from '../game/inventoryCatalog';

/** Mirrors app/engine/service.py XP_THRESHOLD — display only. */
export const XP_PER_LEVEL = 100;

export const ABILITY_KEYS = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
] as const;

export type AbilityKey = (typeof ABILITY_KEYS)[number];

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(score: number): string {
  const value = abilityModifier(score);
  return `${value >= 0 ? '+' : ''}${value}`;
}

/** Labels passed through t() in UI */
export const ABILITY_LABEL_KEYS: Record<AbilityKey, string> = {
  strength: 'Strength',
  dexterity: 'Dexterity',
  constitution: 'Constitution',
  intelligence: 'Intelligence',
  wisdom: 'Wisdom',
  charisma: 'Charisma',
};

export const ABILITY_HINT_KEYS: Record<AbilityKey, string> = {
  strength: 'Melee power and athletic feats.',
  dexterity: 'Agility, reflexes, and finesse.',
  constitution: 'Endurance and health.',
  intelligence: 'Reasoning and arcane knowledge.',
  wisdom: 'Perception, insight, and willpower.',
  charisma: 'Force of personality and leadership.',
};

/** Inventory labels the engine can wield (app/engine/equipment.INVENTORY_GEAR). */
const WIELDABLE_INVENTORY_KEYS = new Set([
  'shortsword +1',
  'shortsword',
  'longsword',
  'rapier',
  'mace',
  'dagger',
]);

export function canWieldInventoryItem(label: string): boolean {
  return WIELDABLE_INVENTORY_KEYS.has(label.toLowerCase().trim());
}

export function equippedWeaponInstance(instances: ItemInstance[] | undefined): ItemInstance | null {
  if (!instances?.length) return null;
  return instances.find(entry => entry.equipped && entry.attack_bonus >= 0) ?? instances.find(entry => entry.equipped) ?? null;
}

export function inventoryCounts(inventory: string[]): Array<{ label: string; count: number }> {
  const map = new Map<string, number>();
  for (const raw of inventory) {
    const key = raw.toLowerCase().trim();
    const existing = [...map.entries()].find(([label]) => label.toLowerCase().trim() === key);
    if (existing) map.set(existing[0], existing[1] + 1);
    else map.set(raw, 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function xpProgress(xp: number): { current: number; threshold: number } {
  const threshold = XP_PER_LEVEL;
  const current = xp >= threshold ? threshold : xp;
  return { current, threshold };
}

export function potionUseBlocked(character: Character): string | null {
  const hasPotion = character.inventory.some(item => item.toLowerCase().includes('potion'));
  if (!hasPotion) return 'No healing potion in your inventory.';
  if (character.hp >= character.max_hp) return 'You are already at full health.';
  if (character.in_combat && character.combat_turn === 'enemy') {
    return 'Wait for your turn in combat before drinking a potion.';
  }
  return null;
}

export function equipBlocked(character: Character): string | null {
  if (character.in_combat && character.combat_turn === 'enemy') {
    return 'Wait for your turn in combat before changing weapons.';
  }
  return null;
}

export function itemEquipped(instances: ItemInstance[] | undefined, label: string): boolean {
  const key = label.toLowerCase().trim();
  return Boolean(instances?.find(entry => entry.name.toLowerCase().trim() === key && entry.equipped));
}

export function describeItemType(label: string, t: (s: string) => string): string {
  const category = inventoryItemCategory(label);
  if (category === 'weapon') return t('Weapon');
  if (category === 'consumable') return t('Consumable');
  return t('Gear');
}

export function itemDetailDescription(label: string, t: (s: string) => string): string {
  const meta = inventoryItemMeta(label);
  return t(meta.descriptionKey);
}
