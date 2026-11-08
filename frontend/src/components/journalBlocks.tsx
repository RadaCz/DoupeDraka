import { useI18n } from '../i18n';

const MECHANIC_LINE = /^(Attack roll:|.*\bdamage\b|Saving throw:|Exploration roll:|Intelligence check:|Wisdom check:|Strength check:|Dexterity check:|Constitution check:|Charisma check:|.* vs DC \d+)/i;

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

export function splitJournalResult(result: string, locale: 'en' | 'cs') {
  const blocks: Array<{ kind: 'prose' | 'mechanic'; text: string; tone?: 'success' | 'failure' | 'neutral' }> = [];
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
      } else if (trimmed) {
        prose.push(line);
      }
    }
    flushProse();
  }
  return blocks;
}

export function JournalResultBody({ result }: { result: string }) {
  const { locale } = useI18n();
  const blocks = splitJournalResult(result, locale);
  return (
    <>
      {blocks.map((block, index) => (
        block.kind === 'mechanic' ? (
          <p key={index} className={`journal-mechanic journal-mechanic-${block.tone ?? 'neutral'}`} role="status">
            {block.text}
          </p>
        ) : (
          <p key={index} className="journal-prose">{block.text}</p>
        )
      ))}
    </>
  );
}
