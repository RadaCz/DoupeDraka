import { useI18n } from '../i18n';
import type { LevelUpNotice } from '../game/turnMoments';

export type { LevelUpNotice };

export function LevelUpModal({
  notice,
  onDismiss,
}: {
  notice: LevelUpNotice;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="turn-moment-overlay" role="dialog" aria-modal="true" aria-labelledby="level-up-title">
      <div className="turn-moment-card level-up-card">
        <p className="eyebrow">{t('LEVEL UP')}</p>
        <h2 id="level-up-title">{t('Level')} {notice.level}</h2>
        <p className="turn-moment-body">
          {t('Maximum HP increased by {amount}.').replace('{amount}', String(notice.hpGained))}
        </p>
        <button type="button" className="primary" onClick={onDismiss}>
          {t('Continue adventure')}
        </button>
      </div>
    </div>
  );
}

export function DefeatOverlay({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useI18n();
  return (
    <div className="turn-moment-overlay turn-moment-overlay-dim" role="dialog" aria-modal="true" aria-labelledby="defeat-title">
      <div className="turn-moment-card defeat-moment-card">
        <p className="eyebrow">{t('DEFEAT')}</p>
        <h2 id="defeat-title">{t('You have been defeated')}</h2>
        <p className="turn-moment-body">{t('You blacked out and woke at the last safe refuge.')}</p>
        <button type="button" className="primary" onClick={onDismiss}>
          {t('Continue adventure')}
        </button>
      </div>
    </div>
  );
}
