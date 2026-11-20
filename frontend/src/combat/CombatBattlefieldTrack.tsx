import { useI18n } from '../i18n';
import { displayCreature } from '../i18n/gameDisplay';
import type { Character } from '../types';
import { CombatIcon } from './combatIcons';
import { battlefieldLayout } from './combatBattlefield';
import { readCombatTactics } from './combatRange';

export function CombatBattlefieldTrack({ character }: { character: Character }) {
  const { t, locale } = useI18n();
  const tactics = readCombatTactics(character);
  const layout = battlefieldLayout(tactics);
  const foe = character.combatant?.name;
  const foeLabel = foe ? displayCreature(foe, locale) : t('Foe');

  return (
    <div
      className="combat-battlefield"
      role="img"
      aria-label={t('Battlefield distance {distance} ft').replace('{distance}', String(layout.distanceFt))}
    >
      <div className="combat-battlefield-rail" aria-hidden="true">
        <span className="combat-battlefield-tick combat-battlefield-tick-start">0</span>
        <span className="combat-battlefield-tick combat-battlefield-tick-end">60</span>
        <span
          className="combat-battlefield-weapon-reach"
          style={{ width: `${layout.weaponReachPercent}%` }}
        />
        {layout.movementBandEndPercent > layout.movementBandStartPercent && (
          <span
            className="combat-battlefield-move-band"
            style={{
              left: `${layout.movementBandStartPercent}%`,
              width: `${layout.movementBandEndPercent - layout.movementBandStartPercent}%`,
            }}
          />
        )}
        <span className="combat-battlefield-hero-token" title={character.name}>
          <CombatIcon name="defend" />
        </span>
        <span
          className="combat-battlefield-foe-token"
          style={{ left: `calc(${layout.enemyPercent}% - 14px)` }}
          title={foeLabel}
        >
          <CombatIcon name="attack" />
        </span>
        {layout.enemyBeyondTrack && (
          <span className="combat-battlefield-far-label">{t('60+ ft')}</span>
        )}
      </div>
      <p className="combat-battlefield-caption">
        <span>{t('You')}</span>
        <span>{t('Distance')}: <strong>{layout.distanceFt} {t('ft.')}</strong></span>
        <span>{foeLabel}</span>
      </p>
    </div>
  );
}