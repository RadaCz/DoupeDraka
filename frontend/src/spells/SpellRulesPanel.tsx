import { useI18n } from '../i18n';

export function SpellRulesPanel() {
  const { t } = useI18n();
  return (
    <div className="spell-rules-panel">
      <section>
        <h2 className="char-v2-section-title">{t('How spells work here')}</h2>
        <p>{t('Spell levels 1–9 cost spell slots. Cantrips (level 0) do not spend slots in this MVP.')}</p>
        <p>{t('Known spells live on your character. Some classes prepare a daily list; others know spells permanently. The engine accepts either list when you cast.')}</p>
        <p>{t('When you cast, the game engine rolls attacks or saves, spends a slot when appropriate, and returns facts. The narrator describes only what the engine confirms.')}</p>
      </section>
      <section>
        <h2 className="char-v2-section-title">{t('Targeting')}</h2>
        <p>{t('Damage spells in combat need a target. The action is sent as “cast Fire Bolt at Goblin scout”. Healing and utility spells omit a target unless the scene requires one.')}</p>
      </section>
      <section>
        <h2 className="char-v2-section-title">{t('Modeled vs catalog')}</h2>
        <p>{t('“Engine modeled” spells have deterministic effects in Doupě Draka. “Catalog only” spells appear in the SRD text but refuse casting without spending slots — same as typing them in the adventure composer.')}</p>
      </section>
    </div>
  );
}

export function RulesGlossaryPanel() {
  const { t } = useI18n();
  const items = [
    { term: 'AC', title: 'Armor Class (AC)', body: 'How hard you are to hit. Attack rolls must meet or beat your AC.' },
    { term: 'HP', title: 'Hit points (HP)', body: 'Your health. At 0 HP you fall until revived at a safe hub.' },
    { term: 'DC', title: 'Difficulty Class (DC)', body: 'The number a saving throw must meet. The engine sets DCs from spell rules.' },
    { term: 'Mod', title: 'Ability modifier', body: 'Each score gives a bonus or penalty: (score − 10) ÷ 2, rounded down.' },
    { term: 'Slots', title: 'Spell slots', body: 'Daily pool for leveled spells. Cantrips ignore slots. Spent slots return on rest when the engine allows.' },
  ];
  return (
    <div className="rules-glossary">
      <h2 className="char-v2-section-title">{t('Quick rules')}</h2>
      <ul className="rules-glossary-list">
        {items.map(item => (
          <li key={item.term}>
            <button type="button" className="rules-glossary-term" aria-expanded="false">
              <strong>{t(item.title)}</strong>
            </button>
            <p>{t(item.body)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
