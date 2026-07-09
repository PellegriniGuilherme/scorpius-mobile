import { ptBR } from '@/i18n/pt-BR';

export function formatDeliveryWindowLabel(
  start: string | null,
  end: string | null,
): string | null {
  if (!start || !end) {
    return null;
  }

  const wStart = new Date(start).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const wEnd = new Date(end).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${wStart}–${wEnd}`;
}

export function deliveryWindowEmptyLabel(): string {
  return ptBR.detail.windowEmpty;
}
