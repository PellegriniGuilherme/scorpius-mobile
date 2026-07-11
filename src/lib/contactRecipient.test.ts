import { Linking } from 'react-native';
import {
  buildTelUrl,
  buildWhatsAppUrl,
  openRecipientPhone,
  openRecipientWhatsApp,
  recipientPhoneDigits,
} from '@/lib/contactRecipient';

describe('contactRecipient', () => {
  const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  const canOpenURLSpy = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);

  beforeEach(() => {
    jest.clearAllMocks();
    openURLSpy.mockResolvedValue(true);
    canOpenURLSpy.mockResolvedValue(true);
  });

  it('normalizes brazil phone digits', () => {
    expect(recipientPhoneDigits('(11) 3333-4444')).toBe('551133334444');
    expect(recipientPhoneDigits('+5511999998888')).toBe('5511999998888');
  });

  it('returns null for invalid phone', () => {
    expect(recipientPhoneDigits('123')).toBeNull();
    expect(buildTelUrl('')).toBeNull();
    expect(buildWhatsAppUrl('abc')).toBeNull();
  });

  it('builds tel and whatsapp urls', () => {
    expect(buildTelUrl('+551133334444')).toBe('tel:+551133334444');
    expect(buildWhatsAppUrl('+551133334444')).toBe('https://wa.me/551133334444');
  });

  it('opens phone dialer', async () => {
    await expect(openRecipientPhone('+551133334444')).resolves.toBe(true);
    expect(openURLSpy).toHaveBeenCalledWith('tel:+551133334444');
  });

  it('opens whatsapp app when available', async () => {
    await expect(openRecipientWhatsApp('+551133334444')).resolves.toBe(true);
    expect(openURLSpy).toHaveBeenCalledWith('whatsapp://send?phone=551133334444');
  });

  it('falls back to wa.me when whatsapp app is unavailable', async () => {
    canOpenURLSpy.mockResolvedValue(false);
    await expect(openRecipientWhatsApp('+551133334444')).resolves.toBe(true);
    expect(openURLSpy).toHaveBeenCalledWith('https://wa.me/551133334444');
  });
});
