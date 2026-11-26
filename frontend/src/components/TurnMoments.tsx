import { useI18n } from '../i18n';
import type { LevelUpNotice } from '../game/turnMoments';
import type { CombatVictoryRewards } from '../combat/combatOutcome';
import type { Character } from '../types';
import { displayCreature } from '../i18n/gameDisplay';
import { ShareButton } from './ShareButton';
import { buildLevelUpShareMessage } from '../share/adventureShare';

export type { LevelUpNotice };

export function LevelUpModal({
  notice,
  character,
  onDismiss,
}: {
  notice: LevelUpNotice;
  character: Character;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  const shareMessage = buildLevelUpShareMessage(character, notice.level);
  return (
    <div className="turn-moment-overlay" role="dialog" aria-modal="true" aria-labelledby="level-up-title">
      <div className="turn-moment-card level-up-card">
        <p className="eyebrow">{t('LEVEL UP')}</p>
        <h2 id="level-up-title">{t('Level')} {notice.level}</h2>
        <p className="turn-moment-body">
          {t('Maximum HP increased by {amount}.').replace('{amount}', String(notice.hpGained))}
        </p>
        {notice.classFeatures?.length ? (
          <p className="turn-moment-body">
            {t('New abilities: {list}.').replace('{list}', notice.classFeatures.join(', '))}
          </p>
        ) : null}
        {notice.spellSlotSummary ? (
          <p className="turn-moment-body">
            {t('Spell slots: {summary}.').replace('{summary}', notice.spellSlotSummary)}
          </p>
        ) : null}
        <p className="turn-moment-share">
          <ShareButton message={shareMessage} className="share-chip share-chip-gold" />
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
      <div className="turn-moment-card defeat-moment-card combat-outcome-card">
        <p className="eyebrow">{t('DEFEAT')}</p>
        <h2 id="defeat-title">{t('You have been defeated')}</h2>
        <p className="turn-moment-body">{t('You blacked out and woke at the last safe refuge.')}</p>
        <p className="turn-moment-body turn-moment-muted">{t('You can rest, heal, and try the fight again when ready.')}</p>
        <button type="button" className="primary" onClick={onDismiss}>
          {t('Continue adventure')}
        </button>
      </div>
    </div>
  );
}

export function CombatVictoryOverlay({
  rewards,
  onDismiss,
}: {
  rewards: CombatVictoryRewards;
  onDismiss: () => void;
}) {
  const { t, locale } = useI18n();
  const foe = rewards.foeName ? displayCreature(rewards.foeName, locale) : null;
  return (
    <div className="turn-moment-overlay" role="dialog" aria-modal="true" aria-labelledby="victory-title">
      <div className="turn-moment-card victory-moment-card combat-outcome-card">
        <p className="eyebrow">{t('VICTORY')}</p>
        <h2 id="victory-title">{t('Victory')}</h2>
        {foe && (
          <p className="turn-moment-body">
            {t('{foe} is defeated.').replace('{foe}', foe)}
          </p>
        )}
        <ul className="combat-victory-rewards" role="list">
          {rewards.xp != null && (
            <li>{t('Experience gained: +{amount} XP').replace('{amount}', String(rewards.xp))}</li>
          )}
          {rewards.gold != null && rewards.gold > 0 && (
            <li>{t('Gold gained: +{amount} gp').replace('{amount}', String(rewards.gold))}</li>
          )}
          {rewards.lootLines.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
        <button type="button" className="primary" onClick={onDismiss}>
          {t('Continue adventure')}
        </button>
      </div>
    </div>
  );
}

export function EnergyExhaustedModal({
  busy,
  onSwitchToLite,
  onClose,
}: {
  busy: boolean;
  onSwitchToLite: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="turn-moment-overlay turn-moment-overlay-dim" role="dialog" aria-modal="true" aria-labelledby="energy-exhausted-title">
      <div className="turn-moment-card">
        <h2 id="energy-exhausted-title">{t('The energy for this narration mode ran out.')}</h2>
        <p className="turn-moment-body">{t('Switch to Lite to keep playing with the free offline storyteller.')}</p>
        <button type="button" className="primary" disabled={busy} onClick={onSwitchToLite}>
          {t('Switch to Lite')}
        </button>
        <button type="button" className="ghost" disabled={busy} onClick={onClose}>
          {t('Close')}
        </button>
      </div>
    </div>
  );
}
