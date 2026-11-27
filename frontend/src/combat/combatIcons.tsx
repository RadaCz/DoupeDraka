export type CombatIconName =
  | 'attack'
  | 'defend'
  | 'abilities'
  | 'items'
  | 'advance'
  | 'sprint'
  | 'retreat'
  | 'disengage'
  | 'flee'
  | 'spell'
  | 'potion'
  | 'end-turn'
  | 'shield'
  | 'decline'
  | 'feature';

const STROKE = 1.75;

export function CombatIcon({ name, className }: { name: CombatIconName; className?: string }) {
  const common = {
    className,
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: STROKE,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'attack':
      return (
        <svg {...common}>
          <path d="M4 20 L14 4" />
          <path d="M14 4 L20 8 L16 14 L10 10 Z" />
          <path d="M6 18 L10 14" />
        </svg>
      );
    case 'defend':
      return (
        <svg {...common}>
          <path d="M12 3 L19 6 V12 C19 17 16 20 12 21 C8 20 5 17 5 12 V6 Z" />
        </svg>
      );
    case 'abilities':
      return (
        <svg {...common}>
          <path d="M12 3 L14 9 L20 9 L15 13 L17 19 L12 15 L7 19 L9 13 L4 9 L10 9 Z" />
        </svg>
      );
    case 'items':
      return (
        <svg {...common}>
          <rect x="5" y="8" width="14" height="12" rx="2" />
          <path d="M9 8 V6 C9 4.5 10 3 12 3 C14 3 15 4.5 15 6 V8" />
        </svg>
      );
    case 'advance':
      return (
        <svg {...common}>
          <path d="M5 12 H17" />
          <path d="M13 8 L17 12 L13 16" />
        </svg>
      );
    case 'sprint':
      return (
        <svg {...common}>
          <path d="M6 17 L8 11 L11 14 L14 8 L17 11 L19 17" />
          <path d="M6 17 H19" />
        </svg>
      );
    case 'retreat':
      return (
        <svg {...common}>
          <path d="M19 12 H7" />
          <path d="M11 8 L7 12 L11 16" />
        </svg>
      );
    case 'disengage':
      return (
        <svg {...common}>
          <path d="M8 12 H16" />
          <path d="M10 9 L8 12 L10 15" />
          <path d="M14 9 L16 12 L14 15" />
        </svg>
      );
    case 'flee':
      return (
        <svg {...common}>
          <path d="M6 17 C8 14 10 13 12 13 C14 13 16 14 18 17" />
          <path d="M12 13 V6" />
          <path d="M9 9 L12 6 L15 9" />
        </svg>
      );
    case 'spell':
      return (
        <svg {...common}>
          <path d="M12 2 L13.5 8.5 L20 10 L13.5 11.5 L12 18 L10.5 11.5 L4 10 L10.5 8.5 Z" />
        </svg>
      );
    case 'potion':
      return (
        <svg {...common}>
          <path d="M9 3 H15 V7 L18 20 H6 L9 7 Z" />
          <path d="M9 11 H15" />
        </svg>
      );
    case 'end-turn':
      return (
        <svg {...common}>
          <path d="M5 12 H17" />
          <path d="M13 8 L17 12 L13 16" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3 L19 6 V12 C19 16 16 19 12 20 C8 19 5 16 5 12 V6 Z" />
          <path d="M9 12 L11 14 L15 10" />
        </svg>
      );
    case 'decline':
      return (
        <svg {...common}>
          <path d="M6 6 L18 18" />
          <path d="M18 6 L6 18" />
        </svg>
      );
    case 'feature':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2 V5 M12 19 V22 M2 12 H5 M19 12 H22" />
        </svg>
      );
    default:
      return <svg {...common}><circle cx="12" cy="12" r="4" /></svg>;
  }
}

export function EnemySilhouette({ foeType }: { foeType: string }) {
  const lower = foeType.toLowerCase();
  const kind =
    lower.includes('goblin') ? 'goblin'
      : lower.includes('wolf') ? 'wolf'
        : lower.includes('ghoul') ? 'ghoul'
          : lower.includes('bandit') ? 'humanoid'
            : lower.includes('warden') || lower.includes('boss') ? 'boss'
              : 'humanoid';

  return (
    <svg
      className="combat-enemy-silhouette"
      viewBox="0 0 48 56"
      width="40"
      height="46"
      aria-hidden
    >
      {kind === 'wolf' && (
        <>
          <ellipse cx="24" cy="34" rx="14" ry="10" fill="currentColor" opacity="0.85" />
          <path d="M10 28 L16 18 L22 26 Z" fill="currentColor" />
          <path d="M38 28 L32 18 L26 26 Z" fill="currentColor" />
          <circle cx="30" cy="30" r="2" fill="var(--tg-bg, #0d120e)" />
        </>
      )}
      {kind === 'goblin' && (
        <>
          <ellipse cx="24" cy="18" rx="10" ry="11" fill="currentColor" opacity="0.9" />
          <path d="M14 30 L24 28 L34 30 L32 50 L16 50 Z" fill="currentColor" opacity="0.85" />
          <path d="M12 22 L8 16 M36 22 L40 16" stroke="currentColor" strokeWidth="2" />
        </>
      )}
      {(kind === 'humanoid' || kind === 'boss' || kind === 'ghoul') && (
        <>
          <circle cx="24" cy="14" r="9" fill="currentColor" opacity="0.9" />
          <path d="M16 26 L24 24 L32 26 L30 50 L18 50 Z" fill="currentColor" opacity="0.85" />
          {kind === 'boss' && (
            <path d="M18 8 L24 4 L30 8" stroke="var(--gold, #c9a227)" strokeWidth="2" fill="none" />
          )}
        </>
      )}
    </svg>
  );
}