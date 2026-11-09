import { useI18n } from '../i18n';

const MECHANIC_LINE = /^(Attack roll:|.*\bdamage\b|Saving throw:|Exploration roll:|Intelligence check:|Wisdom check:|Strength check:|Dexterity check:|Constitution check:|Charisma check:|.* vs DC \d+)/i;
const QUEST_LINE = /\b(quest|shrine bell|return the bell|caldus|nib|vault of echoes|bell warden|echo shard)\b/i;
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

const MECHANIC_CS: Array<[RegExp, string]> = [
  [/Exploration roll: (\d+) on a six-sided die\.(.*)/i, 'Průzkum: $1 na šestistranné kostce.$2'],
  [/Intelligence check: (\d+) vs DC (\d+) — (success|failure)\./i, 'Test inteligence: $1 proti ST $2 — $3.'],
  [/Wisdom check: (\d+) vs DC (\d+) — (success|failure)\./i, 'Test moudrosti: $1 proti ST $2 — $3.'],
  [/Attack roll: (.*)/i, 'Útočný hod: $1'],
  [/ — success\.?$/i, ' — úspěch.'],
  [/ — failure\.?$/i, ' — neúspěch.'],
];

function localizeMechanic(line: string, locale: 'en' | 'cs') {
  if (locale !== 'cs') return line;
  let output = line;
  for (const [pattern, replacement] of MECHANIC_CS) {
    output = output.replace(pattern, replacement);
  }
  return output
    .replace(/\bsuccess\b/gi, 'úspěch')
    .replace(/\bfailure\b/gi, 'neúspěch');
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

export function JournalResultBody({ result }: { result: string }) {
  const { locale, t } = useI18n();
  const { narration, facts } = splitNarrationAndFacts(result);
  const factBlocks = facts ? splitJournalResult(facts, locale) : [];
  return (
    <>
      {narration && (
        <p className="journal-narration-prose" aria-label={t('Narration')}>{narration}</p>
      )}
      {factBlocks.map((block, index) => (
        <p
          key={index}
          className={blockClass(block.kind, block.tone)}
          role={block.kind === 'prose' ? undefined : 'status'}
        >
          {block.text}
        </p>
      ))}
    </>
  );
}
