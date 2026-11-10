/** When the action label duplicates the scene location header, hide the extra title in Play journal. */

export function normalizeJournalToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isExploreActionRedundant(action: string, location: string): boolean {
  const normalizedAction = normalizeJournalToken(action);
  const normalizedLocation = normalizeJournalToken(location);
  if (!normalizedLocation) return false;
  const locationBare = normalizedLocation.replace(/^the\s+/, '');
  if (!/^(search|explore|investigate|prohledat|prozkoumat|hledat)\b/.test(normalizedAction)) {
    return false;
  }
  return (
    normalizedAction.includes(normalizedLocation)
    || normalizedAction.includes(locationBare)
  );
}
