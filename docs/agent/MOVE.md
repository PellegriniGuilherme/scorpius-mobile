# Move App — Referência Rápida para Agentes

Repo: `nexus/scorpius-mobile` | Pacote: `@scorpius/move-app` | Stack: **Expo SDK 56**, React Native 0.85, TypeScript strict

## Estrutura

```
src/
├── api/
│   ├── client.ts         # Axios + SecureStore + 401 interceptor
│   ├── auth.ts           # checkPhone, requestOtp, confirmOtp, fetchDriverMe
│   └── boot.ts           # setupSyncWorker() + proof upload adapter
├── navigation/
│   ├── RootNavigator.tsx # Auth/App stacks, deep links, preview mode
│   └── types.ts          # Param lists type-safe
├── screens/              # 7 telas + *.validation.ts
├── services/
│   ├── OutboxService.ts  # SQLite outbox
│   ├── SyncWorker.ts     # Retry exponencial + DLQ
│   └── NotificationsService.ts
├── store/auth.ts         # Zustand: driver, isAuthenticated, bootstrap
├── mocks/deliveries.ts   # ⚠️ MOCK — 3 entregas hardcoded
├── components/           # Button, Card, Input, StatusBadge
├── theme/                # tokens, palette, ThemeProvider
└── i18n/pt-BR.ts
```

## Navegação

### AuthStack (não autenticado)
| Rota | Tela | API |
|------|------|-----|
| `Login` | WhatsApp input | `GET /driver/check-phone`, `POST /driver/auth/otp` |
| `Otp` | 6 dígitos | `POST /driver/auth/otp/confirm` |

### AppStack (autenticado)
| Rota | Params | Tela | Dados |
|------|--------|------|-------|
| `HomeMotorista` | — | Lista + filtros | ⚠️ MOCK |
| `DetalheEntrega` | `{ deliveryId }` | Detalhe | ⚠️ MOCK |
| `MapaRota` | `{ deliveryId }` | OSM + Google Maps link | ⚠️ MOCK coords |
| `Comprovante` | `{ deliveryId }` | Foto + assinatura | ✅ API via outbox |
| `PerfilMotorista` | — | Dados + logout | ✅ `/me` |

## Auth — fluxo completo

```
LoginScreen
  → validate phone (LoginScreen.validation.ts)
  → checkPhone(+55...)           GET /driver/check-phone
  → if exists: requestOtp        POST /driver/auth/otp {whatsapp, device_id}
  → navigate Otp

OtpScreen
  → confirmOtp                   POST /driver/auth/otp/confirm
  → setAccessToken (SecureStore)
  → setSession(driver)
  → RootNavigator → AppStack

Boot (RootNavigator useEffect)
  → bootstrap()                    GET /driver/auth/me (se token existe)
  → setupSyncWorker(apiClient)     injeta client no SyncWorker
```

**Gaps auth:**
- `device_id` hardcoded `'move-app'` — deve ser UUID persistente
- Reenviar OTP: TODO em `OtpScreen.tsx` (só reseta timer)

## API wired vs não wired

### ✅ Wired (chamado em runtime)
| Endpoint | Arquivo |
|----------|---------|
| `GET /driver/check-phone` | `api/auth.ts` → `LoginScreen` |
| `POST /driver/auth/otp` | `api/auth.ts` → `LoginScreen` |
| `POST /driver/auth/otp/confirm` | `api/auth.ts` → `OtpScreen` |
| `GET /driver/auth/me` | `api/auth.ts` → `store/auth.ts` |
| Proof presign → PUT → complete | `api/boot.ts` → `SyncWorker` |

### ❌ Não wired (backend existe, app usa mock)
| Endpoint | Deveria alimentar |
|----------|------------------|
| `GET /driver/deliveries` | `HomeMotoristaScreen` |
| `GET /driver/deliveries/{id}` | `DetalheEntregaScreen` |
| `POST /driver/deliveries/{id}/start` etc. | Ações na tela detalhe |
| `POST /driver/device-tokens` | `NotificationsService` (existe, não chamado) |
| `POST /upload/telemetry` | Sem tela |
| `POST /sync/*` | Parcial |

## Mock de entregas

Arquivo: `src/mocks/deliveries.ts`

- 3 entregas com `driver_id: 91`
- Home filtra por `driver?.id` do auth store
- **Se backend retornar ID diferente, lista fica vazia**

Shape local (pode diferir do backend):
```typescript
interface Delivery {
  id, code, status, customer, address, items,
  scheduled_for, window_start, window_end, driver_id, proof_url?
}
```

**Antes de wire:** comparar com response real de `GET /driver/deliveries`.

## Outbox offline (comprovante)

```
ComprovanteScreen
  → expo-image-picker (foto)
  → OutboxService.enqueue({ type: 'proof', payload })
  → SyncWorker.tick() (manual após submit)

SyncWorker (backoff: 30, 60, 120, 300, 600s + jitter 50%)
  → POST /deliveries/{id}/proof-upload  (presign)
  → PUT {presigned_url}                  (Spaces)
  → POST /deliveries/{id}/complete

DLQ: attempts >= 5 → next_retry_at = 0
UI: badge + modal retry em ComprovanteScreen
```

**Gap crítico:** `syncWorker.start()` nunca chamado — listeners NetInfo/AppState inativos.
Sync só roda via `tick()` manual pós-submit.

Detalhes: `docs/mobile/outbox.md`

## Deep links

Configurado em `RootNavigator.tsx`:
```
scorpius://delivery/{id}        → DetalheEntrega
scorpius://delivery/{id}/route  → MapaRota
scorpius://delivery/{id}/proof  → Comprovante
https://app.scorpius.com.br/... (mesmos paths)
```

⚠️ `app.config.ts` usa `scheme: 'scorpiusmove'` — possível inconsistência.

Push tap com `data.delivery_id` → navega `DetalheEntrega`.

## Mapa

`MapaRotaScreen.tsx`:
- OSM embed via `<Image>` (não usa `react-native-maps` apesar de estar instalado)
- Distância haversine calculada localmente
- `Linking.openURL` → Google Maps nativo

`expo-location` configurado em `app.config.ts` mas **não usado**.

## Config / env

Base URL: `Constants.expoConfig.extra.apiUrl`
- Default: `http://localhost:8000/api/v1`
- Override: `.env` (`EXPO_PUBLIC_*`) ou `eas.json` profiles

```bash
# .env.example
EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## Testes

19 arquivos Jest (~145 casos):

| Área | Arquivos |
|------|----------|
| Screens | `*Screen.test.tsx` (7 telas) |
| Navigation | `RootNavigator.test.tsx` |
| API | `client.test.ts`, `auth.test.ts`, `boot.test.ts` |
| Services | `OutboxService`, `SyncWorker`, `SyncWorker.msw`, `NotificationsService` |
| Components | `Button`, `StatusBadge` |
| Theme | `tokens.test.ts` |

```bash
npm test
npm run test:coverage   # target ~87% lines
```

## Padrões ao implementar

1. Strings em `src/i18n/pt-BR.ts`
2. Validação isolada em `*.validation.ts` (testável)
3. Theme via `useTheme()` — não hardcode cores
4. `testID` em elementos interativos (padrão existente)
5. Offline-first: enfileirar no outbox, não bloquear UI
6. `setupSyncWorker()` deve rodar no boot — ver `api/boot.ts`

## Wire entregas reais — checklist

Quando implementar M1/M2 (ver GAPS.md):

1. Criar `src/api/deliveries.ts` espelhando endpoints driver
2. Substituir imports de `mocks/deliveries` nas telas
3. Mapear status backend → `DeliveryStatus` local
4. HomeMotorista: `useEffect` fetch + pull-to-refresh
5. DetalheEntrega: fetch por `deliveryId` param
6. Botões ação: chamar `POST /driver/deliveries/{id}/{action}`
7. Atualizar testes (mock API com MSW ou jest mocks)
8. Remover ou manter mock só em `__tests__/fixtures/`

## Componentes UI

| Componente | Variants |
|------------|----------|
| Button | primary, secondary, ghost |
| Card | surface panel |
| Input | label + error |
| StatusBadge | pending, in_route, delivered, failed |

Tokens: `src/theme/tokens.ts` (mirror Hub `tokens.css`)
