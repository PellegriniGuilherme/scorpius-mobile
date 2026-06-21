# F2 Mobile Foundation — T068-NX + T068.2 + T068.3

> **Status:** pronto para review. Branch `feature/f2-mobile` em `ee14d19` · 19 commits · 59/59 testes · coverage 86.66% lines · 11 test files.

## Summary

- **App do motorista (move-app)** completo: 5 telas navegáveis, auth OTP mock, outbox-resilient design pronto para F2.10.
- **Cobertura de testes ≥80%** nas 4 telas críticas (Comprovante, DetalheEntrega, HomeMotorista, MapaRota) — 59/59 passing.
- **Preview mode** (`?preview=screen=NAME`) para screenshots E2E + demo rápido sem precisar de auth real.

## O que entra

### App do motorista (Expo SDK 52 + React Navigation + zustand + secure-store)

- **5 telas:** Login → OTP → HomeMotorista → DetalheEntrega → MapaRota/Comprovante/Perfil
- **AppStack (RootNavigator):** 5 rotas + deep linking + preview mode para screenshots/E2E
- **Infraestrutura:** auth store (zustand + expo-secure-store), api client (axios + Bearer), theme dark+light com tokens semânticos, i18n pt-BR
- **Mocks:** 3 entregas mock em `src/mocks/deliveries.ts` (driver_id=91)
- **Componentes compartilhados:** `Button` (4 variants: primary/secondary/ghost/danger), `Card`, `StatusBadge`, `Input`

### Testes (T068.2 + T068.3)

- **11 test files · 59/59 passing · coverage 86.66% lines**
- Setup jest+RTL no Expo SDK 52: `jest-expo` + `@testing-library/react-native`
- Mocks preventivos de libs nativas (F2.10 vai usar): `react-native-maps`, `expo-camera`, `expo-image-picker`, `expo-haptics`, `expo-location`, `expo-linking`

## Validações

| Check | Resultado |
|---|---|
| `pnpm typecheck` | ✅ OK |
| `pnpm lint` (`--max-warnings=0`) | ✅ OK · 0 violações |
| `pnpm test` | ✅ 59/59 passing · 11 suites |
| `pnpm test:coverage` | ✅ **86.66% lines** · 86.59% stmts · 75.71% branches |
| `pnpm build` (`expo export --platform web`) | ✅ 791KB JS, 1.18KB HTML, 11 assets |
| 100% coverage individual | Comprovante · DetalheEntrega · HomeMotorista · Button · StatusBadge · Card · Input |

## Artefatos visuais

### Screenshots (mobile 390×844, dark mode)

7 telas em `docs/pr/screenshots/`:

| # | Tela | Screenshot |
|---|---|---|
| 1 | Login | `1-login-dark.png` |
| 2 | OTP | `2-otp-dark.png` |
| 3 | HomeMotorista | `3-home-motorista-dark.png` |
| 4 | DetalheEntrega | `4-detalhe-entrega-dark.png` |
| 5 | MapaRota | `5-mapa-rota-dark.png` |
| 6 | Comprovante | `6-comprovante-dark.png` |
| 7 | PerfilMotorista | `7-perfil-motorista-dark.png` |

Screenshots light-mode + 14 PNGs originais (dark+light) em `/tmp/t068-mobile-screenshots/` para validação visual completa.

### GIF de fluxo

`docs/pr/f2-mobile-flow.gif` — Login → Home → Detalhe → Mapa (via preview mode que bypassa auth). Capturado via Playwright headless em Expo Web (390×844).

## Checklist validação manual (Guilherme)

Para validar localmente:

```bash
cd apps/scorpius-move-app
pnpm install
pnpm start --web --port 8081
# Abrir http://localhost:8081/?preview=screen=home
```

- [ ] **Login com WhatsApp (mock auth):** `http://localhost:8081/?preview=screen=login` → form com WhatsApp input
- [ ] **HomeMotorista lista 3 entregas mock:** `?preview=screen=home` → 3 cards (Mercado Central, Farmácia Paulista, Hospital Norte)
- [ ] **DetalheEntrega mostra dados + navega:** tap em qualquer card → tela com cliente/endereço/itens
- [ ] **MapaRota renderiza com map mock:** `?preview=screen=mapa` → OpenStreetMap tile + origem/destino + distância
- [ ] **Comprovante tira foto mock:** `?preview=screen=comprovante` → tap "Capturar foto" toggle visual
- [ ] **PerfilMotorista logout com confirmação:** `?preview=screen=perfil` → tap "Sair" → Alert com 2 botões
- [ ] **Preview mode bypassa auth:** qualquer `?preview=screen=NAME` mostra a tela sem precisar de OTP
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
- **Preview mode:** força uma tela específica via `?preview=screen=NAME` para screenshots/E2E. Em produção este caminho é no-op (params da URL não confiáveis).

## Pendências (próximos PRs)

- **T068.5 — F2.10 outbox foto:** ComprovanteScreen tira foto local, salva em SQLite, retenta sync para Spaces pre-signed URL quando online. Mesmo padrão do T069 Z-API (backoff exponencial + DLQ). Guilherme confirmou em 02:14: "foto local+outbox".
- **F2 Mobile features:** outbox foto · retry offline · push deep links · histórico de entregas.
- **Hub frontend paralelo:** F2.5/F2.6/F2.7 em `feature/f2-frontend-hardening` (já em produção, Guilherme validando).

## Review

- **@SentinelPellegriniBot:** QA + edge cases (offline, token expirado, upload falho)
- **@ScribePellegriniBot:** CHANGELOG + ADR mobile (decidir depois do review)
- **@VulcanPellegriniBot:** confirmar contrato `/driver/auth/otp` + `/driver/auth/me` + `/driver/deliveries` ainda bate com o que o app chama
