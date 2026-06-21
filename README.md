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
│   └── auth.ts          # OTP request/confirm/me
├── store/
│   └── auth.ts          # zustand: driver, isAuthenticated, bootstrap
├── navigation/
│   ├── types.ts         # AuthStack + AppStack param lists
│   └── RootNavigator.tsx
├── screens/
│   ├── LoginScreen.tsx           # WhatsApp input → requestOtp
│   ├── LoginScreen.validation.ts # testable, isolado
│   ├── OtpScreen.tsx             # 6-digit code → confirmOtp
│   ├── OtpScreen.validation.ts   # testable, isolado
│   └── DashboardScreen.tsx       # post-login stub
├── components/
│   ├── Button.tsx        # primary/secondary/ghost
│   └── Input.tsx         # text input com label + erro
├── theme/
│   ├── tokens.ts         # spacing/radius/typography (4px scale)
│   ├── palette.ts        # light/dark semantic colors
│   └── ThemeProvider.tsx # React Context + useColorScheme
├── i18n/
│   └── pt-BR.ts          # strings do MVP
└── ...
```

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
```

> ⚠️ **Status:** jest-expo setup funcional mas algumas deps RN
> (Flow types em @react-native/js-polyfills) ainda exigem config
> adicional. T068.2 polish cobrirá. Por enquanto os unit tests de
> lógica pura (validações, tokens) rodam quando o setup estiver OK.

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

## Próximas Tasks

- **T068.2** — jest-expo config + cobertura
- **T068.3** — Telas de listagem de entregas (driver feed)
- **T068.4** — Scanner de documentos (expo-camera + expo-document-scanner)
- **T068.5** — Offline-first com expo-sqlite
- **T068.6** — Theme polish (animations, focus rings)
- **T068.7** — E2E com Maestro
