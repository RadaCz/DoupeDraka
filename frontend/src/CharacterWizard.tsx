import { useMemo, useState } from 'react';
import type { ClassReference, HeroPreset, RaceReference, ReferenceCatalog } from './types';
import { useI18n } from './i18n';

export interface CharacterDraft {
  name: string;
  race: string;
  character_class: string;
  difficulty: string;
  tone: string;
  humor: string;
}

interface CharacterWizardProps {
  catalog: ReferenceCatalog;
  presets: HeroPreset[];
  busy: boolean;
  error: string | null;
  onCreate: (draft: CharacterDraft) => void;
  onPreset: (key: string) => void;
  onCancel: () => void;
}

const STEPS = ['Path', 'Race', 'Class', 'Identity', 'Review'];

function abilityText(values: Record<string, number>) {
  return Object.entries(values)
    .map(([ability, value]) => `${ability.slice(0, 3).toUpperCase()} +${value}`)
    .join(' · ');
}

export function CharacterWizard({
  catalog,
  presets,
  busy,
  error,
  onCreate,
  onPreset,
  onCancel,
}: CharacterWizardProps) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [raceKey, setRaceKey] = useState('');
  const [classKey, setClassKey] = useState('');
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState('normal');
  const [tone, setTone] = useState('balanced');
  const [humor, setHumor] = useState('rare');

  const race = useMemo(() => catalog.races.find(item => item.key === raceKey), [catalog.races, raceKey]);
  const characterClass = useMemo(
    () => catalog.classes.find(item => item.key === classKey),
    [catalog.classes, classKey],
  );
  const playableRaces = useMemo(
    () => catalog.races.filter(item => item.mvp_playable !== false),
    [catalog.races],
  );
  const playableClasses = useMemo(
    () => catalog.classes.filter(item => item.mvp_playable !== false),
    [catalog.classes],
  );
  const canAdvance = step === 1 ? Boolean(race && race.mvp_playable !== false) : step === 2 ? Boolean(characterClass && characterClass.mvp_playable !== false) : step === 3 ? Boolean(name.trim()) : true;

  const advance = () => {
    if (step < STEPS.length - 1 && canAdvance) setStep(current => current + 1);
    else if (step === STEPS.length - 1 && race && characterClass && name.trim()) {
      onCreate({
        name: name.trim(),
        race: race.key,
        character_class: characterClass.key,
        difficulty,
        tone,
        humor,
      });
    }
  };

  return (
    <section className="wizard-page" aria-labelledby="wizard-title">
      <div className="wizard-topline">
        <button type="button" className="text-button" onClick={step ? () => setStep(step - 1) : onCancel}>
          ← {step ? t('Back') : t('Home')}
        </button>
        <span>{t('CHARACTER CREATION')}</span>
      </div>
      <div className="wizard-progress" aria-label={`${t('Step')} ${step + 1} ${t('of')} ${STEPS.length}`}>
        {STEPS.map((item, index) => (
          <div className={`wizard-progress-step ${index <= step ? 'active' : ''}`} key={item}>
            <span>{index < step ? '✓' : `0${index + 1}`}</span>
            <small>{t(item)}</small>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="wizard-content">
          <p className="eyebrow">{t('A HERO FOR YOUR STORY')}</p>
          <h1 id="wizard-title">{t('How do you want to begin?')}</h1>
          <p className="section-lead">{t('Choose a ready-made adventurer or shape your own from the ground up.')}</p>
          <div className="choice-list">
            {presets.map(preset => (
              <button
                type="button"
                className="choice-card preset-card"
                key={preset.key}
                onClick={() => onPreset(preset.key)}
                disabled={busy}
              >
                <span className="choice-icon" aria-hidden="true">✦</span>
                <span className="choice-copy">
                  <strong>{preset.name}</strong>
                  <small>{t(preset.race.replace(/_/g, ' '))} · {t(preset.character_class)} · {t(preset.role)}</small>
                </span>
                <span className="choice-arrow" aria-hidden="true">›</span>
              </button>
            ))}
            <button
              type="button"
              className="choice-card custom-card"
              onClick={() => {
                const race = playableRaces[Math.floor(Math.random() * playableRaces.length)];
                const cls = playableClasses[Math.floor(Math.random() * playableClasses.length)];
                setRaceKey(race.key);
                setClassKey(cls.key);
                setName(t('Adventurer'));
                setStep(3);
              }}
            >
              <span className="choice-icon" aria-hidden="true">⚁</span>
              <span className="choice-copy">
                <strong>{t('Quick generate')}</strong>
                <small>{t('Random race and class — tweak the name, then play.')}</small>
              </span>
              <span className="choice-arrow" aria-hidden="true">›</span>
            </button>
            <button type="button" className="choice-card custom-card" onClick={() => setStep(1)}>
              <span className="choice-icon" aria-hidden="true">✧</span>
              <span className="choice-copy">
                <strong>{t('Step-by-step wizard')}</strong>
                <small>{t('Choose a species, class and the mood of your campaign.')}</small>
              </span>
              <span className="choice-arrow" aria-hidden="true">›</span>
            </button>
          </div>
          <p className="wizard-note">{t('Every character is saved to your Telegram account.')}</p>
        </div>
      )}

      {step === 1 && (
        <div className="wizard-content">
          <p className="eyebrow">{t('STEP 1 · YOUR PEOPLE')}</p>
          <h1 id="wizard-title">{t('Choose a species')}</h1>
          <p className="section-lead">{t('Each species brings its own traits and a different way to see the world.')}</p>
          {catalog.ruleset && (
            <p className="wizard-note">{t('Ruleset v1 supports Human, Elf, Dwarf, and Halfling for chapter one.')}</p>
          )}
          <div className="selection-grid race-grid">
            {catalog.races.map(item => {
              const planned = item.mvp_playable === false;
              return (
              <button
                type="button"
                className={`selection-card ${raceKey === item.key ? 'selected' : ''} ${planned ? 'planned' : ''}`}
                key={item.key}
                aria-pressed={raceKey === item.key}
                disabled={planned}
                onClick={() => setRaceKey(item.key)}
              >
                <span className="card-title-row"><strong>{t(item.name)}</strong><small>{item.speed} ft.</small></span>
                <span className="card-stat">{abilityText(item.ability_increase)}</span>
                <span className="trait-chips">
                  {item.traits.slice(0, 3).map(trait => <small key={trait.name}>{trait.name}</small>)}
                  {item.subraces.length > 0 && <small>{item.subraces.length} {t('lineages')}</small>}
                  {planned && <small>{t('Planned')}</small>}
                </span>
              </button>
            );})}
          </div>
          {race && (
            <div className="selection-detail">
              <strong>{t(race.name)} {t('traits')}</strong>
              <p className="muted-copy">{t('Ability score bonuses from your species are applied at creation. Trait text below is SRD reference — most traits are not modeled in Ruleset v1 yet.')}</p>
              {race.traits.map(trait => (
                <p key={trait.name}><b>{t(trait.name)}.</b> {t(trait.text)}</p>
              ))}
              {race.subraces.length > 0 && (
                <p className="muted-copy">{t('Reference lineages:')} {race.subraces.map(item => item.replace(/_/g, ' ')).join(', ')}.</p>
              )}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="wizard-content">
          <p className="eyebrow">{t('STEP 2 · YOUR TRAINING')}</p>
          <h1 id="wizard-title">{t('Choose a class')}</h1>
          <p className="section-lead">{t('Your class shapes your strengths, defenses and place in a fight.')}</p>
          {catalog.ruleset && (
            <p className="wizard-note">{t('Ruleset v1 supports Fighter, Rogue, Cleric, and Wizard in play.')}</p>
          )}
          <div className="selection-grid class-grid">
            {catalog.classes.map(item => {
              const planned = item.mvp_playable === false;
              return (
              <button
                type="button"
                className={`selection-card ${classKey === item.key ? 'selected' : ''} ${planned ? 'planned' : ''}`}
                key={item.key}
                aria-pressed={classKey === item.key}
                disabled={planned}
                onClick={() => setClassKey(item.key)}
              >
                <span className="card-title-row"><strong>{t(item.name)}</strong><small>d{item.hit_die}</small></span>
                <span className="card-stat">{t('Primary:')} {t(item.primary)}</span>
                <span className="trait-chips">
                  {item.armor.slice(0, 3).map(value => <small key={value}>{t(value)} {t('armor')}</small>)}
                  {item.weapons.slice(0, 2).map(value => <small key={value}>{value}</small>)}
                </span>
                {item.subclasses[0] && <small className="subclass-hint">{t('SRD path:')} {item.subclasses[0].name}</small>}
                {planned && <small>{t('Planned')}</small>}
              </button>
            );})}
          </div>
          {characterClass && (
            <div className="selection-detail">
              <strong>{t(characterClass.name)} {t('training')}</strong>
              <p>{t('Saving throws:')} {characterClass.saving_throws.map(value => t(value)).join(', ')}.</p>
              <p>{t('Armor')}: {characterClass.armor.length ? characterClass.armor.map(value => t(value)).join(', ') : t('none')}.</p>
              <p>{t('Weapons:')} {characterClass.weapons.map(value => t(value)).join(', ')}.</p>
              {characterClass.subclasses[0] && (
                <p><b>{t(characterClass.subclasses[0].name)}:</b> {t(characterClass.subclasses[0].text)}</p>
              )}
              <p className="muted-copy">{t('The engine assigns starting abilities and combat statistics automatically. Subclass features are reference information and are not yet applied in play.')}</p>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="wizard-content">
          <p className="eyebrow">{t('STEP 3 · YOUR CAMPAIGN')}</p>
          <h1 id="wizard-title">{t('Give your story a tone')}</h1>
          <p className="section-lead">{t('These settings guide the narrator and combat challenge. You can change them later.')}</p>
          <label className="field-label" htmlFor="hero-name">{t('Character name')}</label>
          <input
            id="hero-name"
            className="form-input"
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder={t('What are you called?')}
            maxLength={48}
            autoComplete="nickname"
            required
          />
          <fieldset className="option-fieldset">
            <legend>{t('Combat challenge')}</legend>
            <div className="option-row">
              {[
                ['easy', 'Gentle', 'A little room to learn'],
                ['normal', 'Balanced', 'A fair challenge'],
                ['hard', 'Dangerous', 'Enemies hit harder'],
              ].map(([value, label, description]) => (
                <button type="button" key={value} className={`option-card ${difficulty === value ? 'selected' : ''}`} aria-pressed={difficulty === value} onClick={() => setDifficulty(value)}>
                  <strong>{t(label)}</strong><small>{t(description)}</small>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="option-fieldset">
            <legend>{t('Story mood')}</legend>
            <div className="option-row compact-options">
              {['light', 'balanced', 'dark', 'grimdark'].map(value => (
                <button type="button" key={value} className={`option-pill ${tone === value ? 'selected' : ''}`} aria-pressed={tone === value} onClick={() => setTone(value)}>{t(value)}</button>
              ))}
            </div>
          </fieldset>
          <fieldset className="option-fieldset">
            <legend>{t('Humor')}</legend>
            <div className="option-row compact-options">
              {['serious', 'rare', 'frequent', 'comedy'].map(value => (
                <button type="button" key={value} className={`option-pill ${humor === value ? 'selected' : ''}`} aria-pressed={humor === value} onClick={() => setHumor(value)}>{t(value)}</button>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      {step === 4 && race && characterClass && (
        <div className="wizard-content">
          <p className="eyebrow">{t('STEP 4 · READY TO BEGIN')}</p>
          <h1 id="wizard-title">{t('Meet your adventurer')}</h1>
          <p className="section-lead">{t('A first look at the hero who will enter the Whispering Cellar.')}</p>
          <div className="review-card">
            <div className="review-avatar">{name.trim().charAt(0).toUpperCase()}</div>
            <div><h2>{name.trim()}</h2><p>{t(race.name)} {t(characterClass.name)} · {t('Level')} 1</p></div>
          </div>
          <div className="review-grid">
            <div><small>{t('SPECIES')}</small><strong>{t(race.name)}</strong><span>{race.speed} ft. {t('speed')} · {abilityText(race.ability_increase)}</span></div>
            <div><small>{t('CLASS')}</small><strong>{t(characterClass.name)}</strong><span>d{characterClass.hit_die} {t('hit die')} · {t(characterClass.primary)} {t('focus')}</span></div>
            <div><small>{t('CHALLENGE')}</small><strong>{t(difficulty)}</strong><span>{t(tone)} {t('story')} · {t(humor)} {t('Humor')}</span></div>
          </div>
          <p className="wizard-note">{t('The game engine sets your starting abilities, equipment, known or prepared spells and spell slots. Only a small set of spell effects is modeled so far.')}</p>
        </div>
      )}

      {error && <p className="error" role="alert">{error}</p>}
      {step > 0 && (
        <button type="button" className="wizard-next primary" onClick={advance} disabled={!canAdvance || busy}>
          {busy ? t('Creating your hero…') : step === STEPS.length - 1 ? t('Enter the adventure') : t('Continue')}
        </button>
      )}
    </section>
  );
}
