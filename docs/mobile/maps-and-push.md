# Maps & Push Notifications — Scorpius Move (T080)

> **Status:** implementado. `MapaRotaScreen` usa Google Maps real via `react-native-maps` + `PROVIDER_GOOGLE`. `NotificationsService` usa Expo Push via `expo-notifications`.

## Decisões (Guilherme 12:06)

- **Mapa:** Google Maps (NÃO OpenStreetMap, NÃO Mapbox)
- **Push:** Expo Push (NÃO polling HTTP, NÃO Reverb)

## ⚠️ API Key Rotation (T091 R1)

A Google Maps API key `AIzaSy…74ZU` vazou no git history em
`524e707` (corrigido em `40559d2` com placeholder). Por
segurança, recomenda-se rotacionar a key no Google Cloud Console
e atualizar `.env` + `app.config.ts` (KEY_IOS + KEY_ANDROID).

Procedimento:

1. Google Cloud Console → APIs & Services → Credentials
2. Delete `AIzaSy…74ZU` (e suas variantes iOS/Android)
3. Create new API key + restrict by bundleId `com.scorpius.move`
   - iOS: `bundleId = com.scorpius.move`
   - Android: SHA-1 do signing key (gerado por `expo credentials:manager`)
4. Update `.env`:
   - `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=<nova>`
   - `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS=<nova_ios>` (se diferente)
   - `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID=<nova_android>` (se diferente)
5. Commit separado: `chore(move-app): rotate google maps api key (security)`
6. (Opcional) Force push / git history rewrite se a chave é muito
   sensível — decisão de Guilherme.

**Risco se não rotacionar:** qualquer pessoa com acesso ao repo
pode usar a chave até Guilherme revogar no Console. Como `EXPO_PUBLIC_*`
vai no bundle JS de qualquer jeito, isso não é um vazamento "secreto"
— mas restringir por bundleId já é defesa em profundidade.

**Por que já não está restrita por bundleId:** a chave original foi
criada em outro projeto (mdt-expo) com bundleIds diferentes. Quando
T082 criou o bundleId `com.scorpius.move` em `app.config.ts`, a
restrição antiga não bate. Se tentar usar a chave antiga em
com.scorpius.move, vai dar "API key not authorized" no device
real. Rotação + nova restrição corrigem.

## Google Maps Setup

## Google Maps Setup

### API Key (onde conseguir)

1. https://console.cloud.google.com/google/maps-apis/credentials
2. Criar projeto (ou usar existente)
3. Ativar APIs:
   - Maps SDK for iOS
   - Maps SDK for Android
   - Maps JavaScript API (Expo Web fallback)
4. Criar API Key e **restringir** por:
   - **iOS:** `bundleId` = `local.scorpius.move` (em produção é o da App Store)
   - **Android:** `SHA-1 fingerprint` do signing key (debug ou release)
5. Copiar chave para `.env`:

```bash
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
```

### Como o app lê a chave

`app.config.ts` injeta em `extra.googleMapsApiKey`. `MapaRotaScreen` lê via `Constants.expoConfig.extra.googleMapsApiKey` em runtime. **Sem a chave, o mapa mostra aviso e fallback visual** (UX não quebra — motorista vê coordenadas e pode usar botão "Abrir no Google Maps" que abre o app nativo).

### Expo Web + Google Maps

Expo Web renderiza `MapView` (via `react-native-web` + Google Maps JS API). Funciona com a mesma API key. Para produção nativa, configurar `ios.config.googleMapsApiKey` e `android.config.googleMaps.apiKey` em `eas.json` por build profile.

## Expo Push Notifications

### Fluxo

```
1. App boot
   └─ NotificationsService.registerForPushNotificationsAsync()
        ├─ expo-device.isDevice (skip se web/emulador)
        ├─ Notifications.getPermissionsAsync / requestPermissionsAsync
        └─ Notifications.getExpoPushTokenAsync({ projectId })

2. Login success
   └─ apiClient.POST /api/v1/driver/device-tokens
        Body: { driver_id, expo_push_token, device_type: 'ios'|'android' }

3. Backend Laravel dispara push
   └─ POST https://exp.host/--/api/v2/push/send
        Body: { to: 'ExponentPushToken[xxx]', title, body, data: { delivery_id: 1234 } }

4. App recebe
   ├─ Foreground: addNotificationReceivedListener (mostra in-app)
   └─ Tap: addNotificationResponseReceivedListener
            └─ deep link via data.delivery_id → DetalheEntregaScreen
```

### EAS Project ID (obrigatório)

```bash
EXPO_PUBLIC_EAS_PROJECT_ID=127738c2-7b5a-435c-b4c5-249cc3026497
```

Configurado em:
- `.env` (template em `.env.example`)
- `app.config.ts` em `extra.eas.projectId`
- `NotificationsService` passa para `getExpoPushTokenAsync({ projectId })`

### Expo Push endpoint

- **URL:** `https://exp.host/--/api/v2/push/send`
- **Volume baixo** (<1k/dia): sem `EXPO_ACCESS_TOKEN` — Guilherme não precisa gerar agora
- **Volume alto:** Guilherme gera token em `expo.dev → Project → Credentials → Access Token`

Backend Laravel (`apps/scorpius-hub-api`) é quem dispara push usando tokens armazenados em `driver_device_tokens` (migration T072 já merged).

### Permissions iOS/Android

`app.config.ts` já configura:
- **iOS:** `NSUserNotificationsUsageDescription`, `NSLocationWhenInUseUsageDescription`
- **Android:** `POST_NOTIFICATIONS`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`

Plugin `expo-notifications` adicionado para configurar icon/color do badge.

## Endpoints backend (já merged em main)

### POST `/api/v1/driver/device-tokens`
Request:
```json
{
  "driver_id": 91,
  "expo_push_token": "ExponentPushToken[xxx]",
  "device_type": "ios"
}
```
Response 200:
```json
{ "id": 1234, "driver_id": 91, "expo_push_token": "ExponentPushToken[xxx]" }
```

Migration T072: `driver_device_tokens(id, driver_id, expo_push_token, device_type, last_seen_at)`.

## Testes (T080)

- `MapaRotaScreen.test.tsx` (6 testes): render com/sem API key, fallback, Linking, distance/duration
- `NotificationsService.test.ts` (12 testes): register (com/sem permissão), handlers (foreground/response), deep linking, registerTokenWithBackend, stop

Total: **95/95 testes passing** (14 suites).

## Validações finais T080

```
typecheck OK · lint OK (--max-warnings=0) · 95 testes · build OK
coverage 88.26% stmts / 89.21% lines
```

## Pendências (próximos PRs)

- **EAS Build profile** (`eas.json` por build): definir dev/preview/production com chaves separadas
- **Background fetch** (`expo-task-manager` + `expo-notifications.registerTaskAsync`): processar push em background
- **Rich notifications** (imagem + ação): Guilherme decidir se quer
- **Push grouping**: agrupar múltiplas deliveries em 1 notificação (Android only)
- **Silent push** (atualização de estado sem alert): para sync de status
- **Backend broadcasting** (`mania_ads/.env` pattern): usar `EXPO_BROADCAST_CHUNK_SIZE=95` + `EXPO_BROADCAST_USLEEP_MICROSECONDS=200000` quando Laravel precisar enviar para >95 tokens de uma vez

## Referências

- [Expo Push docs](https://docs.expo.dev/push-notifications/overview/)
- [Google Maps React Native](https://github.com/react-native-maps/react-native-maps)
- [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/)
- [Apple Push Notification Service (APNs)](https://developer.apple.com/documentation/usernotifications)
- [Firebase Cloud Messaging (FCM)](https://firebase.google.com/docs/cloud-messaging)
