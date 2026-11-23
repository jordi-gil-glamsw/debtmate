/** Money helpers. All amounts are integer cents; formatting follows Catalan/Spanish conventions. */

const MINUS = '−'; // typographic minus sign

/**
 * Parses user input into cents. Accepts "32,40", "32.40", "1.250,50", "1250", "32,4 €".
 * Returns null when the input is not a valid non-negative amount with at most 2 decimals.
 */
export function parseAmount(input: string): number | null {
  let s = input.replace(/[€\s ]/g, '');
  if (!s) return null;

  if (s.includes(',')) {
    // Comma is the decimal separator; dots are thousands separators.
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.250" → thousands separator only.
    s = s.replace(/\./g, '');
  }

  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;

  const [intPart, decPart = ''] = s.split('.');
  const cents = Number(intPart) * 100 + Number((decPart + '00').slice(0, 2));
  return Number.isSafeInteger(cents) ? cents : null;
}

export type FormatOptions = {
  /** 'auto': minus only for negatives; 'always': also "+" for positives; 'never': absolute value. */
  sign?: 'auto' | 'always' | 'never';
  /** Append " €". Defaults to true. */
  currency?: boolean;
  /** Drop ",00" for whole amounts. */
  compact?: boolean;
};

export function formatMoney(cents: number, options: FormatOptions = {}): string {
  const { sign = 'auto', currency = true, compact = false } = options;
  const abs = Math.abs(cents);
  const intPart = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decPart = (abs % 100).toString().padStart(2, '0');

  let prefix = '';
  if (sign !== 'never' && cents < 0) prefix = MINUS;
  else if (sign === 'always' && cents > 0) prefix = '+';

  const number = compact && decPart === '00' ? intPart : `${intPart},${decPart}`;
  return `${prefix}${number}${currency ? ' €' : ''}`;
}

/** Formats cents for an editable input field, e.g. 3240 → "32,40". */
export function centsToInput(cents: number): string {
  return formatMoney(cents, { sign: 'never', currency: false });
}
