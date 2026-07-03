# Documentação para Agentes — Scorpius Move (App Mobile)

Guia de contexto para sessões de IA trabalhando neste repositório.

## Repositórios do ecossistema

| Repo | Path | Papel |
|------|------|-------|
| **API** | `/Users/ai-agent/agents/vulcan/scorpius` | Backend Laravel |
| **Hub** | `/Users/ai-agent/agents/nexus/scorpius` | Painel web |
| **Move (este)** | `/Users/ai-agent/agents/nexus/scorpius-mobile` | App motorista |

## Documentos

| Arquivo | Conteúdo |
|---------|----------|
| [MOVE.md](./MOVE.md) | Referência rápida: telas, API, outbox, testes |
| Outbox (detalhado) | `docs/mobile/outbox.md` |
| Mapa do sistema | `vulcan/scorpius/docs/agent/SYSTEM-MAP.md` |
| Lacunas | `vulcan/scorpius/docs/agent/GAPS.md` |

## Leitura ao iniciar sessão

1. `TASKBOARD.md` (se existir)
2. [MOVE.md](./MOVE.md)
3. `src/mocks/deliveries.ts` — **entregas ainda são mock**
4. Contratos driver em `vulcan/scorpius/routes/api.php` (prefix `driver/`)

## Comandos essenciais

```bash
npm install
npm start                  # Expo dev server
npm run dev:mobile         # expo start --tunnel (LAN)
npm test                   # Jest (~19 arquivos)
npm run test:coverage
npm run typecheck
npm run lint
```

## Preview mode (dev sem login)

```
?preview=login|otp|home|detalhe|mapa|comprovante|perfil
```

Implementado em `src/navigation/RootNavigator.tsx`.

## Regras do agente (Nexus)

- Frontend/mobile specialist
- Auth Hub (email/senha) **não pertence a este app**
- Pedir mudanças de API via Atlas
- Ao wire entregas reais: alinhar shape com `GET /driver/deliveries` no backend
