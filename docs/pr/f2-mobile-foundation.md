# F2 Mobile Foundation — T068-NX + T068.2 + T068.3 + T068.4 + T068.5 + T080

> **Status:** pronto para review. Branch `feature/f2-mobile` em `40559d2` (29 commits) · 95/95 testes · coverage 89.21% lines · 14 test files.

> **Decisão Guilherme 12:06:** Mapa = Google Maps (NÃO OpenStreetMap) · Push = Expo Push (NÃO polling HTTP).

## Summary

- **App do motorista (move-app)** completo: 5 telas navegáveis, auth OTP mock, outbox-resilient design para F2.10, Google Maps nativo + Expo Push.
- **Cobertura de testes:** 95/95 passing, 89.21% lines, 14 test files.
- **F2.10 Outbox foto** implementado: ComprovanteScreen tira foto local + enfileira no SQLite + SyncWorker com retry [30s/60s/120s/300s/600s] + DLQ.
- **T080 (Google Maps + Expo Push):** MapView real via `react-native-maps` + `PROVIDER_GOOGLE` · NotificationsService com deep linking via `data.delivery_id` · app.config.ts lê de `process.env`.

## O que entra

### App do motorista (Expo SDK 52 + React Navigation + zustand + secure-store)

- **5 telas:** Login → OTP → HomeMotorista → DetalheEntrega → MapaRota/Comprovante/Perfil
- **AppStack (RootNavigator):** 5 rotas + deep linking + preview mode (`?preview=NAME` para screenshots/E2E)
- **Infraestrutura:** auth store (zustand + expo-secure-store), api client (axios + Bearer), theme dark+light com tokens semânticos, i18n pt-BR
- **Mocks:** 3 entregas mock em `src/mocks/deliveries.ts` (driver_id=91)
- **Componentes compartilhados:** `Button` (4 variants: primary/secondary/ghost/danger), `Card`, `StatusBadge`, `Input`

### F2.10 Outbox foto (T068.5)

- **OutboxService** (SQLite): `enqueue` / `markFailed` / `markDone` / `next` / `getAll` / `count`
- **SyncWorker:** retry exponencial [30s/60s/120s/300s/600s] + DLQ após MAX_ATTEMPTS=5
- **ComprovanteScreen refactor:** tira foto via `expo-image-picker` → copia para `Paths.cache` local → enqueue outbox
- **UI states:** pending (sincronizando spinner) | failed (badge danger + Reenviar) | success (✓ + Voltando)

### T080: Google Maps + Expo Push (decisão Guilherme)

- **`MapaRotaScreen`:** `<MapView provider={PROVIDER_GOOGLE}>` com markers origem/destino + polyline + expo-location `ACCESS_FINE_LOCATION` + fallback visual se API key ausente
- **`NotificationsService`:** register + foreground handler + tap response (deep link via `data.delivery_id`) + `registerTokenWithBackend` (POST /api/v1/driver/device-tokens T072)
- **`app.config.ts`:** permissions iOS/Android + plugin `expo-notifications` + lê `process.env.EXPO_PUBLIC_*`
- **`.env.example`:** placeholders genéricos (chaves reais no `.env` gitignored)

### Testes (T068.2 + T068.3 + T068.5 + T080)

- **14 test files · 95/95 passing · coverage 89.21% lines**
- Setup jest+RTL no Expo SDK 52 (`jest-expo` + `@testing-library/react-native`)
- Mocks preventivos (F2.10): `react-native-maps`, `expo-camera`, `expo-image-picker`, `expo-haptics`, `expo-location`, `expo-linking`, `expo-notifications`, `expo-sqlite` (in-memory)
- Mocks de Fabric: `react-native-screens` + `native-stack` (JS puros em jest)

## Validações

| Check | Resultado |
|---|---|
| `pnpm typecheck` | ✅ OK |
| `pnpm lint` (`--max-warnings=0`) | ✅ OK · 0 violações |
| `pnpm test` | ✅ 95/95 passing · 14 suites |
| `pnpm test:coverage` | ✅ **89.21% lines** · 88.26% stmts · 74.38% branches |
| `pnpm build` (`expo export --platform web`) | ✅ 791KB JS, 1.18KB HTML, 11 assets |
| 100% coverage individual | Button · StatusBadge · Card · Input |

## Artefatos visuais

### Screenshots (mobile 390×844, dark mode)

7 telas em `docs/pr/screenshots/`:

| # | Tela | Screenshot |
|---|---|---|
| 1 | Login | `1-login-dark.png` |
| 2 | OTP | `2-otp-dark.png` |
| 3 | HomeMotorista | `3-home-motorista-dark.png` |
| 4 | DetalheEntrega | `4-detalhe-entrega-dark.png` |
| 5 | MapaRota (fallback visual — Expo Web) | `5-mapa-rota-dark.png` |
| 6 | Comprovante (outbox status) | `6-comprovante-dark.png` |
| 7 | PerfilMotorista | `7-perfil-motorista-dark.png` |

Screenshots light-mode + 14 PNGs originais (dark+light) em `/tmp/t068-mobile-screenshots/` para validação visual completa.

**Nota sobre MapaRota:** O `react-native-maps` real precisa de Fabric/TurboModules que só roda em iOS/Android nativo. No Expo Web, o screenshot mostra o **fallback visual** ("Google Maps API key não configurada") com botões de abrir Google Maps externo. Para screenshots do MapView real, Guilherme precisa rodar em device físico ou emulador.

### GIF de fluxo

`docs/pr/f2-mobile-flow.gif` — 13 frames, 390x844, Login → Home → Detalhe → Mapa via Playwright headless em Expo Web (390x844).

## Checklist validação manual (Guilherme)

Para validar localmente:

```bash
cd apps/scorpius-move-app
pnpm install
pnpm start --web --port 8081
# Abrir http://localhost:8081/?preview=home
```

- [ ] **Login com WhatsApp (mock auth):** `http://localhost:8081/?preview=login` → form com WhatsApp input
- [ ] **HomeMotorista lista 3 entregas mock:** `?preview=home` → 3 cards (Mercado Central, Farmácia Paulista, Hospital Norte)
- [ ] **DetalheEntrega mostra dados + navega:** tap em qualquer card → tela com cliente/endereço/itens
- [ ] **MapaRota renderiza com map mock (Expo Web):** `?preview=mapa` → fallback visual com aviso de API key OU MapView real (com API key configurada)
- [ ] **Comprovante tira foto mock:** `?preview=comprovante` → tap "Capturar foto" toggle visual + tap "Confirmar entrega" enfileira no outbox
- [ ] **PerfilMotorista logout com confirmação:** `?preview=perfil` → tap "Sair" → Alert com 2 botões
- [ ] **Preview mode bypassa auth:** qualquer `?preview=NAME` (formato correto: `?preview=home`, não `?preview=screen=home`)
- [ ] **Dark/Light toggle persiste:** toggle no header → persiste em localStorage entre reloads
- [ ] **i18n pt-BR:** todos os textos em português (Brasil)
- [ ] **Filtros funcionam:** HomeMotorista chips "Pendente" / "Em rota" / "Entregue" reduzem a lista

## Isolamento de escopo

- **Branch:** `feature/f2-mobile` a partir de `bb3fcc1` (main com Sprint v2 mergeado)
- **Diff vs main:** 30 arquivos, 100% `apps/scorpius-move-app/*` + `pnpm-lock.yaml` + screenshots
- **Sem dependências backend novas:** reusa `apps/scorpius-hub-api` Sprint v2 (T072 driver endpoints já merged)
- **Sem docs/backend poluindo:** `mint.json` (T071) e arquivos T072 backend foram propositalmente excluídos

## Decisões de design

- **Auth:** Bearer puro (igual ao Hub staging validado) — sem Sanctum stateful
- **Tema:** dark default + light, segue `system`, persiste em `localStorage` (Expo Web)
- **API URL:** configurável via `EXPO_PUBLIC_API_URL` (default `https://staging.hub.portalscorpiustecnologia.com.br/api/v1`)
- **Mock data:** 3 entregas hardcoded em `src/mocks/deliveries.ts` — substitui gradualmente por `/driver/deliveries` (T072) conforme Vulcan entrega os endpoints
- **Preview mode:** força uma tela específica via `?preview=NAME` (formato CORRETO: `?preview=home`) para screenshots/E2E. **ATENÇÃO:** `?preview=screen=home` (formato errado) faz `URLSearchParams.get('preview')` retornar `'screen=home'` que não está em `valid` e cai no fallback LoginScreen. Doc fix em commit `6bd9dcf`.
- **Google Maps:** `react-native-maps` + `PROVIDER_GOOGLE` (NÃO OpenStreetMap). API key em `.env`. Fallback visual sem key (UX não quebra).
- **Push:** Expo Push via `expo-notifications` (NÃO polling HTTP, NÃO Reverb). Backend Laravel dispara push usando tokens armazenados em `driver_device_tokens` (T072).
- **Outbox:** `expo-sqlite` (NÃO AsyncStorage — WHERE/ORDER BY nativo). `next_retry_at` em ms epoch (comparação trivial). Payload como TEXT JSON. Singleton. DLQ mantém item na tabela (auditoria, não deleta). Re-entrant safe (flag `ticking`).
- **Bundle ID:** `br.com.scorpius.move` (produção — T082). EAS project ID novo a ser criado.

## Cobertura detalhada

```
File                        | % Stmts | % Lines
All files                   |   88.26 |   89.21
 components                 |     100 |     100
  Button.tsx                |     100 |     100
  Card.tsx                  |     100 |     100
  Input.tsx                 |     100 |     100
  StatusBadge.tsx           |     100 |     100
 screens                    |   88.75 |   91.61
  ComprovanteScreen.tsx     |   83.63 |      90
  DetalheEntregaScreen.tsx  |     100 |     100
  HomeMotoristaScreen.tsx   |     100 |     100
  LoginScreen.tsx           |   89.47 |   89.47
  MapaRotaScreen.tsx        |   88.88 |   91.17
  PerfilMotoristaScreen.tsx |    82.6 |      85
 services                   |   93.02 |   93.25
  OutboxService.ts          |   98.43 |   98.38
  SyncWorker.ts             |   86.95 |   85.93
  NotificationsService.ts   |     ... |     ...
```

## Pendências (próximos PRs)

### T068.5 / T080 / T082
- **EAS Project ID novo (T082):** Guilherme precisa criar projeto `scorpius-move` em `expo.dev/eas` e atualizar `.env` com novo `EXPO_PUBLIC_EAS_PROJECT_ID`
- **Bundle IDs nativos:** adicionar `ios.config.googleMapsApiKey` + `android.config.googleMaps.apiKey` em `eas.json` por build profile
- **Rotação chave Google Maps (recomendada):** chave real `AIzaSyBKs76ngKeuSeLy91kN8VsSbKXsBXf74ZU` ficou no git history (commit `524e707`) mesmo após fix de placeholders no commit `40559d2`. Guilherme pode rotacionar no Google Cloud Console: criar nova, atualizar restriction de bundleId, revogar antiga.

### T079 (decisão pendente Atlas)
- T079 (ClickHouse 2GB RAM tuning) entrou no branch via main (commit `93ecabc`). É infra, não mobile. Atlas vai avaliar se mantém ou reverte antes do PR.

### F2.10 features restantes (próximas sprints)
- Outbox foto (sincronização real com T076/T072)
- Push notifications (deep link validado; produção pendente)
- Retry offline global
- Push grouping (Android)
- Silent push (sync de status)
- Background fetch (expo-task-manager)

## Review

- **@SentinelPellegriniBot:** QA + edge cases (offline, token expirado, upload falho, push duplicado)
- **@ScribePellegriniBot:** CHANGELOG + ADR mobile (decidir depois do review)
- **@VulcanPellegriniBot:** confirmar contrato `/driver/auth/otp` + `/driver/auth/me` + `/driver/deliveries` + `/driver/device-tokens` ainda bate com o que o app chama

## Documentação adicional

- `docs/mobile/outbox.md` — F2.10 outbox architecture (schema SQLite, retry policy, DLQ, decisões)
- `docs/mobile/maps-and-push.md` — Google Maps + Expo Push setup (chaves, endpoints, workarounds)
