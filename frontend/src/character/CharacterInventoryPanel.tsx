import { useEffect, useMemo, useState } from 'react';
import type { Character } from '../types';
import { useI18n } from '../i18n';
import { displayInventoryLabel } from '../i18n/gameDisplay';
import { inventoryItemCategory, inventoryItemMeta } from '../game/inventoryCatalog';
import {
  canWieldInventoryItem,
  describeItemType,
  equipBlocked,
  inventoryCounts,
  itemDetailDescription,
  itemEquipped,
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
    const consumables: typeof rows = [];
    const gear: typeof rows = [];
    for (const row of rows) {
      const key = row.label.toLowerCase();
      if (key.includes('potion')) consumables.push(row);
      else if (key.includes('sword') || key.includes('dagger') || key.includes('mace') || key.includes('rapier') || key.includes('bow')) {
        weapons.push(row);
      } else gear.push(row);
    }
    return { weapons, consumables, gear };
  }, [rows]);

  if (!rows.length) {
    return <p className="empty-note">{t('Your pack is empty')}</p>;
  }

  const activeLabel = selected;
  const meta = activeLabel ? inventoryItemMeta(activeLabel) : null;
  const isEquipped = activeLabel ? itemEquipped(instances, activeLabel) : false;
  const wieldable = activeLabel ? canWieldInventoryItem(activeLabel) : false;
  const potionBlock = potionUseBlocked(character);
  const equipTurnBlock = equipBlocked(character);
  const isPotion = activeLabel?.toLowerCase().includes('potion');

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
            const equipped = itemEquipped(instances, label);
            return (
              <button
                type="button"
                key={label}
                className={`inventory-item-card${equipped ? ' equipped' : ''}`}
                onClick={() => setSelected(label)}
                aria-label={`${t(itemMeta.nameKey)}: ${label}`}
              >
                <span className="inventory-item-icon" aria-hidden="true">{itemMeta.icon}</span>
                <span className="inventory-item-label">{displayInventoryLabel(label, locale)}</span>
                {count > 1 && <span className="char-v2-item-qty">×{count}</span>}
                {equipped && <span className="inventory-equipped-tag">{t('Equipped')}</span>}
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
            {isEquipped && wieldable && (
              <p className="inventory-stat-line">{t('This weapon is currently wielded.')}</p>
            )}
            {!wieldable && inventoryItemCategory(activeLabel) === 'weapon' && (
              <p className="char-v2-item-note">{t('This item cannot be wielded as a weapon.')}</p>
            )}
            <div className="inventory-detail-actions">
              {wieldable && onInventoryAction && !isEquipped && (
                <button
                  type="button"
                  className="primary"
                  disabled={busy || Boolean(equipTurnBlock)}
                  aria-busy={busy && lastSent === `equip ${activeLabel}` ? true : undefined}
                  title={equipTurnBlock ?? undefined}
                  onClick={() => fire(`equip ${activeLabel}`)}
                >
                  {t('Equip')}
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
