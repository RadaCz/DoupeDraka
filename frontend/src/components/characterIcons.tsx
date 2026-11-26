export function IconWeapon({ className = 'char-v2-equipped-svg' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M4 20.5 18.5 6l1 1L5 21.5h-1v-1Zm13.9-13.2 1.2-1.2a1 1 0 0 1 1.4 0l1.3 1.3a1 1 0 0 1 0 1.4l-1.2 1.2-2.7-2.7ZM3 4v4.2l10.7 10.7 2.8-2.8L5.8 4H3Zm0 5.8v1.2h2.4L3 9.8Z"
      />
    </svg>
  );
}

export function IconShield({ className = 'char-v2-equipped-svg' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 2 4 5.5v6.3c0 4.6 3.2 8.9 8 10.2 4.8-1.3 8-5.6 8-10.2V5.5L12 2Zm0 18.2c-3.4-1.1-6-4.4-6-7.7V6.4l6-2.6 6 2.6v6.1c0 3.3-2.6 6.6-6 7.7Z"
      />
    </svg>
  );
}

export function IconCheck({ className = 'char-v2-roster-check' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M9.2 16.2 4.8 11.8l1.4-1.4 3 3 8.4-8.4 1.4 1.4-9.8 9.8Z"
      />
    </svg>
  );
}

export function IconChevron({ className = 'char-v2-roster-chevron' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M9.4 6.6 7.9 8.1 12.8 13l-4.9 4.9 1.5 1.5 6.4-6.4-6.4-6.4Z" />
    </svg>
  );
}