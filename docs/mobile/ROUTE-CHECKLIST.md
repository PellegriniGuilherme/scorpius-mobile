# Move App — Route Checklist

Base URL produção: `https://api.hub.portalscorpiustecnologia.com.br/api/v1`

Auth driver: header `Authorization: Bearer {access_token}`

## Smoke (público)

| Rota | Método | Evidência |
|------|--------|-----------|
| `/healthcheck` (host root) | GET | `curl -s https://api.hub.portalscorpiustecnologia.com.br/healthcheck` |
| `/driver/check-phone?phone=` | GET | `{ "exists": true\|false }` |

## Auth

| Rota | Método | Mobile | Status |
|------|--------|--------|--------|
| `/driver/auth/otp` | POST | `api/auth.ts` → Login | ✅ |
| `/driver/auth/otp/confirm` | POST | `api/auth.ts` → Otp | ✅ |
| `/driver/auth/refresh` | POST | `api/client.ts` interceptor | ✅ |
| `/driver/auth/logout` | POST | `api/auth.ts` → logout | ✅ |
| `/driver/auth/me` | GET | `api/auth.ts` → bootstrap | ✅ |

## Entregas driver

| Rota | Método | Mobile | Status |
|------|--------|--------|--------|
| `/driver/deliveries` | GET | `api/deliveries.ts` → Home | ✅ |
| `/driver/deliveries/{id}` | GET | Detalhe/Mapa/Comprovante | ✅ |
| `/driver/deliveries/{id}/start` | POST | `deliveryActions.ts` | ✅ |
| `/driver/deliveries/{id}/pickup` | POST | `deliveryActions.ts` | ✅ |
| `/driver/deliveries/{id}/in-transit` | POST | `deliveryActions.ts` | ✅ |
| `/driver/deliveries/{id}/complete` | POST | `api/boot.ts` | ✅ |
| `/driver/deliveries/{id}/fail` | POST | `deliveryActions.ts` | ✅ |
| `/driver/deliveries/{id}/upload-url` | POST | `api/boot.ts` | ✅ |
| `/driver/deliveries/{id}/proof` | POST | `api/boot.ts` | ✅ |

## Proof upload (sequência)

1. `POST /driver/deliveries/{id}/upload-url` `{ document_type: proof_of_delivery, content_type: image/jpeg }`
2. `PUT {presigned_url}` binary JPEG
3. `POST /driver/deliveries/{id}/proof` `{ photo_url, signature_url? }`
4. `POST /driver/deliveries/{id}/complete` `{ notes? }`

Implementado em `src/api/boot.ts` + outbox `proof_upload`.

## Push

| Rota | Método | Mobile | Status |
|------|--------|--------|--------|
| `/driver/device-tokens` | POST | `RootNavigator` boot | ✅ |
| `/driver/device-tokens/{token}` | DELETE | logout | ✅ |

## Ocorrências

| Rota | Método | Mobile | Status |
|------|--------|--------|--------|
| `/driver/occurrence-types?active_only=1` | GET | `ReportarOcorrenciaScreen` | ✅ |
| `/sync/occurrences` | POST | outbox replay | ✅ |

## Sync offline (F7A)

| Rota | Método | Mobile | Status |
|------|--------|--------|--------|
| `/sync/events` | POST | `api/sync.ts` | ✅ |
| `/sync/occurrences` | POST | `api/sync.ts` | ✅ |
| `/sync/cursor` | GET | `api/sync.ts` | ✅ |
| `/sync/cursor/advance` | POST | `api/sync.ts` | ✅ |
| `/sync/conflicts` | GET | `api/sync.ts` | ✅ |

## Deep links

Scheme: `scorpiusmove://`

| Path | Tela |
|------|------|
| `home` | HomeMotorista |
| `delivery/:deliveryId` | DetalheEntrega |
| `delivery/:deliveryId/route` | MapaRota |
| `delivery/:deliveryId/proof` | Comprovante |
| `profile` | PerfilMotorista |
