import type { Character, Spell } from '../types';
import { useI18n } from '../i18n';
import { titleCase } from '../components/characterVitals';
import {
  buildCastAction,
  castBlockReasonKey,
  CAST_BLOCK_MESSAGES,
  spellEngineKind,
} from './spellbook';

const KIND_LABEL: Record<string, string> = {
  attack: 'Attack spell',
  healing: 'Healing',
  save: 'Saving throw',
  utility: 'Utility',
  unsupported: 'Not modeled',
};

export function SpellDetailSheet({
  spell,
  character,
  busy,
  lastCast,
  onClose,
  onCast,
}: {
  spell: Spell;
  character: Character;
  busy?: boolean;
  lastCast?: string;
  onClose: () => void;
  onCast: (action: string) => void;
}) {
  const { t } = useI18n();
  const block = castBlockReasonKey(character, spell, Boolean(busy));
  const blockMessage = block ? t(CAST_BLOCK_MESSAGES[block]) : null;
  const kind = spellEngineKind(spell);
  const action = buildCastAction(character, spell.name);
  const canCast = block === null;

  return (
    <div className="inventory-detail-overlay" role="dialog" aria-modal="true" aria-labelledby="spell-detail-title" onClick={() => !busy && onClose()}>
      <div className="inventory-detail-card spell-detail-card" onClick={event => event.stopPropagation()}>
        <p className="spellbook-detail-eyebrow">{spell.level === 0 ? t('Cantrip') : `${t('Level')} ${spell.level}`}</p>
        <h2 id="spell-detail-title">{spell.name}</h2>
        <p className="char-v2-item-type">{t(titleCase(spell.school))} · {spell.range}</p>
        <dl className="spell-detail-meta">
          <div><dt>{t('Type in Doupě Draka')}</dt><dd>{t(KIND_LABEL[kind])}</dd></div>
          <div><dt>{t('SRD description')}</dt><dd>{spell.text || t('No description in the reference yet.')}</dd></div>
          <div>
            <dt>{t('Engine support')}</dt>
            <dd>{spell.effect_modeled ? t('Modeled — slots and effects resolve in play.') : t('Catalog only — no slot spent; no mechanical effect yet.')}</dd>
          </div>
          {spell.level > 0 && (
            <div><dt>{t('Slot cost')}</dt><dd>{t('Level')} {spell.level}</dd></div>
          )}
        </dl>
        {blockMessage && <p className="spellbook-block-reason" role="status">{blockMessage}</p>}
        <div className="inventory-detail-actions">
          {onCast && (
            <button
              type="button"
              className="primary"
              disabled={!canCast}
              aria-busy={busy && lastCast === action ? true : undefined}
              onClick={() => onCast(action)}
            >
              {busy && lastCast === action ? t('Sending your action…') : t('Cast this spell')}
            </button>
          )}
          <button type="button" className="ghost" disabled={busy} onClick={onClose}>{t('Close')}</button>
        </div>
      </div>
    </div>
  );
}
