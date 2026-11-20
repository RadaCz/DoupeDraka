import { useI18n } from '../i18n';

/** UI tag for spells outside MODELED_SPELL_EFFECTS (see /reference/spells effect_modeled). */
export function SpellNarrativeOnlyTag({ className = 'char-v2-tag warn' }: { className?: string }) {
  const { t } = useI18n();
  return <span className={className}>{t('Story only in play')}</span>;
}