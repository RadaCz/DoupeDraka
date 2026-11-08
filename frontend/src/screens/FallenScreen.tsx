import { useState } from 'react';
import type { Character } from '../types';
import { useI18n } from '../i18n';

export function FallenScreen({
  character,
  busy,
  onRevive,
  onGoHub,
}: {
  character: Character;
  busy: boolean;
  onRevive: () => Promise<void>;
  onGoHub: () => void;
}) {
  const { t } = useI18n();
  const [reviving, setReviving] = useState(false);
  return (
    <section className="screen fallen-screen" role="alert">
      <article className="fallen-card" aria-labelledby="fallen-title">
        <p className="eyebrow">{t('CHAPTER ONE')}</p>
        <h1 id="fallen-title">{t('You have fallen')}</h1>
        <p>{t('You have fallen. The cellar falls quiet around you.')}</p>
        <p className="fallen-meta">
          {character.name} · {character.gold} {t('gp')}
        </p>
        <button
          type="button"
          className="primary"
          disabled={busy || reviving}
          onClick={async () => {
            setReviving(true);
            try {
              await onRevive();
            } finally {
              setReviving(false);
            }
          }}
        >
          {reviving ? t('Reviving…') : t('Revive hero')}
        </button>
        <button type="button" className="text-button" onClick={onGoHub}>{t('Back to Hub')}</button>
        <small className="fallen-hint">{t('Revival costs 10% of carried gold (minimum 1 gp) when you have gold.')}</small>
      </article>
    </section>
  );
}
