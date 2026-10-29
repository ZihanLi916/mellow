// ----------------------------------------------------------------------
// Text normalization
// ----------------------------------------------------------------------
export function normalizeText(input: string): string {
  if (!input) return '';
  return input
    .normalize('NFKC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ----------------------------------------------------------------------
// Glass normalization mapping
// ----------------------------------------------------------------------
export function normalizeGlass(value: string): string {
  const norm = normalizeText(value);
  switch (norm) {
    case 'old fashioned glass':
    case 'lowball':
    case 'rocks glass':
    case 'rocks':
      return 'ROCKS';
    case 'tumbler':
      return 'UNKNOWN';
    case 'champagne saucer':
    case 'coupe':
      return 'COUPE';
    case 'collins':
      return 'COLLINS';
    case 'highball':
      return 'HIGHBALL';
    default:
      return norm.toUpperCase().replace(/ /g, '_');
  }
}

// ----------------------------------------------------------------------
// Ingredient brand normalization
// ----------------------------------------------------------------------
export function normalizeIngredient(value: string): string {
  const norm = normalizeText(value);
  switch (norm) {
    case 'campari':
      return 'campari';
    case 'whisky':
    case 'whiskey':
      return 'whisky';
    default:
      return norm;
  }
}

// ----------------------------------------------------------------------
// Volume conversion
// ----------------------------------------------------------------------
export function toMl(value: number, unit: 'ml' | 'cl' | 'l' | 'us_fl_oz' | 'imp_fl_oz'): number {
  if (value < 0 || !Number.isFinite(value)) {
    throw new Error('Invalid volume value');
  }
  switch (unit) {
    case 'ml': return value;
    case 'cl': return value * 10;
    case 'l': return value * 1000;
    case 'us_fl_oz': return value * 29.5735;
    case 'imp_fl_oz': return value * 28.4131;
    default: throw new Error('Unknown unit');
  }
}

// ----------------------------------------------------------------------
// GTIN normalization and validation
// ----------------------------------------------------------------------
/**
 * Validates a GTIN using GS1 checksum algorithm.
 */
export function validGtin(gtin: string): boolean {
  if (!/^\d+$/.test(gtin)) return false;
  const length = gtin.length;
  if (![8, 12, 13, 14].includes(length)) return false;
  const digits = gtin.split('').map(Number);
  const checkDigit = digits.pop()!;
  let sum = 0;
  for (let i = digits.length - 1, weight = 3; i >= 0; i--) {
    sum += digits[i] * weight;
    weight = weight === 3 ? 1 : 3;
  }
  const computedCheck = (10 - (sum % 10)) % 10;
  return computedCheck === checkDigit;
}

/**
 * Normalize a GTIN to 14 digits by padding with leading zeros.
 * Returns null if invalid.
 */
export function normalizeGtin(gtin: string): string | null {
  if (!validGtin(gtin)) return null;
  return gtin.padStart(14, '0');
}
