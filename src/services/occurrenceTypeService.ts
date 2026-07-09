import NetInfo from '@react-native-community/netinfo';
import { listDriverOccurrenceTypes, type DriverOccurrenceType } from '@/api/occurrenceTypes';
import { occurrenceTypeCache } from '@/services/OccurrenceTypeCacheService';

export interface OccurrenceTypesResult {
  data: DriverOccurrenceType[];
  fromCache: boolean;
}

/**
 * Busca tipos de ocorrência com cache SQLite.
 * Online: atualiza cache e retorna dados frescos.
 * Offline ou erro de rede: retorna último cache salvo.
 */
export async function fetchOccurrenceTypesWithCache(
  activeOnly = true,
): Promise<OccurrenceTypesResult> {
  const net = await NetInfo.fetch();
  if (net.isConnected) {
    try {
      const data = await listDriverOccurrenceTypes(activeOnly);
      await occurrenceTypeCache.save(data);
      return { data, fromCache: false };
    } catch {
      const cached = await occurrenceTypeCache.load();
      if (cached?.length) return { data: cached, fromCache: true };
      throw new Error('occurrence_types_fetch_failed');
    }
  }

  const cached = await occurrenceTypeCache.load();
  if (cached?.length) return { data: cached, fromCache: true };
  return { data: [], fromCache: true };
}

/** Atualiza cache em background (best-effort, não lança). */
export async function refreshOccurrenceTypesCache(): Promise<void> {
  try {
    const net = await NetInfo.fetch();
    if (!net.isConnected) return;
    const data = await listDriverOccurrenceTypes(true);
    await occurrenceTypeCache.save(data);
  } catch {
    // mantém cache anterior
  }
}
