/**
 * Scorpius Move — OutboxService tests (T068.5).
 *
 * Cobre:
 *  - enqueue retorna id e persiste payload
 *  - getAll lista items em ordem created_at DESC
 *  - count retorna número correto
 *  - markFailed incrementa attempts + atualiza last_error + next_retry_at
 *  - markDone remove o item
 *  - next() retorna item com next_retry_at <= now, FIFO
 *  - next() retorna null se não há items prontos
 *  - close() reseta o DB
 */
import { OutboxService, type OutboxItem } from './OutboxService';
// __resetMockDb é exportado pelo jest.sqlite-mock.js, não pelo módulo real
// expo-sqlite (que tem a tipagem estrita). Usamos require para evitar conflito.
import { __resetMockDb } from '../../jest.sqlite-mock.js';

describe('OutboxService', () => {
  let svc: OutboxService;

  beforeEach(async () => {
    __resetMockDb();
    svc = new OutboxService();
    await svc.init();
  });

  afterEach(async () => {
    await svc.close();
    __resetMockDb();
  });

  it('enqueue returns an id and persists the payload', async () => {
    const id = await svc.enqueue('proof_upload', { deliveryId: 1001, photoPath: '/tmp/a.jpg' });
    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);
    const items = await svc.getAll();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(id);
    expect(items[0].type).toBe('proof_upload');
    expect(items[0].payload).toEqual({ deliveryId: 1001, photoPath: '/tmp/a.jpg' });
    expect(items[0].attempts).toBe(0);
    expect(items[0].next_retry_at).toBe(0);
    expect(items[0].last_error).toBeNull();
  });

  it('getAll returns items in created_at DESC order', async () => {
    await svc.enqueue('proof_upload', { deliveryId: 1 });
    await new Promise((r) => setTimeout(r, 5));
    await svc.enqueue('proof_upload', { deliveryId: 2 });
    await new Promise((r) => setTimeout(r, 5));
    await svc.enqueue('proof_upload', { deliveryId: 3 });
    const items = await svc.getAll();
    expect(items[0].payload.deliveryId).toBe(3);
    expect(items[1].payload.deliveryId).toBe(2);
    expect(items[2].payload.deliveryId).toBe(1);
  });

  it('count returns the number of pending items', async () => {
    expect(await svc.count()).toBe(0);
    await svc.enqueue('proof_upload', { deliveryId: 1 });
    await svc.enqueue('proof_upload', { deliveryId: 2 });
    expect(await svc.count()).toBe(2);
  });

  it('markFailed increments attempts and sets next_retry_at + last_error', async () => {
    const id = await svc.enqueue('proof_upload', { deliveryId: 1001 });
    const nextRetry = Date.now() + 30_000;
    await svc.markFailed(id, 'network timeout', nextRetry);
    const items = await svc.getAll();
    const item = items.find((i) => i.id === id);
    expect(item?.attempts).toBe(1);
    expect(item?.last_error).toBe('network timeout');
    expect(item?.next_retry_at).toBe(nextRetry);
  });

  it('markFailed can be called multiple times to increment attempts', async () => {
    const id = await svc.enqueue('proof_upload', { deliveryId: 1001 });
    await svc.markFailed(id, 'err 1', Date.now() + 30_000);
    await svc.markFailed(id, 'err 2', Date.now() + 60_000);
    await svc.markFailed(id, 'err 3', Date.now() + 120_000);
    const items = await svc.getAll();
    const item = items.find((i) => i.id === id);
    expect(item?.attempts).toBe(3);
    expect(item?.last_error).toBe('err 3');
  });

  it('markDone removes the item', async () => {
    const id = await svc.enqueue('proof_upload', { deliveryId: 1001 });
    expect(await svc.count()).toBe(1);
    await svc.markDone(id);
    expect(await svc.count()).toBe(0);
    const items = await svc.getAll();
    expect(items.find((i) => i.id === id)).toBeUndefined();
  });

  it('next() returns the item with next_retry_at <= now, FIFO', async () => {
    const id1 = await svc.enqueue('proof_upload', { deliveryId: 1 });
    await new Promise((r) => setTimeout(r, 5));
    const id2 = await svc.enqueue('proof_upload', { deliveryId: 2 });
    // Marcar id1 como "failed" com next_retry_at no futuro (não ready)
    await svc.markFailed(id1, 'temp fail', Date.now() + 60_000);
    // next() deve retornar id2 (next_retry_at = 0 = ready, mais recente)
    const ready = await svc.next();
    expect(ready?.id).toBe(id2);
    expect(ready?.payload.deliveryId).toBe(2);
  });

  it('next() returns null if no items are ready', async () => {
    const id = await svc.enqueue('proof_upload', { deliveryId: 1 });
    // Marca como failed com next_retry_at no futuro
    await svc.markFailed(id, 'temp fail', Date.now() + 60_000);
    const ready = await svc.next();
    expect(ready).toBeNull();
  });

  it('next() returns null when outbox is empty', async () => {
    const ready = await svc.next();
    expect(ready).toBeNull();
  });

  it('two services share the same DB (singleton storage)', async () => {
    const id = await svc.enqueue('proof_upload', { deliveryId: 1001 });
    const svc2 = new OutboxService();
    await svc2.init();
    try {
      const items = await svc2.getAll();
      expect(items.find((i) => i.id === id)).toBeTruthy();
    } finally {
      await svc2.close();
    }
  });

  it('payload is preserved exactly through enqueue → getAll', async () => {
    const payload = {
      deliveryId: 1001,
      photoPath: '/tmp/x.jpg',
      signatureName: 'João da Silva',
      extras: { nested: { deep: true } },
    };
    await svc.enqueue('proof_upload', payload);
    const items = await svc.getAll();
    expect(items[0].payload).toEqual(payload);
  });

  it('created_at and updated_at are populated', async () => {
    const before = Date.now();
    const id = await svc.enqueue('proof_upload', { deliveryId: 1 });
    const after = Date.now();
    const items = await svc.getAll();
    const item = items.find((i) => i.id === id);
    expect(item?.created_at).toBeGreaterThanOrEqual(before);
    expect(item?.created_at).toBeLessThanOrEqual(after);
    expect(item?.updated_at).toBeGreaterThanOrEqual(before);
    expect(item?.updated_at).toBeLessThanOrEqual(after);
  });

  it('updated_at is bumped on markFailed', async () => {
    const id = await svc.enqueue('proof_upload', { deliveryId: 1 });
    await new Promise((r) => setTimeout(r, 5));
    await svc.markFailed(id, 'err', Date.now() + 30_000);
    const items = await svc.getAll();
    const item = items.find((i) => i.id === id) as OutboxItem;
    expect(item.updated_at).toBeGreaterThan(item.created_at);
  });
});

// ---------------------------------------------------------------------------
// T098 — DLQ (Dead Letter Queue) tests.
// DLQ items são os que falharam MAX_ATTEMPTS vezes e estão com next_retry_at = 0.
// ---------------------------------------------------------------------------

describe('OutboxService DLQ (T098)', () => {
  let dlqSvc: OutboxService;

  beforeEach(async () => {
    __resetMockDb();
    dlqSvc = new OutboxService();
    await dlqSvc.init();
  });

  afterEach(async () => {
    await dlqSvc.close();
    __resetMockDb();
  });

  it('getDLQCount() returns 0 for empty outbox', async () => {
    expect(await dlqSvc.getDLQCount()).toBe(0);
  });

  it('getDLQCount() excludes pending items (next_retry_at > 0)', async () => {
    await dlqSvc.enqueue('proof_upload', { deliveryId: 1 });
    await dlqSvc.enqueue('proof_upload', { deliveryId: 2 });
    expect(await dlqSvc.getDLQCount()).toBe(0);
  });

  it('getDLQCount() counts only DLQ items (attempts >= MAX_ATTEMPTS + next_retry_at = 0)', async () => {
    const id1 = await dlqSvc.enqueue('proof_upload', { deliveryId: 1 });
    const id2 = await dlqSvc.enqueue('proof_upload', { deliveryId: 2 });
    const id3 = await dlqSvc.enqueue('proof_upload', { deliveryId: 3 });
    // Força DLQ em id1 e id2: 5 markFailed cada → attempts=5
    for (let i = 0; i < 5; i++) {
      await dlqSvc.markFailed(id1, '[DLQ] network timeout', 0);
      await dlqSvc.markFailed(id2, '[DLQ] 500 server error', 0);
    }
    // id3 fica pending (1 falha + retry futuro)
    await dlqSvc.markFailed(id3, 'temporary fail', Date.now() + 30_000);

    expect(await dlqSvc.getDLQCount()).toBe(2);
  });

  it('getDLQItems() returns DLQ items only, ordered by created_at DESC', async () => {
    const id1 = await dlqSvc.enqueue('proof_upload', { deliveryId: 100 });
    await new Promise((r) => setTimeout(r, 5));
    const id2 = await dlqSvc.enqueue('proof_upload', { deliveryId: 200 });
    for (let i = 0; i < 5; i++) {
      await dlqSvc.markFailed(id1, '[DLQ] err1', 0);
      await dlqSvc.markFailed(id2, '[DLQ] err2', 0);
    }

    const items = await dlqSvc.getDLQItems();
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe(id2);
    expect(items[1].id).toBe(id1);
    expect(items[0].last_error).toBe('[DLQ] err2');
    expect(items[1].last_error).toBe('[DLQ] err1');
  });

  it('retryDLQ() reseta attempts=0 + last_error=null', async () => {
    const id = await dlqSvc.enqueue('proof_upload', { deliveryId: 42 });
    for (let i = 0; i < 5; i++) {
      await dlqSvc.markFailed(id, `[DLQ attempt ${i + 1}]`, 0);
    }
    expect(await dlqSvc.getDLQCount()).toBe(1);

    await dlqSvc.retryDLQ(id);

    const items = await dlqSvc.getAll();
    const item = items.find((i) => i.id === id) as OutboxItem;
    expect(item.attempts).toBe(0);
    expect(item.last_error).toBeNull();
    expect(item.next_retry_at).toBe(0);
  });

  it('retryDLQ() não afeta items que não estão na DLQ (attempts < MAX_ATTEMPTS)', async () => {
    const id = await dlqSvc.enqueue('proof_upload', { deliveryId: 50 });
    await dlqSvc.markFailed(id, 'temporary', Date.now() + 30_000);

    await dlqSvc.retryDLQ(id);

    const items = await dlqSvc.getAll();
    const item = items.find((i) => i.id === id) as OutboxItem;
    expect(item.attempts).toBe(1);
    expect(item.next_retry_at).toBeGreaterThan(0);
    expect(item.last_error).toBe('temporary');
  });
});
