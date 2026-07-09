# Changelog — Scorpius Move (Mobile App)

Todas as mudanças notáveis do app mobile **Scorpius Move** (Expo SDK 56 +
React Native 0.85 + React 19) são documentadas aqui.

> **Nota de versionamento:** o `package.json` deste app está atualmente em
> `0.1.0` (snapshot do F0). Este CHANGELOG adota um versionamento conceitual
> alinhado com o monorepo (`0.4.x`) baseado no **escopo de features entregue**,
> não no `package.json`. O bump do `package.json` será feito em conjunto com o
> release V1 (F1C+).

O formato segue [Keep a Changelog 1.1.0](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere a [Semantic Versioning](https://semver.org/lang/pt-BR/).

Este CHANGELOG é parte do monorepo Scorpius. O índice agregado vive em
[`/CHANGELOG.md`](../../CHANGELOG.md).

## [Unreleased]

### Changed

- **Janela de entrega** — `mapDelivery` consome `delivery_window_start` /
  `delivery_window_end` da API (sem fallback em `created_at` / `delivered_at`).
  Lista e detalhe exibem intervalo real ou "Sem janela definida".

### Added
- Em desenvolvimento (pós-MVP close 2026-06-24 — recursos V1).

## [0.4.0] - 2026-06-24 — Mobile F1C foundation + F2 Mobile + SDK 56 + driver endpoints

Release que consolida o trabalho de **fundação mobile** pós-F0: F1C (driver
end-to-end), F2 Mobile (Expo SDK upgrade + features-chave), hardening para
Android APK e gates de qualidade. Marca o ponto em que o app mobile tem
fluxo de motorista funcional (login OTP → check-phone → OTP countdown →
entregas → proof-of-delivery) com outbox offline-first, telemetria batch,
proof upload via Spaces e E2E Playwright.

**Highlights:**
- Expo SDK 52 → 56 + React Native 0.76 → 0.85 + React 19 (T115).
- Auth OTP: `Idempotency-Key` header em outbox proof upload (T100) + countdown regressivo no `OtpScreen` (T101).
- `GET /api/v1/driver/check-phone` com gate client-side antes de `requestOtp` (T122 backend + mobile).
- Keyboard safe area (`useSafeAreaInsets`) em `LoginScreen` + `OtpScreen` (T121).
- Android APK release rebuild (T120) com `babel-preset-expo` instalado.
- E2E Playwright 6/6 passando para fluxos críticos (T086).
- Features-chave T103/T104/T106 (Comprovante, MapaRota, Home, Coverage, DLQ UI, Deep link, MSW).

### Added

- **T115 SDK 52 → 56 upgrade** (merge `d94e885`, branch `feature/t115-sdk-56-upgrade`):
  Expo SDK 52 → 56, React Native 0.76 → 0.85, React 19. Inclui ajustes de
  autolinking Android rescue, `babel-preset-expo` 56, `expo-asset` 56.18,
  `expo-file-system` 56.8, `expo-updates`, `@react-native-community/netinfo` 12.
- **T100 Idempotency-Key em outbox proof upload** (commit `c3901d4`): cliente
  mobile inclui header `Idempotency-Key: <uuid>` em todos os POST do outbox de
  proof-of-delivery, alinhado com [ADR-0008 §3 B5](../../docs/adr/ADR-0008-quality-gates.md)
  + [ADR-0003 §4 Idempotência](../../docs/adr/ADR-0003-sync-engine.md).
  Server-side valida chave única em janela 24h (Redis SET NX).
- **T101 OTP countdown regressivo** (commit `907fe58`): `OtpScreen` exibe
  countdown de 60s para reenvio de OTP com estado disabled no botão
  `Reenviar`. Espelha o `expires_in` retornado pelo backend (`hub-api`).
- **T122 frontend — gate `checkPhone` antes de `requestOtp`** (commit `712ad60`):
  `LoginScreen` chama `GET /api/v1/driver/check-phone` antes de disparar
  `requestOtp`, evitando chamadas Z-API para números inválidos/inesperados
  e melhorando UX em erros de digitação.
- **T103 Mobile 100% funcional** (merge `4353da3`, branch `feature/t103-mobile-100pct`):
  telas test-driven restauradas — `ComprovanteScreen`, `MapaRotaScreen`,
  `HomeScreen` — + boot wiring (R-M3) + lint + test setup.
- **T104 Mobile Fase 1** (merge `ede2945`, branch `feature/t104-t106-mobile-fase1`):
  T104+T098+T099+T106 — Coverage boost (≥90% nos componentes críticos),
  DLQ UI para visualização de outbox failed, Deep link support,
  E2E MSW (Mock Service Worker) para testes determinísticos offline.
- **T086 E2E Playwright** (commit `c8beec1`, branch `feature/t086-e2e-mobile`):
  6/6 testes passando + screenshots. Cobre fluxos: cold start, login OTP
  happy path, login OTP wrong code, retry on network error, background→foreground,
  logout. Hooks em `e2e/` + `@playwright/test` como devDep.

### Changed

- `package.json`: dependências atualizadas para SDK 56 (`expo ~56.0.0`,
  `expo-file-system ~56.0.8`, `babel-preset-expo ~56.0.15`,
  `@expo/metro-runtime ~56.0.15`). React 19 + RN 0.85.
- `babel.config.js`: preset Expo 56 + ajustes para SDK upgrade.
- `tsconfig.json`: `strict` + `noUncheckedIndexedAccess` ativados.
- `metro.config.js`: ajustes para public-hoist-pattern (`@babel/*`) após T086.
- `android/app/build.gradle`: `newArchEnabled=false` para preview builds
  (rollback V1.1 avaliará reativação).

### Fixed

- **T120 Android APK rebuild** (commit `6dab5c7`): `babel-preset-expo`
  instalado como dependência explícita — faltava para Android release
  bundling, quebrava `eas build --profile development --platform android`.
- **T121 Keyboard safe area** (commit `0f8f4b3`): `useSafeAreaInsets`
  aplicado em `LoginScreen` e `OtpScreen` — evita keyboard nativo cobrindo
  inputs no iOS (notch) e Android (gesture nav). Espelha `tokens.css` safe-area
  do Hub (F2.6).
- **T115 Android autolinking patches** (commits `8583bed`, `dede913`,
  `44a8568`, `df31fee`): `expo-android-rescue` patches aplicados para
  SDK 52 → 56 build (PackageList.java override, paths corrigidos).
- **T068-NX Expo Web runtime** (commit `0352e1d`): deps Expo Web adicionadas
  para T068-NX screenshots + previews via web runtime.

### Security

- Token storage: `expo-secure-store` (Keychain iOS / EncryptedSharedPreferences Android).
- PIN local: SQLCipher (não toca servidor — D1, cross-ref
  [ADR-0002 §3](../../docs/adr/ADR-0002-authentication.md)).
- Outbox at-rest encryption (D14 cross-ref [ADR-0001 §14](../../docs/adr/ADR-0001-decisions-v1.md)).
- Logout remoto: HTTP 401 do servidor dispara wipe SQLCipher + revoke
  Sanctum token (cross-ref [ADR-0002 §18](../../docs/adr/ADR-0002-authentication.md)).

### Documentation

- README do app atualizado com features-chave (T103+T104-T106) + métricas T103.
- Cobertura cross-ref com [ADR-0003 Sync Engine](../../docs/adr/ADR-0003-sync-engine.md)
  (push model, idempotência, retry/backoff), [ADR-0004 Outbox + Sync](../../docs/adr/ADR-0004-outbox-sync-patterns.md)
  (DLQ), [ADR-0008 Quality Gates](../../docs/adr/ADR-0008-quality-gates.md) (B5 OpenAPI,
  B6 idempotency).
- Driver mobile OpenAPI spec dedicado: [`docs/openapi-driver-mobile.yml`](../../docs/openapi-driver-mobile.yml).
- Guias Mintlify (T092): [`docs/api-mobile-flow.mdx`](../../docs/api-mobile-flow.mdx),
  [`docs/api-proof-of-delivery.mdx`](../../docs/api-proof-of-delivery.mdx),
  [`docs/api-push-notifications.mdx`](../../docs/api-push-notifications.mdx).
- Guia E2E: [`docs/mobile/e2e-testing.md`](../../docs/mobile/e2e-testing.md).

### Tests

- **+212L** `DriverProofActionTest` (no backend, T076+T077) — backend coverage.
- **+50L** `DriverDeliveryActionTest` (T072 expanded) — Expo push token flow.
- **6/6** Playwright E2E mobile (T086) — fluxos críticos.
- Coverage boost ≥90% nos componentes mobile (T104).

### Referências

- Índice agregado: [`/CHANGELOG.md`](../../CHANGELOG.md) `[Unreleased]` e `[0.4.0]`.
- Decisões arquiteturais: [`ADR-0003-sync-engine`](../../docs/adr/ADR-0003-sync-engine.md),
  [`ADR-0004-outbox-sync-patterns`](../../docs/adr/ADR-0004-outbox-sync-patterns.md),
  [`ADR-0008-quality-gates`](../../docs/adr/ADR-0008-quality-gates.md).

[Unreleased]: https://github.com/pellegrini/scorpius/commits/feature/f1a-backend-foundation
[0.4.0]: https://github.com/pellegrini/scorpius/commits/feature/f1a-backend-foundation