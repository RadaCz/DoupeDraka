const ROLL_LINE = /^(Attack roll:|.*\bdamage\b|Saving throw:|DC \d+)/i;

export function highlightJournalText(text: string) {
  const lines = text.split('\n');
  return lines.map((line, index) => {
    const dice = ROLL_LINE.test(line.trim());
    return (
      <span key={index}>
        <span className={dice ? 'journal-roll-line' : undefined}>{line}</span>
        {index < lines.length - 1 ? <br /> : null}
      </span>
    );
  });
}
