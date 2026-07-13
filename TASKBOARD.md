# TASKBOARD — Nexus / scorpius-mobile

## Ativas

### API URL no APK → api.hub (sem staging)
- **Status:** `done`
- **Contexto:** APK preview/development apontava para `staging.hub`; falha rápida no "Enviar código". Pedido: usar só `api.hub`.
- **Feito:** `eas.json` — profiles `development` e `preview` com `EXPO_PUBLIC_API_URL=https://api.hub.portalscorpiustecnologia.com.br/api/v1` (igual production).
- **Pendente:** rebuild do APK (`eas build --profile preview --platform android`) para a URL entrar no bundle. Commit sob pedido.

## Concluídas
- (vazio)
