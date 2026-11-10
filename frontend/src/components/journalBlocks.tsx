import { useI18n } from '../i18n';
import { localizeMechanicsLine } from '../i18n/gameDisplay';
import { presentNarrationProse } from '../i18n/narrationPresent';

const MECHANIC_LINE = /^(Attack roll:|Attack with\b|.*\bdamage\b|Saving throw:|Exploration roll:|Intelligence check:|Wisdom check:|Strength check:|Dexterity check:|Constitution check:|Charisma check:|.* vs (DC|AC) \d+)/i;
const QUEST_LINE = /\b(quest|shrine bell|return the bell|caldus|nib|vault of echoes|bell warden|echo shard|úkol|zvon|chrámový zvon|nibovo|krypta|strážce zvonu)\b/i;
const STATE_LINE = /\b(your hp:|hp:|gold|inventory|level up!|xp|recover \d+ hp|ready your|you ready your|spell slot)\b/i;

export function splitNarrationAndFacts(result: string): { narration: string; facts: string } {
  const trimmed = result.trim();
  if (!trimmed) return { narration: '', facts: '' };
  const splitAt = trimmed.indexOf('\n\n');
  if (splitAt === -1) {
    if (MECHANIC_LINE.test(trimmed) || QUEST_LINE.test(trimmed) || STATE_LINE.test(trimmed)) {
      return { narration: '', facts: trimmed };
    }
    return { narration: trimmed, facts: '' };
  }
  return {
    narration: trimmed.slice(0, splitAt).trim(),
    facts: trimmed.slice(splitAt + 2).trim(),
  };
}

function localizeMechanic(line: string, locale: 'en' | 'cs') {
  return localizeMechanicsLine(line, locale);
}

function mechanicTone(line: string): 'success' | 'failure' | 'neutral' {
  const lower = line.toLowerCase();
  if (/failure|miss|fail/.test(lower)) return 'failure';
  if (/success|hit\.|defeated/.test(lower)) return 'success';
  return 'neutral';
}

type JournalBlockKind = 'prose' | 'mechanic' | 'quest' | 'state';

export function splitJournalResult(result: string, locale: 'en' | 'cs') {
  const blocks: Array<{ kind: JournalBlockKind; text: string; tone?: 'success' | 'failure' | 'neutral' }> = [];
  const paragraphs = result.split('\n\n');
  for (const paragraph of paragraphs) {
    const lines = paragraph.split('\n');
    let prose: string[] = [];
    const flushProse = () => {
      if (prose.length) {
        blocks.push({ kind: 'prose', text: prose.join('\n') });
        prose = [];
      }
    };
    for (const line of lines) {
      const trimmed = line.trim();
      if (MECHANIC_LINE.test(trimmed)) {
        flushProse();
        const text = localizeMechanic(trimmed, locale);
        blocks.push({ kind: 'mechanic', text, tone: mechanicTone(text) });
      } else if (QUEST_LINE.test(trimmed)) {
        flushProse();
        blocks.push({ kind: 'quest', text: trimmed });
      } else if (STATE_LINE.test(trimmed)) {
        flushProse();
        blocks.push({ kind: 'state', text: trimmed });
      } else if (trimmed) {
        prose.push(line);
      }
    }
    flushProse();
  }
  return blocks;
}

function blockClass(kind: JournalBlockKind, tone?: 'success' | 'failure' | 'neutral') {
  if (kind === 'mechanic') return `journal-mechanic journal-mechanic-${tone ?? 'neutral'}`;
  if (kind === 'quest') return 'journal-quest';
  if (kind === 'state') return 'journal-state';
  return 'journal-prose';
}

function FactBlocks({
  blocks,
  collapseMechanics,
  t,
}: {
  blocks: ReturnType<typeof splitJournalResult>;
  collapseMechanics: boolean;
  t: (value: string) => string;
}) {
  const proseBlocks = blocks.filter(block => block.kind === 'prose');
  const secondary = blocks.filter(block => block.kind !== 'prose');
  const mechanicBlocks = secondary.filter(block => block.kind === 'mechanic');
  const visibleSecondary = collapseMechanics
    ? secondary.filter(block => block.kind !== 'mechanic')
    : secondary;
  return (
    <>
      {proseBlocks.map((block, index) => (
        <p key={`prose-${index}`} className={blockClass('prose')}>
          {block.text}
        </p>
      ))}
      {visibleSecondary.map((block, index) => (
        <p
          key={`sec-${index}`}
          className={blockClass(block.kind, block.tone)}
          role={block.kind === 'prose' ? undefined : 'status'}
        >
          {block.text}
        </p>
      ))}
      {collapseMechanics && mechanicBlocks.length > 0 && (
        <details className="journal-mechanics-fold">
          <summary>{t('Rolls and outcomes')}</summary>
          {mechanicBlocks.map((block, index) => (
            <p
              key={`mech-${index}`}
              className={blockClass(block.kind, block.tone)}
              role="status"
            >
              {block.text}
            </p>
          ))}
        </details>
      )}
    </>
  );
}

export function JournalResultBody({
  result,
  collapseMechanics = false,
}: {
  result: string;
  collapseMechanics?: boolean;
}) {
  const { locale, t } = useI18n();
  const { narration, facts } = splitNarrationAndFacts(result);
  const factBlocks = facts ? splitJournalResult(facts, locale) : [];
  return (
    <>
      {narration && (
        <p className="journal-narration-prose" aria-label={t('Narration')}>
          {presentNarrationProse(narration, locale)}
        </p>
      )}
      {factBlocks.length > 0 && (
        <FactBlocks blocks={factBlocks} collapseMechanics={collapseMechanics} t={t} />
      )}
    </>
  );
}
