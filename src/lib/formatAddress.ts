/**
 * Formatação de endereços da API de entregas.
 *
 * O backend costuma enviar street/city/state/zip — number e neighborhood
 * são opcionais. Não deve aparecer separador órfão (ex.: "Rua X,  —").
 */

export type AddressParts = {
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

function trimPart(value?: string | null): string {
  return value?.trim() ?? '';
}

/** Rua + número, sem vírgula solta. */
export function formatAddressStreetLine(address: AddressParts): string {
  const street = trimPart(address.street);
  const number = trimPart(address.number);

  if (!street && !number) return '';
  if (!number) return street;
  if (!street) return number;
  if (street.includes(number)) return street;
  return `${street}, ${number}`;
}

/** Bairro · Cidade/UF — só partes preenchidas. */
export function formatAddressLocalityLine(address: AddressParts): string {
  const neighborhood = trimPart(address.neighborhood);
  const city = trimPart(address.city);
  const state = trimPart(address.state);
  const cityState = [city, state].filter(Boolean).join('/');
  return [neighborhood, cityState].filter(Boolean).join(' · ');
}

/**
 * Linha compacta para cards da listagem.
 * Ex.: "Rua Augusta, 2200 · Consolação · São Paulo/SP"
 */
export function formatAddressCompact(address: AddressParts): {
  primary: string;
  secondary: string;
} {
  return {
    primary: formatAddressStreetLine(address),
    secondary: formatAddressLocalityLine(address),
  };
}

/** Linha única para mapa / fallbacks. */
export function formatAddressLine(address: AddressParts): string {
  const primary = formatAddressStreetLine(address);
  const secondary = formatAddressLocalityLine(address);
  if (primary && secondary) return `${primary} · ${secondary}`;
  return primary || secondary;
}
