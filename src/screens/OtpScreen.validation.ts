/**
 * Validação do código OTP.
 *
 * Regra: exatamente 6 dígitos numéricos.
 */
export function isValidOtpCode(input: string): boolean {
  return /^\d{6}$/.test(input);
}
