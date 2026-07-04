# F2.10 Outbox Architecture — Scorpius Move (T068.5)

> **Status:** implementado. ComprovanteScreen tira foto local + enfileira no OutboxService; SyncWorker processa com retry exponencial [30s/60s/120s/300s/600s] + DLQ.

## Por que outbox (não upload direto)

- **UX:** motorista não fica bloqueado se cair rede. Pode finalizar a entrega offline e o app sincroniza depois.
- **Battery:** evita retries síncronos no momento da captura. SyncWorker só acorda em transições (AppState active, NetInfo change) — sem `setInterval` rodando em background.
- **Resiliência:** mesmo padrão do T069 Z-API. Guilherme confirmou em 02:14 que quer outbox.

## Componentes

```
ComprovanteScreen
   ↓ outbox.enqueue('proof_upload', payload)
OutboxService (SQLite: id, type, payload, attempts, next_retry_at, last_error)
   ↑ next() / markFailed() / markDone()
SyncWorker
   ↓ uploadProof(payload)
apiClient (T076 Spaces pre-signed URL + T072 POST /complete)
```

### OutboxService (`src/services/OutboxService.ts`)

Storage local persistente (SQLite via `expo-sqlite`).

Schema:
```sql
CREATE TABLE outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,        -- 'proof_upload' | futuro
  payload TEXT NOT NULL,      -- JSON
  attempts INTEGER DEFAULT 0, -- contador de retries
  next_retry_at INTEGER,     -- ms epoch (0 = immediate)
  last_error TEXT,            -- mensagem do último erro
  created_at INTEGER,         -- ms epoch
  updated_at INTEGER          -- ms epoch
);
CREATE INDEX outbox_next_retry_at_idx ON outbox (next_retry_at);
```

API:
- `enqueue(type, payload) → id` — insere item com `attempts=0, next_retry_at=0`
- `markFailed(id, error, nextRetryAt)` — `attempts++`, atualiza `last_error` e `next_retry_at`
- `markDone(id)` — remove (upload confirmado)
- `next() → OutboxItem | null` — item com `next_retry_at <= now`, FIFO por `created_at`
- `getAll()` — debug/UI
- `count()` — badge de UI

Status implícito: row existe = pending; row removida = done.

### SyncWorker (`src/services/SyncWorker.ts`)

Processa items com retry exponencial + DLQ.

**Triggers** (sem `setInterval`):
- `AppState` listener: processa backlog quando app volta de background
- `NetInfo` listener: processa backlog quando volta a ficar online
- `tick()` chamado após `enqueue()` no submit
- `tick()` chamado em testes / retry manual

**Backoff (mesmo padrão T069 Z-API):**
```
attempts 0 → 1: next_retry_at = now + 30s
attempts 1 → 2: next_retry_at = now + 60s
attempts 2 → 3: next_retry_at = now + 120s
attempts 3 → 4: next_retry_at = now + 300s
attempts 4 → 5: next_retry_at = now + 600s
attempts >= 5 (MAX_ATTEMPTS): next_retry_at = 0 [DLQ]
```

**DLQ:** item fica na tabela com `next_retry_at = 0` e `last_error = "[DLQ] <msg>"`. UI mostra badge "Falhou — Tentar novamente". Botão "Reenviar" zera `attempts` e `next_retry_at` via `markFailed` (em produção deveria ser uma action mais explícita).

**API client interface:**
```ts
interface ApiClient {
  uploadProof(payload: ProofUploadPayload): Promise<void>;
}
```

Implementação real (`src/api/boot.ts`):
1. `POST /api/v1/driver/deliveries/{id}/upload-url` — `{ document_type, content_type }` → presigned URL
2. `PUT <presigned_url>` — binary JPEG
3. `POST /api/v1/driver/deliveries/{id}/proof` — `{ photo_url, signature_url? }`
4. `POST /api/v1/driver/deliveries/{id}/complete` — `{ notes? }`

Outbox types adicionais:
- `delivery_action` — replay FSM (`start`, `pickup`, `in-transit`, `fail`, `complete`)
- `occurrence_report` — `POST /sync/occurrences`

### ComprovanteScreen (`src/screens/ComprovanteScreen.tsx`)

Refactor (T068.5):
- Tap "Capturar foto" → `ImagePicker.launchCameraAsync` → copia para `Paths.cache` local
- Tap "Confirmar entrega" → `outbox.enqueue('proof_upload', payload)` + `syncWorker.tick()`
- UI mostra 3 estados: pending (sincronizando spinner) | failed (badge danger + "Reenviar") | success (✓ + "Voltando para a lista")
- Split em `ComprovanteScreen` (early return) + `ComprovanteScreenInner` (delivery narrowed para `NonNullable<...>`)

## Validações

- typecheck OK (`tsc --noEmit`)
- lint OK (`--max-warnings=0`)
- 82/82 testes passing (13 suites)
- Coverage global ~88% (target ≥65%)

Testes:
- `OutboxService.test.ts` (13 testes): enqueue, getAll, count, markFailed (attempts+1, last_error, next_retry_at), markFailed múltiplo, markDone, next FIFO, next null, payload aninhado, created_at/updated_at
- `SyncWorker.test.ts` (11 testes): tick sem items, tick success, tick fail + backoff, backoff dobra, DLQ após MAX, sem api client, tipo desconhecido, offline skip, inactive skip, re-entrant safe, start/stop listeners
- `ComprovanteScreen.test.tsx` (7 testes): render, "Entrega não encontrada", tap foto, canSubmit, submit success (enqueue + markDone), submit fail (mostra pending)

## Mocks de teste

- `jest.sqlite-mock.js` — mock in-memory de `expo-sqlite`. Implementa subset: INSERT/UPDATE/DELETE/SELECT com WHERE/ORDER BY/LIMIT. Necessário porque `expo-sqlite` em jest tenta carregar `Expo.fx.tsx` (módulo nativo) que não está disponível.
- `jest.setup.js` — mocks preventivos de `expo-image-picker` (default canceled), `expo-file-system` (Paths/Directory/File stubs), `@react-native-community/netinfo` (default online).

## Pendências (próximos PRs)

- **Jitter no backoff:** adicionar ±20% random para evitar thundering herd
- **Reenviar UX:** action dedicada ao invés de `markFailed` com backoff 0
- **SyncWorker ativo em background:** atualmente só processa em foreground. Se Guilherme rodar delivery offline, só sincroniza ao abrir o app.
- **Compression/resize de foto:** atualmente copia o JPEG da câmera direto. Para reduzir storage, redimensionar para 1024px antes de salvar.
- **Cleanup de items done:** atualmente `markDone` remove imediatamente. Para auditoria, manter por 7 dias.
- **Photo deduplication:** se motorista tira várias fotos da mesma entrega, só enfileira a última.
- **Backpressure visual:** mostrar fila total em PerfilMotorista (badge de "X entregas pendentes de sync").

## Decisões de design (para review)

1. **Por que SQLite e não AsyncStorage?** SQLite tem `WHERE` e `ORDER BY` nativo. AsyncStorage seria scan completo — ineficiente com muitos items.
2. **Por que `next_retry_at` em ms epoch?** Comparação trivial `WHERE next_retry_at <= ?`. ISO strings precisariam de parsing.
3. **Por que payload como TEXT JSON?** SQLite não tem JSON nativo e `json_extract` precisaria de schema fixo. TEXT é flexível.
4. **Por que singleton (outbox, syncWorker)?** App inteiro compartilha o mesmo DB. Re-abrir DB em hot reload pode corromper.
5. **Por que `tick()` público e re-entrant safe?** Permitir testes e retry manual sem duplicar items. Flag `ticking` evita corrida.
6. **Por que DLQ mantém o item na tabela (não deleta)?** Auditoria. UI pode re-enviar ou Guilherme pode inspecionar logs.

## Contrato backend (driver routes)

```
POST /api/v1/driver/deliveries/{id}/upload-url
  Request: { document_type: 'proof_of_delivery'|'signature', content_type: 'image/jpeg' }
  Response 200: { data: { url, key, content_type, expires_at, method } }

PUT <url>
  Body: binary (image/jpeg)
  Response 200: ok

POST /api/v1/driver/deliveries/{id}/proof
  Request: { photo_url, signature_url? }

POST /api/v1/driver/deliveries/{id}/complete
  Request: { photo_url?, signature_url?, notes? }
```

Frontend enfileira `uploadProof({ deliveryId, photoPath, signatureName })` no outbox; `boot.ts` executa a sequência acima.
