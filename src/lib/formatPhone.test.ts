import {
  extractBrazilPhoneDigits,
  formatBrazilPhone,
  handleBrazilPhoneChange,
} from './formatPhone';

describe('extractBrazilPhoneDigits', () => {
  it('returns empty for empty input', () => {
    expect(extractBrazilPhoneDigits('')).toBe('');
  });

  it('auto-prepends 55 when user types DDD directly', () => {
    expect(extractBrazilPhoneDigits('11')).toBe('5511');
    expect(extractBrazilPhoneDigits('11999998888')).toBe('5511999998888');
  });

  it('keeps 55 prefix and limits to 13 digits', () => {
    expect(extractBrazilPhoneDigits('5511999998888')).toBe('5511999998888');
    expect(extractBrazilPhoneDigits('55119999988887777')).toBe('5511999998888');
  });

  it('strips punctuation from pasted values', () => {
    expect(extractBrazilPhoneDigits('+55 (11) 99999-8888')).toBe('5511999998888');
  });
});

describe('formatBrazilPhone', () => {
  it('formats progressively while typing', () => {
    expect(formatBrazilPhone('5')).toBe('+5');
    expect(formatBrazilPhone('55')).toBe('+55');
    expect(formatBrazilPhone('5511')).toBe('+55 (11');
    expect(formatBrazilPhone('551199999')).toBe('+55 (11) 99999');
    expect(formatBrazilPhone('5511999998888')).toBe('+55 (11) 99999-8888');
  });

  it('returns empty for empty digits', () => {
    expect(formatBrazilPhone('')).toBe('');
  });
});

describe('handleBrazilPhoneChange', () => {
  it('returns digits and formatted value together', () => {
    expect(handleBrazilPhoneChange('11999998888')).toEqual({
      digits: '5511999998888',
      formatted: '+55 (11) 99999-8888',
    });
  });

  it('handles pasted formatted phone', () => {
    expect(handleBrazilPhoneChange('+55 (11) 99999-8888')).toEqual({
      digits: '5511999998888',
      formatted: '+55 (11) 99999-8888',
    });
  });
});
