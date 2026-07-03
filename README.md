# Scorpius Move

> App mobile do motorista — Expo + React Native.

Parte do monorepo Scorpius (`/Users/ai-agent/projects/scorpius`).
Este pacote (`apps/scorpius-move-app`) é a fundação F2 Mobile (T068-NX).

---

## Quick Start

```bash
# Do monorepo raiz:
pnpm install

# Dev server (Tunnel — funciona em LAN sem port forwarding):
pnpm --filter @scorpius/move-app dev:mobile

# Em outro terminal: start Expo
pnpm --filter @scorpius/move-app start

# Conectar:
#   - iOS: scaneie QR com câmera (Expo Go instalado)
#   - Android: abra Expo Go e scaneie QR
```

### Plataformas alvo

- iOS 14+
- Android 10+ (API 29+)

---

## Stack

| Camada | Lib | Por quê |
|---|---|---|
| Framework | Expo SDK 52 | Builds EAS sem Xcode/Android Studio local |
| Linguagem | TypeScript strict | Consistência com o Hub |
| Navigation | @react-navigation/native + native-stack | API mais usada no RN, type-safe |
| State | zustand | Mesma escolha do Hub (T030) |
| HTTP | axios | Bearer interceptor (mirror Hub) |
| Token storage | expo-secure-store | Keychain iOS / EncryptedSharedPreferences Android |
| i18n | inline pt-BR | TBD i18next quando multi-língua |
| Theme | own tokens (mirror Hub tokens.css) | F2.6 Design System parity |

---

## Estrutura

```
src/
├── api/
│   ├── client.ts        # axios + Bearer + 401 interceptor
│   ├── boot.ts          # setupSyncWorker() — injeta ApiClient no SyncWorker (T103 R-M3)
│   └── auth.ts          # OTP request/confirm/me
├── store/
│   └── auth.ts          # zustand: driver, isAuthenticated, bootstrap
├── navigation/
│   ├── types.ts         # AuthStack + AppStack param lists
│   └── RootNavigator.tsx # navigationRef + linking deep links (T099)
├── screens/
│   ├── LoginScreen.tsx           # WhatsApp input → requestOtp
│   ├── LoginScreen.validation.ts # testable, isolado
│   ├── OtpScreen.tsx             # 6-digit code → confirmOtp
│   ├── OtpScreen.validation.ts   # testable, isolado
│   ├── HomeMotoristaScreen.tsx   # 3 entregas + filtros (T068.1)
│   ├── DetalheEntregaScreen.tsx  # botões "Abrir mapa" / "Finalizar" (T068.2)
│   ├── MapaRotaScreen.tsx        # OSM embed + Linking Google Maps (T068.3 + T080)
│   ├── ComprovanteScreen.tsx     # foto + signature + DLQ UI (T068.4 + T098)
│   └── PerfilMotoristaScreen.tsx # dados do motorista + logout (T068.6)
├── services/
│   ├── OutboxService.ts  # SQLite outbox (enqueue/markDone/markFailed) (T068.5)
│   ├── SyncWorker.ts     # retry exponencial [30,60,120,300,600]s + DLQ
│   └── NotificationsService.ts # Expo Push + device-token registration
├── components/
│   ├── Button.tsx        # primary/secondary/ghost
│   ├── Card.tsx          # surface panel
│   ├── Input.tsx         # text input com label + erro
│   └── StatusBadge.tsx   # status indicator
├── theme/
│   ├── tokens.ts         # spacing/radius/typography (4px scale)
│   ├── palette.ts        # light/dark semantic colors
│   └── ThemeProvider.tsx # React Context + useColorScheme
├── i18n/
│   └── pt-BR.ts          # strings do MVP
└── ...
```

## Features-chave (após T103+T104-T106)

### 🔁 Outbox + Sync (T068.5, T103 R-M3)
- `OutboxService` (SQLite via `expo-sqlite`): persiste foto+signature se backend offline
- `SyncWorker`: processa items com **backoff exponencial + jitter 50%** ([30s, 60s, 120s, 300s, 600s])
- **DLQ (Dead Letter Queue):** items com `attempts >= 5` viram `next_retry_at = 0`. UI mostra badge "X itens falharam" e permite retry manual
- **Boot wiring (T103):** `setupSyncWorker()` injeta `ApiClient` no boot via `RootNavigator` useEffect. Sem isso, todo upload fica em retry loop infinito com "api client not configured"

### 🔗 Deep links (T099)
- `scorpius://delivery/{id}` e `https://app.scorpius.com.br/delivery/{id}` → DetalheEntrega
- `navigationRef` (react-navigation v7 `createNavigationContainerRef`) para push notifications navegarem automaticamente
- Push handler: tap em notificação → `navigationRef.navigate('DetalheEntrega', { deliveryId })`

### 📸 Comprovante de entrega (T068.4 + T098)
- `expo-image-picker` para captura de foto (nativa iOS/Android; mock em Expo Web)
- `expo-file-system` v18+ para persistir foto em cache local
- Upload via Spaces pre-signed URL: `POST /proof-upload` → `PUT` Spaces → `POST /complete`
- **DLQ UI:** modal com lista de items falhados + botão "Tentar novamente" por item

### 🗺 Mapa (T068.3 + T080)
- `react-native-maps` com `PROVIDER_GOOGLE` (Android nativo) — limitação: não funciona em Expo Web
- Fallback: OpenStreetMap embed via `<Image>` (web)
- `Linking.openURL('https://www.google.com/maps/dir/?api=1&destination=...')` para abrir em app nativo

---

## Backend esperado (Vulcan)

O app consome `/api/v1/driver/auth/*` (driver auth — diferente do Hub):

| Endpoint | Método | Body | Response |
|---|---|---|---|
| `/driver/auth/otp` | POST | `{whatsapp, device_id}` | `{message, expires_in}` |
| `/driver/auth/confirm` | POST | `{whatsapp, otp, device_id}` | `{access_token, token_type, driver}` |
| `/driver/auth/me` | GET | — (Bearer) | `{user: DriverMe}` |

A URL base vem de `extra.apiUrl` no `app.config.ts`, que é
sobrescrita por build profile via `eas.json` (development/preview/production).

---

## Testes

```bash
# Unit tests (Jest + jest-expo):
pnpm --filter @scorpius/move-app test

# Coverage:
pnpm --filter @scorpius/move-app test:coverage
```

**Status atual (T103 + T104-T106 merged):**
- ✅ **139 testes passing** (97 baseline + 42 novos: 30 T104 coverage + 7 T106 E2E + 5 misc)
- ✅ Lint: 0 errors, 0 warnings (`--max-warnings=0`)
- ✅ Typecheck: `tsc --noEmit` clean
- ✅ Coverage: **87.23% lines** (target 89%, gap conhecido em `navigation/` PreviewFlow e `store/auth.ts` bootstrap — T113 sugerido)

**Test breakdown por domínio:**
- Services: 92.11% (OutboxService + SyncWorker + NotificationsService)
- Components: 100% (Button, Card, Input, StatusBadge)
- Screens: 87.65% (5 telas do motorista + Login/OTP)
- Navigation: 65.78% (RootNavigator com PreviewFlow + linking deep)
- Store: 62.5% (auth bootstrap flow não mockado)

---

## Comandos

```bash
pnpm start                  # expo start
pnpm android                # expo start --android
pnpm ios                    # expo start --ios
pnpm web                    # expo start --web (não alvo do MVP)
pnpm dev:mobile             # expo start --tunnel (LAN-friendly)
pnpm typecheck              # tsc --noEmit
pnpm lint                   # eslint --max-warnings=0
pnpm test                   # jest
pnpm eas:build:dev          # eas build --profile development --platform android --local
```

---

## Documentação para agentes (IA)

- [`docs/agent/README.md`](./docs/agent/README.md) — índice
- [`docs/agent/MOVE.md`](./docs/agent/MOVE.md) — referência rápida do app
- Mapa do sistema: `vulcan/scorpius/docs/agent/SYSTEM-MAP.md`
- Lacunas: `vulcan/scorpius/docs/agent/GAPS.md`

## Próximas Tasks

- **T068.2** — jest-expo config + cobertura
- **T068.3** — Telas de listagem de entregas (driver feed)
- **T068.4** — Scanner de documentos (expo-camera + expo-document-scanner)
- **T068.5** — Offline-first com expo-sqlite
- **T068.6** — Theme polish (animations, focus rings)
- **T068.7** — E2E com Maestro
