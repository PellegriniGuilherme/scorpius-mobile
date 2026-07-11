import { Linking } from 'react-native';
import { extractBrazilPhoneDigits } from '@/lib/formatPhone';

export function recipientPhoneDigits(phone: string): string | null {
  const digits = extractBrazilPhoneDigits(phone);
  if (digits.length < 12) {
    return null;
  }
  return digits;
}

export function buildTelUrl(phone: string): string | null {
  const digits = recipientPhoneDigits(phone);
  if (!digits) {
    return null;
  }
  return `tel:+${digits}`;
}

export function buildWhatsAppUrl(phone: string): string | null {
  const digits = recipientPhoneDigits(phone);
  if (!digits) {
    return null;
  }
  return `https://wa.me/${digits}`;
}

export async function openRecipientPhone(phone: string): Promise<boolean> {
  const url = buildTelUrl(phone);
  if (!url) {
    return false;
  }
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export async function openRecipientWhatsApp(phone: string): Promise<boolean> {
  const digits = recipientPhoneDigits(phone);
  if (!digits) {
    return false;
  }

  const appUrl = `whatsapp://send?phone=${digits}`;
  const webUrl = buildWhatsAppUrl(phone)!;

  try {
    const canOpenApp = await Linking.canOpenURL(appUrl);
    await Linking.openURL(canOpenApp ? appUrl : webUrl);
    return true;
  } catch {
    try {
      await Linking.openURL(webUrl);
      return true;
    } catch {
      return false;
    }
  }
}
