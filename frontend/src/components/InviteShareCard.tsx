import { useState } from 'react';
import { useI18n } from '../i18n';
import { inviteLink, shareText, type ShareOutcome } from '../share/adventureShare';

export function InviteShareCard() {
  const { t } = useI18n();
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onShare = async () => {
    setBusy(true);
    setHint(null);
    const message = t(
      'Join me in Doupě Draka — a solo fantasy adventure in Telegram. Tap the link to start your own hero.',
    );
    const outcome: ShareOutcome = await shareText(`${message}\n${inviteLink()}`);
    setBusy(false);
    if (outcome === 'clipboard') setHint(t('Invite link copied to clipboard.'));
    else if (outcome === 'telegram') setHint(t('Opening Telegram share…'));
    else if (outcome === 'web') setHint(t('Share sheet opened.'));
    else setHint(t('Copy this link manually:') + ` ${inviteLink()}`);
  };

  const onCopy = async () => {
    const link = inviteLink();
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link);
      setHint(t('Invite link copied to clipboard.'));
    } else {
      setHint(link);
    }
  };

  return (
    <article className="home-invite-card invite-share-card">
      <div>
        <p className="eyebrow">{t('GROW THE PARTY')}</p>
        <h2>{t('Invite friends')}</h2>
        <p>
          {t(
            'Share Doupě Draka with friends. Referral rewards are not implemented yet — this link simply opens the Mini App.',
          )}
        </p>
      </div>
      <div className="invite-share-actions">
        <button type="button" className="primary" disabled={busy} onClick={() => void onShare()}>
          {t('Share invite link')} →
        </button>
        <button type="button" className="text-button" onClick={() => void onCopy()}>
          {t('Copy link')}
        </button>
      </div>
      {hint && (
        <p className="invite-share-hint" role="status">
          {hint}
        </p>
      )}
    </article>
  );
}
