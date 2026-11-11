import { useEffect, useMemo, useState } from 'react';
import type { ClassReference, HeroPreset, RaceReference, ReferenceCatalog } from './types';
import { useI18n } from './i18n';
import {
  ABILITY_KEYS,
  assignedAbilities,
  defaultBackground,
  defaultClassSkills,
  defaultEquipmentPackage,
  emptyAbilityAssignment,
  remainingArrayValues,
  reviewAbilityRow,
  STANDARD_ARRAY,
  type AbilityKey,
} from './character/creation';

export interface CharacterDraft {
  name: string;
  race: string;
  character_class: string;
  difficulty: string;
  tone: string;
  humor: string;
  abilities?: Record<string, number>;
  background?: string;
  class_skills?: string[];
  equipment_package?: string;
  cantrips?: string[];
  level_one_spells?: string[];
  alignment?: string;
  ideal?: string;
  bond?: string;
  flaw?: string;
  backstory?: string;
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

const STEPS = [
  'Path',
  'Race',
  'Class',
  'Background',
  'Abilities',
  'Skills',
  'Gear',
  'Spells',
  'Identity',
  'Review',
];

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
  const meta = catalog.character_creation;
  const [step, setStep] = useState(0);
  const [raceKey, setRaceKey] = useState('');
  const [classKey, setClassKey] = useState('');
  const [backgroundKey, setBackgroundKey] = useState('');
  const [abilityMap, setAbilityMap] = useState(emptyAbilityAssignment);
  const [classSkills, setClassSkills] = useState<string[]>([]);
  const [equipmentPackage, setEquipmentPackage] = useState('');
  const [cantrips, setCantrips] = useState<string[]>([]);
  const [levelOneSpells, setLevelOneSpells] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [alignment, setAlignment] = useState('');
  const [ideal, setIdeal] = useState('');
  const [bond, setBond] = useState('');
  const [flaw, setFlaw] = useState('');
  const [backstory, setBackstory] = useState('');
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
  const playableBackgrounds = useMemo(
    () => (meta?.backgrounds ?? catalog.backgrounds).filter(item => item.mvp_playable !== false),
    [catalog.backgrounds, meta?.backgrounds],
  );
  const background = useMemo(
    () => playableBackgrounds.find(item => item.key === backgroundKey),
    [backgroundKey, playableBackgrounds],
  );

  useEffect(() => {
    if (!classKey || !meta) return;
    const bg = backgroundKey || defaultBackground(classKey);
    if (!backgroundKey) setBackgroundKey(bg);
    const primary = characterClass?.primary ?? 'strength';
    const order: AbilityKey[] = [];
    for (const key of [primary, 'constitution', 'dexterity', ...ABILITY_KEYS]) {
      if (!order.includes(key as AbilityKey)) order.push(key as AbilityKey);
    }
    const map = emptyAbilityAssignment();
    order.forEach((key, index) => {
      map[key] = STANDARD_ARRAY[index] ?? 10;
    });
    setAbilityMap(map);
    setClassSkills(defaultClassSkills(classKey, bg, meta));
    setEquipmentPackage(defaultEquipmentPackage(classKey, meta));
    const limits = meta.spell_pick_limits[classKey];
    const options = meta.spell_options?.[classKey];
    if (limits && options) {
      setCantrips(options.cantrips.slice(0, limits.cantrips));
      const spellKey = classKey === 'wizard' ? 'level_one_known' : 'level_one_prepared';
      setLevelOneSpells(options.level_one.slice(0, limits[spellKey] ?? 0));
    } else {
      setCantrips([]);
      setLevelOneSpells([]);
    }
  }, [classKey, backgroundKey, meta]);

  const spellCaster = Boolean(meta?.spell_pick_limits[classKey]);
  const abilityScores = assignedAbilities(abilityMap);
  const reviewRows = useMemo(() => {
    if (!abilityScores || !race) return [];
    return reviewAbilityRow(abilityScores, race.ability_increase);
  }, [abilityScores, race]);

  const canAdvance = useMemo(() => {
    switch (step) {
      case 1:
        return Boolean(race?.mvp_playable !== false);
      case 2:
        return Boolean(characterClass?.mvp_playable !== false);
      case 3:
        return Boolean(background);
      case 4:
        return abilityScores !== null;
      case 5:
        return classSkills.length === (meta?.class_skill_picks[classKey]?.count ?? 0);
      case 6:
        return Boolean(equipmentPackage);
      case 7: {
        if (!spellCaster) return true;
        const limits = meta?.spell_pick_limits[classKey];
        if (!limits) return false;
        const needLevelOne = classKey === 'wizard' ? limits.level_one_known : limits.level_one_prepared;
        return cantrips.length === limits.cantrips && levelOneSpells.length === (needLevelOne ?? 0);
      }
      case 8:
        return Boolean(name.trim());
      default:
        return true;
    }
  }, [step, race, characterClass, background, abilityScores, classSkills, equipmentPackage, spellCaster, cantrips, levelOneSpells, name, meta, classKey]);

  const toggleClassSkill = (skill: string) => {
    const limit = meta?.class_skill_picks[classKey]?.count ?? 0;
    setClassSkills(current => {
      if (current.includes(skill)) return current.filter(item => item !== skill);
      if (current.length >= limit) return current;
      return [...current, skill];
    });
  };

  const assignAbility = (key: AbilityKey, value: number) => {
    setAbilityMap(current => {
      const next = { ...current };
      for (const entry of Object.keys(next) as AbilityKey[]) {
        if (next[entry] === value) next[entry] = null;
      }
      next[key] = value;
      return next;
    });
  };

  const submitDraft = () => {
    if (!race || !characterClass || !background || !abilityScores || !name.trim()) return;
    onCreate({
      name: name.trim(),
      race: race.key,
      character_class: characterClass.key,
      difficulty,
      tone,
      humor,
      abilities: abilityScores,
      background: backgroundKey,
      class_skills: classSkills,
      equipment_package: equipmentPackage,
      cantrips: spellCaster ? cantrips : undefined,
      level_one_spells: spellCaster ? levelOneSpells : undefined,
      alignment: alignment.trim() || undefined,
      ideal: ideal.trim() || undefined,
      bond: bond.trim() || undefined,
      flaw: flaw.trim() || undefined,
      backstory: backstory.trim() || undefined,
    });
  };

  const advance = () => {
    if (step < STEPS.length - 1 && canAdvance) {
      let next = step + 1;
      if (next === 7 && !spellCaster) next = 8;
      setStep(next);
    } else if (step === STEPS.length - 1 && canAdvance) submitDraft();
  };

  const goBack = () => {
    if (!step) return onCancel();
    let prev = step - 1;
    if (prev === 7 && !spellCaster) prev = 6;
    setStep(prev);
  };

  const quickStart = (pickRace: string, pickClass: string) => {
    setRaceKey(pickRace);
    setClassKey(pickClass);
    setBackgroundKey(defaultBackground(pickClass));
    const order = (meta?.ability_order ?? [...ABILITY_KEYS]) as AbilityKey[];
    const scores = [...STANDARD_ARRAY];
    const map = emptyAbilityAssignment();
    order.forEach((key, index) => {
      map[key] = scores[index] ?? 10;
    });
    setAbilityMap(map);
    setName(t('Adventurer'));
    setStep(8);
  };

  return (
    <section className="wizard-page" aria-labelledby="wizard-title">
      <div className="wizard-topline">
        <button type="button" className="text-button" onClick={goBack}>
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
              <button type="button" className="choice-card preset-card" key={preset.key} onClick={() => onPreset(preset.key)} disabled={busy}>
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
                const pickRace = playableRaces[Math.floor(Math.random() * playableRaces.length)];
                const pickClass = playableClasses[Math.floor(Math.random() * playableClasses.length)];
                quickStart(pickRace.key, pickClass.key);
              }}
            >
              <span className="choice-icon" aria-hidden="true">⚁</span>
              <span className="choice-copy">
                <strong>{t('Quick generate')}</strong>
                <small>{t('Random build — adjust on the identity step before you play.')}</small>
              </span>
              <span className="choice-arrow" aria-hidden="true">›</span>
            </button>
            <button type="button" className="choice-card custom-card" onClick={() => setStep(1)}>
              <span className="choice-icon" aria-hidden="true">✧</span>
              <span className="choice-copy">
                <strong>{t('Step-by-step wizard')}</strong>
                <small>{t('SRD 5.1 abilities, skills, gear and spells where modeled.')}</small>
              </span>
              <span className="choice-arrow" aria-hidden="true">›</span>
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="wizard-content">
          <p className="eyebrow">{t('STEP 1 · YOUR PEOPLE')}</p>
          <h1 id="wizard-title">{t('Choose a species')}</h1>
          <RaceGrid
            catalog={catalog}
            raceKey={raceKey}
            setRaceKey={setRaceKey}
            playableOnly
            t={t}
            abilityText={abilityText}
          />
        </div>
      )}

      {step === 2 && (
        <div className="wizard-content">
          <p className="eyebrow">{t('STEP 2 · YOUR TRAINING')}</p>
          <h1 id="wizard-title">{t('Choose a class')}</h1>
          <ClassGrid catalog={catalog} classKey={classKey} setClassKey={setClassKey} t={t} />
        </div>
      )}

      {step === 3 && meta && (
        <div className="wizard-content">
          <p className="eyebrow">{t('STEP 3 · YOUR ORIGIN')}</p>
          <h1 id="wizard-title">{t('Choose a background')}</h1>
          <div className="selection-grid">
            {playableBackgrounds.map(item => (
              <button
                type="button"
                key={item.key ?? item.name}
                className={`selection-card ${backgroundKey === item.key ? 'selected' : ''}`}
                onClick={() => setBackgroundKey(item.key ?? '')}
              >
                <strong>{t(item.name)}</strong>
                <small>{item.skill_proficiencies.join(', ')}</small>
              </button>
            ))}
          </div>
          {background && (
            <p className="muted-copy">
              {t(background.feature.name)}: {t(background.feature.text)}
              {' '}
              <em>{t('Background features are narrative-only until modeled in the engine.')}</em>
            </p>
          )}
        </div>
      )}

      {step === 4 && meta && (
        <div className="wizard-content">
          <p className="eyebrow">{t('STEP 4 · ABILITIES')}</p>
          <h1 id="wizard-title">{t('Assign the standard array')}</h1>
          <p className="wizard-note">{t('Remaining')}: {remainingArrayValues(abilityMap).join(', ') || t('Complete')}</p>
          <div className="selection-grid">
            {ABILITY_KEYS.map(key => (
              <div key={key} className="selection-card">
                <strong>{t(key)}</strong>
                <AbilityPicker abilityKey={key} map={abilityMap} onAssign={assignAbility} t={t} />
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 5 && meta && (
        <div className="wizard-content">
          <p className="eyebrow">{t('STEP 5 · SKILLS')}</p>
          <h1 id="wizard-title">{t('Class skill proficiencies')}</h1>
          <p className="wizard-note">
            {t('Background grants')}: {background?.skill_proficiencies.join(', ')}
          </p>
          <div className="option-row compact-options">
            {(meta.class_skill_picks[classKey]?.options ?? [])
              .filter(skill => !background?.skill_proficiencies.includes(skill))
              .map(skill => (
                <button
                  type="button"
                  key={skill}
                  className={`option-pill ${classSkills.includes(skill) ? 'selected' : ''}`}
                  onClick={() => toggleClassSkill(skill)}
                >
                  {skill}
                </button>
              ))}
          </div>
        </div>
      )}

      {step === 6 && meta && (
        <div className="wizard-content">
          <p className="eyebrow">{t('STEP 6 · GEAR')}</p>
          <h1 id="wizard-title">{t('Starting equipment')}</h1>
          {Object.entries(meta.equipment_packages[classKey] ?? {}).map(([key, items]) => (
            <button
              type="button"
              key={key}
              className={`choice-card ${equipmentPackage === key ? 'selected' : ''}`}
              onClick={() => setEquipmentPackage(key)}
            >
              <strong>{t(key)}</strong>
              <small>{items.join(', ')}</small>
            </button>
          ))}
        </div>
      )}

      {step === 7 && meta && spellCaster && (
        <div className="wizard-content">
          <p className="eyebrow">{t('STEP 7 · SPELLS')}</p>
          <h1 id="wizard-title">{t('Cantrips and level-1 magic')}</h1>
          <p className="wizard-note">{t('Only spells with modeled combat effects are fully playable.')}</p>
          <fieldset className="option-fieldset">
            <legend>{t('Cantrips')}</legend>
            <div className="option-row compact-options">
              {(meta.spell_options?.[classKey]?.cantrips ?? []).map(spell => (
                <button
                  type="button"
                  key={spell}
                  className={`option-pill ${cantrips.includes(spell) ? 'selected' : ''}`}
                  onClick={() => setCantrips(current => current.includes(spell) ? current.filter(item => item !== spell) : [...current, spell].slice(0, meta.spell_pick_limits[classKey].cantrips))}
                >
                  {spell}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="option-fieldset">
            <legend>{t('Level 1')}</legend>
            <div className="option-row compact-options">
              {(meta.spell_options?.[classKey]?.level_one ?? []).map(spell => (
                <button
                  type="button"
                  key={spell}
                  className={`option-pill ${levelOneSpells.includes(spell) ? 'selected' : ''}`}
                  onClick={() => {
                    const limit = classKey === 'wizard'
                      ? meta.spell_pick_limits[classKey].level_one_known
                      : meta.spell_pick_limits[classKey].level_one_prepared;
                    setLevelOneSpells(current => current.includes(spell)
                      ? current.filter(item => item !== spell)
                      : [...current, spell].slice(0, limit));
                  }}
                >
                  {spell}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      {step === 8 && (
        <div className="wizard-content">
          <p className="eyebrow">{t('STEP 8 · IDENTITY')}</p>
          <h1 id="wizard-title">{t('Name and campaign tone')}</h1>
          <label className="field-label" htmlFor="hero-name">{t('Character name')}</label>
          <input id="hero-name" className="form-input" value={name} onChange={event => setName(event.target.value)} maxLength={48} required />
          <label className="field-label" htmlFor="hero-alignment">{t('Alignment (narrative)')}</label>
          <input id="hero-alignment" className="form-input" value={alignment} onChange={event => setAlignment(event.target.value)} maxLength={48} />
          <label className="field-label" htmlFor="hero-ideal">{t('Ideal')}</label>
          <input id="hero-ideal" className="form-input" value={ideal} onChange={event => setIdeal(event.target.value)} />
          <label className="field-label" htmlFor="hero-bond">{t('Bond')}</label>
          <input id="hero-bond" className="form-input" value={bond} onChange={event => setBond(event.target.value)} />
          <label className="field-label" htmlFor="hero-flaw">{t('Flaw')}</label>
          <input id="hero-flaw" className="form-input" value={flaw} onChange={event => setFlaw(event.target.value)} />
          <label className="field-label" htmlFor="hero-backstory">{t('Backstory')}</label>
          <textarea id="hero-backstory" className="form-input" value={backstory} onChange={event => setBackstory(event.target.value)} rows={3} />
          <fieldset className="option-fieldset">
            <legend>{t('Combat challenge')}</legend>
            <div className="option-row">
              {['easy', 'normal', 'hard'].map(value => (
                <button type="button" key={value} className={`option-pill ${difficulty === value ? 'selected' : ''}`} onClick={() => setDifficulty(value)}>{t(value)}</button>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      {step === 9 && race && characterClass && background && abilityScores && (
        <div className="wizard-content">
          <p className="eyebrow">{t('STEP 9 · REVIEW')}</p>
          <h1 id="wizard-title">{t('Meet your adventurer')}</h1>
          <div className="review-card">
            <div className="review-avatar">{name.trim().charAt(0).toUpperCase()}</div>
            <div><h2>{name.trim()}</h2><p>{t(race.name)} {t(characterClass.name)} · {t(background.name)}</p></div>
          </div>
          <div className="review-grid">
            {reviewRows.map(row => (
              <div key={row.key}><small>{t(row.key)}</small><strong>{row.total}</strong><span>{row.modifier}</span></div>
            ))}
          </div>
          <p className="wizard-note">{t('Skills')}: {[...(background.skill_proficiencies ?? []), ...classSkills].join(', ')}</p>
          {spellCaster && (
            <p className="wizard-note">{t('Spells')}: {[...cantrips, ...levelOneSpells].join(', ')}</p>
          )}
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

function AbilityPicker({
  abilityKey,
  map,
  onAssign,
  t,
}: {
  abilityKey: AbilityKey;
  map: Record<AbilityKey, number | null>;
  onAssign: (key: AbilityKey, value: number) => void;
  t: (label: string) => string;
}) {
  return (
    <div className="option-row compact-options">
      {STANDARD_ARRAY.map(value => (
        <button
          type="button"
          key={value}
          className={`option-pill ${map[abilityKey] === value ? 'selected' : ''}`}
          onClick={() => onAssign(abilityKey, value)}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

function RaceGrid({
  catalog,
  raceKey,
  setRaceKey,
  playableOnly,
  t,
  abilityText,
}: {
  catalog: ReferenceCatalog;
  raceKey: string;
  setRaceKey: (key: string) => void;
  playableOnly: boolean;
  t: (label: string) => string;
  abilityText: (values: Record<string, number>) => string;
}) {
  const races = playableOnly ? catalog.races.filter(item => item.mvp_playable !== false) : catalog.races;
  return (
    <div className="selection-grid race-grid">
      {races.map(item => {
        const planned = item.mvp_playable === false;
        return (
          <button
            type="button"
            className={`selection-card ${raceKey === item.key ? 'selected' : ''} ${planned ? 'planned' : ''}`}
            key={item.key}
            disabled={planned}
            onClick={() => setRaceKey(item.key)}
          >
            <span className="card-title-row"><strong>{t(item.name)}</strong><small>{item.speed} ft.</small></span>
            <span className="card-stat">{abilityText(item.ability_increase)}</span>
          </button>
        );
      })}
    </div>
  );
}

function ClassGrid({
  catalog,
  classKey,
  setClassKey,
  t,
}: {
  catalog: ReferenceCatalog;
  classKey: string;
  setClassKey: (key: string) => void;
  t: (label: string) => string;
}) {
  const classes = catalog.classes.filter(item => item.mvp_playable !== false);
  return (
    <div className="selection-grid class-grid">
      {classes.map(item => (
        <button
          type="button"
          className={`selection-card ${classKey === item.key ? 'selected' : ''}`}
          key={item.key}
          onClick={() => setClassKey(item.key)}
        >
          <span className="card-title-row"><strong>{t(item.name)}</strong><small>d{item.hit_die}</small></span>
          <span className="card-stat">{t('Primary:')} {t(item.primary)}</span>
        </button>
      ))}
    </div>
  );
}
