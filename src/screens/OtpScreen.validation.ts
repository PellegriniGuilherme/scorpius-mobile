/**
 * Validação do código OTP.
 *
 * Paridade com backend: `DriverConfirmOtpRequest` exige `regex:/^\d{6}$/`
 * e `DriverAuthService` gera `random_int(0, 999999)` com padding à esquerda.
 */
export const OTP_CODE_LENGTH = 6;

export function isValidOtpCode(input: string): boolean {
  return new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`).test(input);
}
