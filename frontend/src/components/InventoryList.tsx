import { useState } from 'react';
import { useI18n } from '../i18n';
import { inventoryItemMeta } from '../game/inventoryCatalog';

export function InventoryList({ items }: { items: string[] }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);

  if (!items.length) {
    return <p className="empty-note">{t('Your pack is empty')}</p>;
  }

  const active = selected ? inventoryItemMeta(selected) : null;

  return (
    <>
      <div className="inventory-grid">
        {items.map((item, index) => {
          const meta = inventoryItemMeta(item);
          return (
            <button
              type="button"
              key={`${item}-${index}`}
              className="inventory-item-card"
              onClick={() => setSelected(item)}
              aria-label={`${t(meta.nameKey)}: ${item}`}
            >
              <span className="inventory-item-icon" aria-hidden="true">{meta.icon}</span>
              <span className="inventory-item-label">{t(meta.nameKey)}</span>
            </button>
          );
        })}
      </div>
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
            <button type="button" className="primary" onClick={() => setSelected(null)}>
              {t('Close')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
