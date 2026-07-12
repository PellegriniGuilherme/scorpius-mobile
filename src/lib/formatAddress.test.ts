import {
  formatAddressCompact,
  formatAddressLine,
  formatAddressLocalityLine,
  formatAddressStreetLine,
} from './formatAddress';

describe('formatAddress', () => {
  const full = {
    street: 'Av. Paulista',
    number: '1500',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    zip: '01310-100',
  };

  it('formats street + number without orphan separators', () => {
    expect(formatAddressStreetLine(full)).toBe('Av. Paulista, 1500');
  });

  it('omits empty number', () => {
    expect(formatAddressStreetLine({ street: 'Rua A, 123', number: '' })).toBe('Rua A, 123');
  });

  it('avoids duplicating number already in street', () => {
    expect(formatAddressStreetLine({ street: 'Rua A, 123', number: '123' })).toBe('Rua A, 123');
  });

  it('formats locality without empty neighborhood', () => {
    expect(formatAddressLocalityLine({ city: 'São Paulo', state: 'SP' })).toBe('São Paulo/SP');
  });

  it('formats compact primary/secondary for list cards', () => {
    expect(formatAddressCompact(full)).toEqual({
      primary: 'Av. Paulista, 1500',
      secondary: 'Bela Vista · São Paulo/SP',
    });
  });

  it('does not leave a dangling dash when number/neighborhood are missing', () => {
    const apiShape = {
      street: 'Rua B, 456',
      number: '',
      neighborhood: '',
      city: 'São Paulo',
      state: 'SP',
    };
    const compact = formatAddressCompact(apiShape);
    expect(compact.primary).toBe('Rua B, 456');
    expect(compact.secondary).toBe('São Paulo/SP');
    expect(formatAddressLine(apiShape)).toBe('Rua B, 456 · São Paulo/SP');
    expect(formatAddressLine(apiShape)).not.toMatch(/—/);
    expect(formatAddressLine(apiShape)).not.toMatch(/,\s*$/);
  });

  it('returns empty strings when address is blank', () => {
    expect(formatAddressCompact({})).toEqual({ primary: '', secondary: '' });
    expect(formatAddressLine({})).toBe('');
  });
});
