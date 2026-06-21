import { tokens } from '@/theme/tokens';

describe('theme tokens', () => {
  it('expõe escala 4px de spacing', () => {
    expect(tokens.space[1]).toBe(4);
    expect(tokens.space[4]).toBe(16);
    expect(tokens.space[8]).toBe(32);
  });

  it('expõe raio de borda', () => {
    expect(tokens.radius.sm).toBe(4);
    expect(tokens.radius.md).toBe(8);
    expect(tokens.radius.full).toBe(9999);
  });

  it('expõe tipografia consistente com Hub', () => {
    expect(tokens.text.sm).toBe(14);
    expect(tokens.text.base).toBe(16);
    expect(tokens.text.lg).toBe(18);
    expect(tokens.text['2xl']).toBe(24);
  });

  it('expõe durações de motion (mirror Hub)', () => {
    expect(tokens.motion.durationFast).toBe(150);
    expect(tokens.motion.durationBase).toBe(220);
    expect(tokens.motion.durationSlow).toBe(320);
  });
});
