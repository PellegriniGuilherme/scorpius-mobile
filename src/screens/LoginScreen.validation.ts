/**
 * Validação do input de WhatsApp na LoginScreen.
 *
 * Extraída para um arquivo separado para que possa ser testada
 * isoladamente sem renderizar o componente (que depende de
 * navigation providers e useTheme).
 *
 * Regra: E.164 para BR = +55 (2 dígitos) + DDD (2 dígitos) + 9 dígitos
 * = 13 dígitos totais. Aceita entrada com pontuação — extrai só dígitos.
 */
export function validateWhatsappInput(input: string): boolean {
  const digits = input.replace(/\D/g, '');
  return digits.length === 13 && digits.startsWith('55');
}
