import { describe, expect, it } from 'vitest';
import { inventoryItemCategory } from './inventoryCatalog';

describe('inventoryItemCategory', () => {
  it('classifies weapons and consumables for inventory UI', () => {
    expect(inventoryItemCategory('healing potion')).toBe('consumable');
    expect(inventoryItemCategory('shortsword +1')).toBe('weapon');
    expect(inventoryItemCategory("traveler's clothes")).toBe('gear');
  });
});
