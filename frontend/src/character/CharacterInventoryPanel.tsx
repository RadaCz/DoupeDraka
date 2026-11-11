import { useEffect, useMemo, useState } from 'react';
import type { Character } from '../types';
import { useI18n } from '../i18n';
import { displayInventoryLabel } from '../i18n/gameDisplay';
import { inventoryItemCategory, inventoryItemMeta } from '../game/inventoryCatalog';
import { armorImpactHint, equipBlockReason, gearKind, isEquippableGear } from '../game/equipmentRules';
import {
  canWieldInventoryItem,
  describeItemType,
  equipBlocked,
  inventoryCounts,
  itemDetailDescription,
  itemEquippedSlot,
  potionUseBlocked,
} from './characterSheet';

type Props = {
  character: Character;
  busy?: boolean;
  onInventoryAction?: (action: string) => void;
};

export function CharacterInventoryPanel({ character, busy = false, onInventoryAction }: Props) {
  const { t, locale } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState('');
  const instances = character.item_instances ?? [];
  const rows = useMemo(() => inventoryCounts(character.inventory ?? []), [character.inventory]);

  useEffect(() => {
    if (!busy) setLastSent('');
  }, [busy]);

  const grouped = useMemo(() => {
    const weapons: typeof rows = [];
    const armorShields: typeof rows = [];
    const consumables: typeof rows = [];
    const gear: typeof rows = [];
    for (const row of rows) {
      const kind = gearKind(row.label);
      if (kind === 'weapon') weapons.push(row);
      else if (kind === 'armor' || kind === 'shield') armorShields.push(row);
      else if (row.label.toLowerCase().includes('potion')) consumables.push(row);
      else gear.push(row);
    }
    return { weapons, armorShields, consumables, gear };
  }, [rows]);

  if (!rows.length) {
    return <p className="empty-note">{t('Your pack is empty')}</p>;
  }

  const activeLabel = selected;
  const meta = activeLabel ? inventoryItemMeta(activeLabel) : null;
  const equippedSlot = activeLabel ? itemEquippedSlot(instances, activeLabel) : null;
  const wieldable = activeLabel ? canWieldInventoryItem(activeLabel) : false;
  const equippable = activeLabel ? isEquippableGear(activeLabel) : false;
  const potionBlock = potionUseBlocked(character);
  const equipTurnBlock = equipBlocked(character);
  const proficiencyBlock = activeLabel ? equipBlockReason(character, activeLabel) : null;
  const isPotion = activeLabel?.toLowerCase().includes('potion');
  const acHint = activeLabel ? armorImpactHint(character, activeLabel) : null;

  const fire = (action: string) => {
    if (busy || !onInventoryAction || !action.trim()) return;
    if (lastSent === action) return;
    setLastSent(action);
    onInventoryAction(action);
    setSelected(null);
  };

  const renderGrid = (title: string, items: typeof rows) => {
    if (!items.length) return null;
    return (
      <div className="inventory-section">
        <p className="inventory-section-label">{title}</p>
        <div className="inventory-grid char-v2-inventory-grid">
          {items.map(({ label, count }) => {
            const itemMeta = inventoryItemMeta(label);
            const slot = itemEquippedSlot(instances, label);
            return (
              <button
                type="button"
                key={label}
                className={`inventory-item-card${slot ? ' equipped' : ''}`}
                onClick={() => setSelected(label)}
                aria-label={`${t(itemMeta.nameKey)}: ${label}`}
              >
                <span className="inventory-item-icon" aria-hidden="true">{itemMeta.icon}</span>
                <span className="inventory-item-label">{displayInventoryLabel(label, locale)}</span>
                {count > 1 && <span className="char-v2-item-qty">×{count}</span>}
                {slot && <span className="inventory-equipped-tag">{t('Equipped')}</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {renderGrid(t('Weapons'), grouped.weapons)}
      {renderGrid(t('Armor & shields'), grouped.armorShields)}
      {renderGrid(t('Consumables'), grouped.consumables)}
      {renderGrid(t('Other gear'), grouped.gear)}

      {activeLabel && meta && (
        <div
          className="inventory-detail-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inventory-detail-title"
          onClick={() => !busy && setSelected(null)}
        >
          <div className="inventory-detail-card char-v2-item-dialog" onClick={event => event.stopPropagation()}>
            <span className="inventory-detail-icon" aria-hidden="true">{meta.icon}</span>
            <h3 id="inventory-detail-title">{displayInventoryLabel(activeLabel, locale)}</h3>
            <p className="char-v2-item-type">{describeItemType(activeLabel, t)}</p>
            <p>{itemDetailDescription(activeLabel, t)}</p>
            {acHint && <p className="inventory-stat-line">{t(acHint)}</p>}
            <p className="inventory-stat-line">
              {t('Armor class')}: <strong>{character.armor_class}</strong>
            </p>
            {equippedSlot === 'weapon' && wieldable && (
              <p className="inventory-stat-line">{t('This weapon is currently wielded.')}</p>
            )}
            {equippedSlot === 'armor' && (
              <p className="inventory-stat-line">{t('This armor is currently worn.')}</p>
            )}
            {equippedSlot === 'shield' && (
              <p className="inventory-stat-line">{t('This shield is currently equipped.')}</p>
            )}
            {proficiencyBlock && (
              <p className="char-v2-item-note" role="note">{t(proficiencyBlock)}</p>
            )}
            {!wieldable && inventoryItemCategory(activeLabel) === 'weapon' && gearKind(activeLabel) !== 'weapon' && (
              <p className="char-v2-item-note">{t('This item cannot be wielded as a weapon.')}</p>
            )}
            <div className="inventory-detail-actions">
              {equippable && onInventoryAction && !equippedSlot && (
                <button
                  type="button"
                  className="primary"
                  disabled={busy || Boolean(equipTurnBlock) || Boolean(proficiencyBlock)}
                  aria-busy={busy && lastSent === `equip ${activeLabel}` ? true : undefined}
                  title={equipTurnBlock ?? proficiencyBlock ?? undefined}
                  onClick={() => fire(`equip ${activeLabel}`)}
                >
                  {t('Equip')}
                </button>
              )}
              {equippedSlot === 'armor' && onInventoryAction && (
                <button
                  type="button"
                  className="ghost"
                  disabled={busy || Boolean(equipTurnBlock)}
                  onClick={() => fire('unequip armor')}
                >
                  {t('Unequip armor')}
                </button>
              )}
              {equippedSlot === 'shield' && onInventoryAction && (
                <button
                  type="button"
                  className="ghost"
                  disabled={busy || Boolean(equipTurnBlock)}
                  onClick={() => fire('unequip shield')}
                >
                  {t('Unequip shield')}
                </button>
              )}
              {isPotion && onInventoryAction && (
                <button
                  type="button"
                  className="primary"
                  disabled={busy || Boolean(potionBlock)}
                  aria-busy={busy && lastSent === 'use potion' ? true : undefined}
                  title={potionBlock ?? undefined}
                  onClick={() => fire('use potion')}
                >
                  {t('Use potion')}
                </button>
              )}
              {isPotion && potionBlock && (
                <p className="char-v2-item-note" role="note">{t(potionBlock)}</p>
              )}
              <button type="button" className="ghost" disabled={busy} onClick={() => setSelected(null)}>
                {t('Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
