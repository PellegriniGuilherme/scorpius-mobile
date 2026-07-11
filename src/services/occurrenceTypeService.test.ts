import {
  buildOccurrenceTypeNameMap,
  resolveOccurrenceTypeName,
} from '@/services/occurrenceTypeService';

describe('occurrenceTypeService labels', () => {
  const nameMap = buildOccurrenceTypeNameMap([
    {
      id: 1,
      slug: 'delay',
      name: 'Atraso',
      severity: 'low',
      requires_photo: false,
      is_active: true,
      origin: 'system',
    },
    {
      id: 2,
      slug: 'accident',
      name: 'Acidente',
      severity: 'critical',
      requires_photo: true,
      is_active: true,
      origin: 'system',
    },
  ]);

  it('maps slug to localized name', () => {
    expect(resolveOccurrenceTypeName('delay', nameMap)).toBe('Atraso');
    expect(resolveOccurrenceTypeName('accident', nameMap)).toBe('Acidente');
  });

  it('falls back to slug when type is unknown', () => {
    expect(resolveOccurrenceTypeName('erro', nameMap)).toBe('erro');
  });

  it('returns fallback when slug is empty', () => {
    expect(resolveOccurrenceTypeName(null, nameMap)).toBe('Ocorrência');
    expect(resolveOccurrenceTypeName(undefined, nameMap, '—')).toBe('—');
  });
});
