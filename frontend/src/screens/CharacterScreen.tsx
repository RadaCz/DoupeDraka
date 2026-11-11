import { useMemo } from 'react';
import type { Character, Spell } from '../types';
import { useI18n } from '../i18n';
import { displayInventoryLabel, displayLocation } from '../i18n/gameDisplay';
import { HpBar, SpellSlots, titleCase } from '../components/characterVitals';
import { CharacterInventoryPanel } from '../character/CharacterInventoryPanel';
import {
  ABILITY_HINT_KEYS,
  ABILITY_KEYS,
  ABILITY_LABEL_KEYS,
  equippedArmorInstance,
  equippedShieldInstance,
  equippedWeaponInstance,
  formatModifier,
  formatSavingThrowProficiencies,
  proficiencyBonus,
  xpProgress,
} from '../character/characterSheet';
import { backgroundFeatureFor, backgroundFeatureUsed } from '../character/backgroundFeatures';
import { classFeatureLines } from '../character/classFeatures';
import { heroSpellRows } from '../spells/spellbook';

export function CharacterScreen({
  character,
  characters,
  spells,
  onSelect,
  onCreate,
  onOpenTools,
  onInventoryAction,
  busy,
  error,
}: {
  character: Character | null;
  characters: Character[];
  spells: Spell[];
  onSelect: (character: Character) => void;
  onCreate: () => void;
  onOpenTools?: () => void;
  onInventoryAction?: (action: string) => void;
  busy?: boolean;
  error?: string;
}) {
  const { t, locale } = useI18n();

  if (!character) {
    return (
      <section className="screen empty-screen character-v2">
        <p className="eyebrow">{t('CHARACTER')}</p>
        <h1>{t('Your adventurers')}</h1>
        <p>{t('Create a hero and their full sheet will live here.')}</p>
        <button type="button" className="primary" onClick={onCreate}>{t('Create character')}</button>
      </section>
    );
  }

  const equippedWeapon = equippedWeaponInstance(character.item_instances);
  const equippedArmor = equippedArmorInstance(character.item_instances);
  const equippedShield = equippedShieldInstance(character.item_instances);
  const xp = xpProgress(character.xp);
  const spellRows = useMemo(() => heroSpellRows(character, spells), [character, spells]);
  const features = useMemo(() => classFeatureLines(character, t), [character, t]);
  const backgroundFeature = useMemo(() => backgroundFeatureFor(character), [character]);
  const hasSpellcasting = Object.values(character.max_spell_slots ?? {}).some(count => count > 0);

  return (
    <section className="screen character-screen character-v2" aria-busy={busy || undefined}>
      <header className="char-v2-identity">
        <div className="char-v2-identity-row">
          <span className="char-v2-portrait" aria-hidden="true">{character.name.charAt(0).toUpperCase()}</span>
          <div className="char-v2-identity-copy">
            <h1 className="char-v2-name">{character.name}</h1>
            <p className="char-v2-subtitle">
              {t(titleCase(character.race))} · {t(titleCase(character.character_class))}
              {character.background ? ` · ${t(titleCase(character.background.replace(/_/g, ' ')))}` : ''}
              {' · '}{t('Level')} {character.level}
            </p>
            <p className="char-v2-location" title={character.location}>
              <span aria-hidden="true">⌖</span> {displayLocation(character.location, locale)}
            </p>
          </div>
        </div>
        <div className="char-v2-vitals-strip">
          <span className="char-v2-vital"><small>{t('HP')}</small><strong>{character.hp}/{character.max_hp}</strong></span>
          <span className="char-v2-vital"><small>{t('AC')}</small><strong>{character.armor_class}</strong></span>
          <span className="char-v2-vital"><small>{t('Gold')}</small><strong>{character.gold} {t('gp')}</strong></span>
          {hasSpellcasting && (
            <span className="char-v2-vital char-v2-vital-wide">
              <small>{t('Spell slots')}</small>
              <strong><SpellSlots character={character} t={t} /></strong>
            </span>
          )}
        </div>
        <HpBar character={character} />
        <div className="char-v2-combat-basics" aria-labelledby="char-combat-basics-heading">
          <h2 id="char-combat-basics-heading" className="char-v2-section-title visually-compact">{t('Combat basics')}</h2>
          <p className="char-v2-section-lead">
            <span>{t('Proficiency bonus')}: <strong className="tabular-nums">+{proficiencyBonus(character.level)}</strong></span>
            {' · '}
            <span>{t('Speed')}: <strong className="tabular-nums">{character.speed ?? 30} {t('ft.')}</strong></span>
          </p>
          {character.saving_throw_proficiencies && character.saving_throw_proficiencies.length > 0 && (
            <p className="char-v2-section-lead">
              {t('Saving throw proficiencies')}: {formatSavingThrowProficiencies(character.saving_throw_proficiencies, t)}
            </p>
          )}
          <p className="char-v2-section-lead char-v2-muted-hint">{t('Initiative in combat uses your Dexterity modifier on the roll.')}</p>
        </div>
        {character.invisible && (
          <p className="char-v2-condition" role="status">{t('Condition')}: {t('Invisible')}</p>
        )}
        {character.in_combat && (
          <p className="char-v2-condition char-v2-combat" role="status">{t('Combat in progress')}</p>
        )}
      </header>

      {error && (
        <p className="char-v2-inline-error" role="alert">{error}</p>
      )}
      {busy && (
        <p className="char-v2-busy" role="status">{t('Sending your action…')}</p>
      )}

      <section className="char-v2-section" aria-labelledby="char-equipment-heading">
        <h2 id="char-equipment-heading" className="char-v2-section-title">{t('Equipped gear')}</h2>
        <p className="char-v2-section-lead">
          {t('Equipped items set your armor class and attack. Armor and shields follow SRD 5.1 rules.')}
        </p>
        <div className="char-v2-equipped-row">
          {equippedWeapon ? (
            <article className="char-v2-equipped-card">
              <span className="char-v2-equipped-icon" aria-hidden="true">⚔</span>
              <div>
                <small>{t('Weapon')}</small>
                <strong>{displayInventoryLabel(equippedWeapon.name, locale)}</strong>
                {equippedWeapon.attack_bonus > 0 && (
                  <p className="char-v2-equipped-bonus">{t('Attack bonus')}: +{equippedWeapon.attack_bonus}</p>
                )}
              </div>
            </article>
          ) : (
            <p className="empty-note">{t('No weapon wielded.')}</p>
          )}
          {equippedArmor ? (
            <article className="char-v2-equipped-card">
              <span className="char-v2-equipped-icon" aria-hidden="true">🛡</span>
              <div>
                <small>{t('Armor')}</small>
                <strong>{displayInventoryLabel(equippedArmor.name, locale)}</strong>
              </div>
            </article>
          ) : (
            <p className="empty-note">{t('No armor worn (unarmored defense).')}</p>
          )}
          {equippedShield ? (
            <article className="char-v2-equipped-card">
              <span className="char-v2-equipped-icon" aria-hidden="true">🛡</span>
              <div>
                <small>{t('Shield')}</small>
                <strong>{displayInventoryLabel(equippedShield.name, locale)}</strong>
              </div>
            </article>
          ) : null}
        </div>
      </section>

      <section className="char-v2-section" aria-labelledby="char-inventory-heading">
        <h2 id="char-inventory-heading" className="char-v2-section-title">{t('Inventory')}</h2>
        <CharacterInventoryPanel
          character={character}
          busy={busy}
          onInventoryAction={onInventoryAction}
        />
      </section>

      <section className="char-v2-section" aria-labelledby="char-progress-heading">
        <h2 id="char-progress-heading" className="char-v2-section-title">{t('Progress')}</h2>
        <article className="char-v2-progress-card">
          <div className="char-v2-progress-row">
            <span><small>{t('Level')}</small><strong>{character.level}</strong></span>
            <span><small>{t('EXPERIENCE')}</small><strong className="tabular-nums">{character.xp} XP</strong></span>
          </div>
          <div className="char-v2-xp-track" role="progressbar" aria-valuenow={xp.current} aria-valuemin={0} aria-valuemax={xp.threshold} aria-label={t('Experience toward next level')}>
            <span style={{ width: `${Math.min(100, (xp.current / xp.threshold) * 100)}%` }} />
          </div>
          <p className="char-v2-xp-caption tabular-nums">
            {t('Experience toward next level')}: {xp.current} / {xp.threshold} XP
          </p>
        </article>
      </section>

      {backgroundFeature && (
        <section className="char-v2-section" aria-labelledby="char-background-feature-heading">
          <h2 id="char-background-feature-heading" className="char-v2-section-title">{t('Background feature')}</h2>
          <ul className="char-v2-spell-list">
            <li className="char-v2-spell-row">
              <div className="char-v2-spell-head">
                <strong>{t(backgroundFeature.nameKey)}</strong>
                <small>
                  {backgroundFeatureUsed(character, backgroundFeature)
                    ? t('Used this chapter')
                    : character.location === backgroundFeature.location
                      ? t('Available here')
                      : t('Travel to use')}
                </small>
              </div>
              <p className="char-v2-spell-text">{t(backgroundFeature.descriptionKey)}</p>
              <p className="char-v2-section-lead">
                {t('Usable at')}: {displayLocation(backgroundFeature.location, locale)}
              </p>
            </li>
          </ul>
        </section>
      )}

      {features.length > 0 && (
        <section className="char-v2-section" aria-labelledby="char-features-heading">
          <h2 id="char-features-heading" className="char-v2-section-title">{t('Class features')}</h2>
          <ul className="char-v2-spell-list">
            {features.map(row => (
              <li key={row.key} className="char-v2-spell-row">
                <div className="char-v2-spell-head">
                  <strong>{row.label}</strong>
                  {row.status && <small>{row.status}</small>}
                </div>
                {row.detail && <p className="char-v2-spell-text">{row.detail}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {character.skill_proficiencies && character.skill_proficiencies.length > 0 && (
        <section className="char-v2-section" aria-labelledby="char-skills-heading">
          <h2 id="char-skills-heading" className="char-v2-section-title">{t('Skill proficiencies')}</h2>
          <p className="char-v2-section-lead">
            {character.skill_proficiencies.map(skill => {
              const expert = character.expertise_skills?.includes(skill);
              return expert ? `${skill} (${t('expertise')})` : skill;
            }).join(' · ')}
          </p>
        </section>
      )}

      <details className="char-v2-section char-v2-abilities-fold">
        <summary className="char-v2-section-title">{t('Ability scores')}</summary>
        <p className="char-v2-section-lead">{t('Core attributes from your hero sheet. Modifiers apply to rolls in play.')}</p>
        <div className="char-v2-ability-grid">
          {ABILITY_KEYS.map(key => {
            const score = character.abilities?.[key] ?? 10;
            return (
              <article key={key} className="char-v2-ability-card">
                <small>{t(ABILITY_LABEL_KEYS[key])}</small>
                <strong className="tabular-nums">{score}</strong>
                <span className="char-v2-mod tabular-nums">{formatModifier(score)}</span>
                <p className="char-v2-ability-hint">{t(ABILITY_HINT_KEYS[key])}</p>
              </article>
            );
          })}
        </div>
      </details>

      <section className="char-v2-section" aria-labelledby="char-spells-heading">
        <h2 id="char-spells-heading" className="char-v2-section-title">{t('Spells & abilities')}</h2>
        {!spellRows.length ? (
          <div className="spell-empty-state">
            <p>
              {hasSpellcasting
                ? t('Your hero has no prepared spells yet. Level up or learn spells through play when the engine grants them.')
                : t('This class does not cast spells in the current chapter. Fighters and Rogues use weapons and skills instead.')}
            </p>
            {onOpenTools && (
              <button type="button" className="text-button" onClick={onOpenTools}>{t('Open spell rules reference')}</button>
            )}
          </div>
        ) : (
          <ul className="char-v2-spell-list">
            {spellRows.map(({ spell, known, prepared }) => (
              <li key={spell.name} className={`char-v2-spell-row${spell.effect_modeled ? '' : ' muted'}`}>
                <div className="char-v2-spell-head">
                  <strong>{spell.name}</strong>
                  <small>{spell.level === 0 ? t('Cantrip') : t(`Level ${spell.level}`)}</small>
                </div>
                <p className="char-v2-spell-text">{spell.text || t('No description in the reference yet.')}</p>
                <div className="char-v2-spell-tags">
                  {known && <span className="char-v2-tag">{t('Known')}</span>}
                  {prepared && <span className="char-v2-tag prepared">{t('Prepared')}</span>}
                  {!spell.effect_modeled && <span className="char-v2-tag warn">{t('Not modeled in MVP')}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {characters.length > 1 && (
        <section className="char-v2-section" aria-labelledby="char-roster-heading">
          <h2 id="char-roster-heading" className="char-v2-section-title">{t('Switch adventurer')}</h2>
          <div className="roster-list">
            {characters.map(item => (
              <button
                type="button"
                className={`roster-card ${item.id === character.id ? 'current' : ''}`}
                key={item.id}
                onClick={() => onSelect(item)}
              >
                <span className="mini-portrait">{item.name.charAt(0).toUpperCase()}</span>
                <span className="roster-copy">
                  <strong>{item.name}</strong>
                  <small>{t(titleCase(item.race))} {t(titleCase(item.character_class))} · {t('Lv.')} {item.level}</small>
                </span>
                <span className="choice-arrow" aria-hidden="true">{item.id === character.id ? '✓' : '›'}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
