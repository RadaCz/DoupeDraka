/** Client-side hints for armor/shield equip — engine is authoritative on actions. */

import type { Character } from '../types';

export type ArmorCategory = 'light' | 'medium' | 'heavy' | 'shield';

export interface ArmorRule {
  category: ArmorCategory;
  baseAc: number;
  maxDexBonus: number | null;
  strengthRequirement?: number;
  acHintKey: string;
}

const ARMOR_RULES: Record<string, ArmorRule> = {
  'leather armor': {
    category: 'light',
    baseAc: 11,
    maxDexBonus: null,
    acHintKey: 'Light armor: base AC + full Dexterity modifier.',
  },
  'studded leather': {
    category: 'light',
    baseAc: 12,
    maxDexBonus: null,
    acHintKey: 'Light armor: base AC + full Dexterity modifier.',
  },
  'scale mail': {
    category: 'medium',
    baseAc: 14,
    maxDexBonus: 2,
    acHintKey: 'Medium armor: base AC + Dexterity modifier (max +2).',
  },
  'chain mail': {
    category: 'heavy',
    baseAc: 16,
    maxDexBonus: 0,
    strengthRequirement: 13,
    acHintKey: 'Heavy armor: fixed base AC; no Dexterity bonus.',
  },
  shield: {
    category: 'shield',
    baseAc: 2,
    maxDexBonus: null,
    acHintKey: 'Shield: +2 to armor class while equipped.',
  },
};

const CLASS_PROFICIENCY: Record<
  string,
  { armor: Set<ArmorCategory>; shields: boolean }
> = {
  fighter: { armor: new Set(['light', 'medium', 'heavy']), shields: true },
  cleric: { armor: new Set(['light', 'medium', 'heavy']), shields: true },
  rogue: { armor: new Set(['light']), shields: false },
  wizard: { armor: new Set(), shields: false },
};

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function armorRuleForLabel(label: string): ArmorRule | null {
  return ARMOR_RULES[label.toLowerCase().trim()] ?? null;
}

export function isEquippableGear(label: string): boolean {
  const key = label.toLowerCase().trim();
  return (
    key in ARMOR_RULES
    || ['shortsword +1', 'shortsword', 'longsword', 'rapier', 'mace', 'dagger'].includes(key)
  );
}

export function gearKind(label: string): 'weapon' | 'armor' | 'shield' | 'other' {
  const rule = armorRuleForLabel(label);
  if (rule?.category === 'shield') return 'shield';
  if (rule && rule.category !== 'shield') return 'armor';
  const key = label.toLowerCase().trim();
  if (['shortsword +1', 'shortsword', 'longsword', 'rapier', 'mace', 'dagger'].some(w => key.includes(w))) {
    return 'weapon';
  }
  return 'other';
}

export function equipBlockReason(character: Character, label: string): string | null {
  const kind = gearKind(label);
  if (kind === 'other') return null;
  const prof = CLASS_PROFICIENCY[character.character_class] ?? { armor: new Set(), shields: false };
  const rule = armorRuleForLabel(label);
  if (kind === 'armor' && rule) {
    if (!prof.armor.has(rule.category)) {
      if (character.character_class === 'wizard' && rule.category === 'heavy') {
        return 'Your wizard training does not include heavy armor.';
      }
      return `Your ${character.character_class} training does not include ${rule.category} armor.`;
    }
    const req = rule.strengthRequirement ?? 0;
    const str = character.abilities?.strength ?? 10;
    if (req > 0 && str < req) {
      return `You need Strength ${req} to wear this armor.`;
    }
  }
  if (kind === 'shield' && !prof.shields) {
    return 'You are not proficient with shields.';
  }
  return null;
}

export function armorImpactHint(character: Character, label: string): string | null {
  const rule = armorRuleForLabel(label);
  if (!rule) return null;
  if (rule.category === 'shield') return rule.acHintKey;
  const dex = abilityMod(character.abilities?.dexterity ?? 10);
  if (rule.category === 'heavy') return `${rule.acHintKey} (${rule.baseAc} AC while worn).`;
  if (rule.category === 'medium') {
    const cap = rule.maxDexBonus ?? 2;
    return `${rule.acHintKey} (${rule.baseAc} +${Math.min(dex, cap)} = ${rule.baseAc + Math.min(dex, cap)} body AC).`;
  }
  return `${rule.acHintKey} (${rule.baseAc} +${dex} = ${rule.baseAc + dex} body AC).`;
}
