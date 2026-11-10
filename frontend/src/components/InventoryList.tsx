import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { inventoryItemMeta, inventoryItemCategory } from '../game/inventoryCatalog';
import type { Character, ItemInstance } from '../types';

type InventoryListProps = {
  character: Character;
  busy?: boolean;
  onInventoryAction?: (action: string) => void;
};

function equippedForLabel(instances: ItemInstance[] | undefined, label: string): boolean {
  const key = label.toLowerCase();
  return Boolean(instances?.find(entry => entry.name.toLowerCase() === key && entry.equipped));
}

export function InventoryList({ character, busy = false, onInventoryAction }: InventoryListProps) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const items = character.inventory ?? [];
  const instances = character.item_instances ?? [];

  const groups = useMemo(() => {
    const equipped: string[] = [];
    const weapons: string[] = [];
    const consumables: string[] = [];
    const other: string[] = [];
    for (const item of items) {
      const category = inventoryItemCategory(item);
      const isEquipped = equippedForLabel(instances, item);
      if (isEquipped) equipped.push(item);
      else if (category === 'weapon') weapons.push(item);
      else if (category === 'consumable') consumables.push(item);
      else other.push(item);
    }
    return { equipped, weapons, consumables, other };
  }, [items, instances]);

  if (!items.length) {
    return <p className="empty-note">{t('Your pack is empty')}</p>;
  }

  const active = selected ? inventoryItemMeta(selected) : null;
  const activeInstance = selected
    ? instances.find(entry => entry.name.toLowerCase() === selected.toLowerCase())
    : undefined;
  const category = selected ? inventoryItemCategory(selected) : null;
  const canUsePotion = category === 'consumable' && character.hp < character.max_hp;
  const canEquip = category === 'weapon' && selected && !equippedForLabel(instances, selected);

  const renderSection = (title: string, sectionItems: string[]) => {
    if (!sectionItems.length) return null;
    return (
      <div className="inventory-section">
        <p className="inventory-section-label">{title}</p>
        <div className="inventory-grid">
          {sectionItems.map((item, index) => {
            const meta = inventoryItemMeta(item);
            const isEquipped = equippedForLabel(instances, item);
            return (
              <button
                type="button"
                key={`${item}-${index}`}
                className={`inventory-item-card${isEquipped ? ' equipped' : ''}`}
                onClick={() => setSelected(item)}
                aria-label={`${t(meta.nameKey)}: ${item}`}
              >
                <span className="inventory-item-icon" aria-hidden="true">{meta.icon}</span>
                <span className="inventory-item-label">{t(meta.nameKey)}</span>
                {isEquipped && <span className="inventory-equipped-tag">{t('Equipped')}</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {renderSection(t('Equipped gear'), groups.equipped)}
      {renderSection(t('Weapons'), groups.weapons)}
      {renderSection(t('Consumables'), groups.consumables)}
      {renderSection(t('Other gear'), groups.other)}

      {active && selected && (
        <div
          className="inventory-detail-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inventory-detail-title"
          onClick={() => setSelected(null)}
        >
          <div className="inventory-detail-card" onClick={event => event.stopPropagation()}>
            <span className="inventory-detail-icon" aria-hidden="true">{active.icon}</span>
            <h3 id="inventory-detail-title">{selected}</h3>
            <p>{t(active.descriptionKey)}</p>
            {activeInstance?.equipped && activeInstance.attack_bonus > 0 && (
              <p className="inventory-stat-line">
                {t('Attack bonus')}: +{activeInstance.attack_bonus}
              </p>
            )}
            <div className="inventory-detail-actions">
              {canEquip && onInventoryAction && (
                <button
                  type="button"
                  className="primary"
                  disabled={busy}
                  onClick={() => {
                    onInventoryAction(`equip ${selected}`);
                    setSelected(null);
                  }}
                >
                  {t('Equip')}
                </button>
              )}
              {canUsePotion && onInventoryAction && (
                <button
                  type="button"
                  className="primary"
                  disabled={busy}
                  onClick={() => {
                    onInventoryAction('use potion');
                    setSelected(null);
                  }}
                >
                  {t('Use potion')}
                </button>
              )}
              <button type="button" className="ghost" onClick={() => setSelected(null)}>
                {t('Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
