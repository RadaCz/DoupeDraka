import { useEffect, type RefObject } from 'react';

/** Escape to close and optionally return focus when an overlay closes. */
export function useOverlayDismiss(
  open: boolean,
  onClose: () => void,
  returnFocusRef?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open || !returnFocusRef?.current) return;
    returnFocusRef.current.focus();
  }, [open, returnFocusRef]);
}