import { validateWhatsappInput } from '@/screens/LoginScreen.validation';

describe('LoginScreen phone validation', () => {
  it('rejeita string vazia', () => {
    expect(validateWhatsappInput('')).toBe(false);
  });

  it('rejeita número sem DDD', () => {
    expect(validateWhatsappInput('999998888')).toBe(false);
  });

  it('rejeita número com DDD mas sem 9 dígitos', () => {
    expect(validateWhatsappInput('1199998888')).toBe(false);
  });

  it('rejeita número com tamanho excessivo', () => {
    expect(validateWhatsappInput('55119999988887777')).toBe(false);
  });

  it('aceita 5511999998888 (E.164 BR com 9 dígitos)', () => {
    expect(validateWhatsappInput('5511999998888')).toBe(true);
  });

  it('aceita com pontuação (extrai só dígitos)', () => {
    expect(validateWhatsappInput('+55 (11) 99999-8888')).toBe(true);
  });
});
