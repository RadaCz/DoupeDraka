export const E2E_BOT_TOKEN = '123456:e2e-test-token';

/** Telegram user ID bands (must not overlap between spec files in one run). */
export const E2E_TELEGRAM_ID = {
  chapterOne: 755_000_000,
  adventure: 700_000_000,
  fallen: 710_000_000,
  locale: 720_000_000,
  inventory: 730_000_000,
  savingThrow: 733_000_000,
  spellSave: 734_000_000,
  ghoulParalysis: 735_000_000,
  mobileTextFirst: 740_000_000,
  mobileViewports: 750_000_000,
  characterCreation: 760_000_000,
  playerJourney: 760_000_002,
  playLayout: 762_200_000,
  characterToAdventure: 775_000_000,
  classIdentity: 776_000_000,
} as const;
