/**
 * Formatação e parsing de telefone BR (E.164 +55 DDD 9 dígitos).
 *
 * Regra: 13 dígitos = 55 + DDD (2) + número (9).
 */

const BRAZIL_PHONE_LENGTH = 13;
const BRAZIL_COUNTRY_CODE = '55';

export function extractBrazilPhoneDigits(input: string): string {
  let digits = input.replace(/\D/g, '');

  if (digits.length === 0) {
    return '';
  }

  if (!digits.startsWith(BRAZIL_COUNTRY_CODE)) {
    digits = `${BRAZIL_COUNTRY_CODE}${digits}`;
  }

  return digits.slice(0, BRAZIL_PHONE_LENGTH);
}

export function formatBrazilPhone(digits: string): string {
  if (digits.length === 0) {
    return '';
  }

  const cc = digits.slice(0, 2);
  const area = digits.slice(2, 4);
  const mid = digits.slice(4, 9);
  const end = digits.slice(9, 13);

  if (digits.length <= 2) {
    return `+${cc}`;
  }

  if (digits.length <= 4) {
    return `+${cc} (${area}`;
  }

  if (digits.length <= 9) {
    return `+${cc} (${area}) ${mid}`;
  }

  return `+${cc} (${area}) ${mid}-${end}`;
}

export function handleBrazilPhoneChange(text: string): { digits: string; formatted: string } {
  const digits = extractBrazilPhoneDigits(text);
  return {
    digits,
    formatted: formatBrazilPhone(digits),
  };
}
