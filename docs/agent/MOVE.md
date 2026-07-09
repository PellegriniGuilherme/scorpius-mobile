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

**Auth:** `device_id` persistente via `src/lib/deviceId.ts`. OTP resend wired em `OtpScreen.tsx`.

## API wired vs não wired

### ✅ Wired (produção)
| Endpoint | Arquivo |
|----------|---------|
| Auth completo (check-phone → OTP → confirm → refresh → logout → me) | `api/auth.ts`, `api/client.ts` |
| Entregas driver (list, detail, FSM actions) | `api/deliveries.ts`, `services/deliveryActions.ts` |
| Proof upload-url → PUT → proof → complete | `api/boot.ts` → `SyncWorker` |
| Cache offline entregas | `services/DeliveryCacheService.ts` |
| Sync events/occurrences/cursor | `api/sync.ts` |
| Ocorrências driver | `api/occurrenceTypes.ts`, `ReportarOcorrenciaScreen` |
| Push device-tokens | `NotificationsService` + `RootNavigator` boot |
| Outbox types: `proof_upload`, `delivery_action`, `occurrence_report` | `OutboxService`, `SyncWorker` |

### ⚠️ Mock apenas em preview/tests
| Recurso | Onde |
|---------|------|
| Entregas fixture | `src/mocks/deliveries.ts` + `?preview=` |

## Entregas — shape API

Mapper: `src/lib/mapDelivery.ts` (`DeliveryResource` → `DeliveryViewModel`)

Campos API: `reference_code`, `recipient`, `delivery_address`, `package_count`, `weight_kg`, `proof_requirements`, status FSM (`pending` → `assigned` → `picked_up` → `in_transit` → `delivered`|`failed`).

## Outbox offline (comprovante + ações)

```
ComprovanteScreen / DetalheEntrega
  → outbox.enqueue(type, payload)
  → syncWorker.start() no boot (RootNavigator)

SyncWorker
  proof_upload → POST /driver/deliveries/{id}/upload-url → PUT binary → proof → complete
  delivery_action → POST /driver/deliveries/{id}/{action}
  occurrence_report → POST /sync/occurrences
```

Detalhes: `docs/mobile/outbox.md`, checklist: `docs/mobile/ROUTE-CHECKLIST.md`

## Deep links

```
scorpiusmove://home
scorpiusmove://delivery/{id}
scorpiusmove://delivery/{id}/route
scorpiusmove://delivery/{id}/proof
scorpiusmove://profile
```

Push tap com `data.delivery_id` → `DetalheEntrega`.

## Config / env

Produção EAS: `https://api.hub.portalscorpiustecnologia.com.br/api/v1` (ver `eas.json` profile `production`).

```bash
EXPO_PUBLIC_API_URL=https://api.hub.portalscorpiustecnologia.com.br/api/v1
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
