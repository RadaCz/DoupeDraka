import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../i18n';
import { PlayErrorPanel } from './sharedPlayUI';

function renderPanel(props: { error: string; onRetry?: () => void }) {
  return render(
    <LocaleProvider>
      <PlayErrorPanel error={props.error} onRetry={props.onRetry} />
    </LocaleProvider>,
  );
}

describe('PlayErrorPanel', () => {
  it('calls onRetry instead of only hiding when retry is available', () => {
    const onRetry = vi.fn();
    renderPanel({ error: 'Network failed', onRetry });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows Dismiss when no retry handler is provided', () => {
    renderPanel({ error: 'Network failed' });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
