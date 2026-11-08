import { useState } from 'react';
import { useI18n } from '../i18n';
import { shareText, type ShareOutcome } from '../share/adventureShare';
import { haptic } from '../telegramWebApp';

export function ShareButton({
  message,
  className = 'share-chip',
  label,
}: {
  message: string;
  className?: string;
  label?: string;
}) {
  const { t } = useI18n();
  const [hint, setHint] = useState<string | null>(null);

  const onShare = async () => {
    haptic('light');
    const outcome: ShareOutcome = await shareText(message);
    if (outcome === 'clipboard') {
      setHint(t('Copied to clipboard'));
    } else if (outcome === 'unsupported') {
      setHint(t('Sharing is not available in this browser'));
    } else {
      setHint(t('Opening share…'));
    }
    window.setTimeout(() => setHint(null), 2200);
  };

  return (
    <span className="share-button-wrap">
      <button type="button" className={className} onClick={() => void onShare()}>
        {label ?? t('Share')} <span aria-hidden="true">↗</span>
      </button>
      {hint && <span className="share-button-hint" role="status">{hint}</span>}
    </span>
  );
}
