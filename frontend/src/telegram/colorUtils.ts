/** Parse #RGB or #RRGGBB hex; returns [r,g,b] 0–255 or null. */
export function parseHexColor(hex: string | undefined): [number, number, number] | null {
  if (!hex || typeof hex !== 'string') return null;
  const raw = hex.trim().replace(/^#/, '');
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return [r, g, b];
  }
  if (raw.length === 6) {
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return [r, g, b];
  }
  return null;
}

/** WCAG relative luminance (sRGB). */
export function relativeLuminance(hex: string | undefined): number | null {
  const rgb = parseHexColor(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(channel => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** True when Telegram sent a light chrome color — game UI stays dark fantasy. */
export function isLightUiColor(hex: string | undefined, threshold = 0.42): boolean {
  const lum = relativeLuminance(hex);
  if (lum == null) return false;
  return lum > threshold;
}
