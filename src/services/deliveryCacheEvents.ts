type DeliveryCacheListener = () => void;

const listeners = new Set<DeliveryCacheListener>();

export function subscribeDeliveryCache(listener: DeliveryCacheListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyDeliveryCacheChanged(): void {
  listeners.forEach((listener) => listener());
}
