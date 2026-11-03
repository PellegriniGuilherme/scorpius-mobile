# Scorpius Move — App do Motorista (`scorpius-mobile`)

Aplicativo mobile (**React Native + Expo SDK 52**) voltado aos motoristas parceiros da plataforma **Scorpius Hub**, com suporte a operação **offline-first** (SQLite + fila de sincronização), rastreamento GPS em background, captura de comprovantes de entrega (POD) / assinaturas e autenticação rápida via OTP no WhatsApp.

---

## 1. Stack Tecnológica

- **Expo SDK 52** + **React Native 0.76** + **TypeScript 5 (strict)**
- **React Navigation v7** (Native Stack + Bottom Tabs)
- **Zustand** — Stores reativos para autenticação (`authStore`), entregas (`deliveriesStore`), sincronização (`syncStore`) e conectividade (`networkStore`)
- **Expo SQLite + Drizzle ORM** (`src/db/`) — Banco de dados local embarcado no dispositivo para operação offline-first (`deliveries`, `delivery_documents`, `occurrences`, `sync_queue`, `telemetry_queue`)
- **Expo Location + TaskManager** (`src/services/locationTask.ts`) — Coleta de telemetria GPS em primeiro e segundo plano (background location) com envio em lote para o ClickHouse via API
- **Expo Notifications** (`src/services/notifications.ts`) — Registro de `expo_push_token` para avisos imediatos de novas entregas atribuídas
- **Expo ImagePicker & S3 Presigned Upload** — Captura de fotos de comprovante de entrega / avarias e envio direto para o DigitalOcean Spaces
- **Jest + Testing Library** — Testes automatizados de fluxos de sincronização, API e componentes

---

## 2. Mapeamento das Telas e O Que Ocorre no App

### 2.1. Autenticação via WhatsApp OTP (`src/screens/LoginWhatsappScreen.tsx`, `OtpScreen.tsx`)
1. **Login por WhatsApp (`LoginWhatsappScreen`)**:
   - O motorista informa seu número de celular com DDD.
   - O app chama `POST /api/v1/driver/auth/otp` (`src/api/auth.ts`), que dispara um código de 6 dígitos via WhatsApp (Meta Cloud API / Z-API).
2. **Confirmação de Código (`OtpScreen`)**:
   - O motorista digita os 6 dígitos (ou solicita **Reenviar código** diretamente na tela, respeitando o cooldown do servidor).
   - O app chama `POST /api/v1/driver/auth/otp/confirm` enviando o `device_uuid`, modelo do aparelho e `expo_push_token`.
   - O token Sanctum vinculado ao dispositivo é salvo de forma segura no `Expo SecureStore` e a sincronização inicial é iniciada.

### 2.2. Lista de Entregas e Resumo do Dia (`src/screens/HomeEntregasScreen.tsx`)
- Exibe as entregas atribuídas ao motorista (`assigned`, `in_transit`, `delivered`, `failed`), priorizando entregas em andamento.
- Indicador visual de conectividade (`Online` / `Offline`) e contador de mutações pendentes na fila de sincronização (`syncStore`).
- Pull-to-refresh que sincroniza entregas da API (`GET /api/v1/driver/deliveries`) com o banco SQLite local.

### 2.3. Detalhe da Entrega e Progressão de Status (`src/screens/DetalheEntregaScreen.tsx`)
- Exibe endereço completo, destinatário, observações, rota no mapa e lista de **documentos fiscais** (NF-e / CT-e) vinculados à entrega.
- **Botão de Ação Principal Progressivo**:
  - Quando `assigned`: permite **Iniciar Coleta (`pickup`)** (`POST /api/v1/driver/deliveries/{id}/pickup`) com captura automática de coordenadas GPS.
  - Quando coletada: permite **Iniciar Trânsito (`in-transit`)** (`POST /api/v1/driver/deliveries/{id}/in-transit`).
  - Quando `in_transit`: permite **Confirmar Entrega (`deliver`)** de cada documento fiscal ou da entrega completa, ou **Registrar Ocorrência**.
- Se o motorista estiver sem sinal de internet, as transições são gravadas localmente no SQLite (`sync_queue`) e enviadas automaticamente assim que a conexão retorna.

### 2.4. Comprovante de Entrega / POD (`src/screens/ConfirmarEntregaScreen.tsx`)
- Permite capturar a foto do canhoto/comprovante assinado e dados do recebedor (nome e documento).
- Solicita URL pré-assinada (`POST /api/v1/driver/documents/upload-url`), faz upload binário para o DigitalOcean Spaces e conclui o documento/entrega (`POST /api/v1/driver/deliveries/{id}/documents/{docId}/deliver` ou `POST /api/v1/driver/deliveries/{id}/deliver`).

### 2.5. Registro de Ocorrências em Campo (`src/screens/RegistrarOcorrenciaScreen.tsx`)
- Carrega o catálogo de tipos de ocorrência da empresa (`GET /api/v1/driver/occurrence-types`), permitindo selecionar se a ocorrência afeta a **entrega inteira** ou um **documento específico**.
- Permite anexar fotos de evidência (ex.: local fechado, avaria na caixa), observações e localização GPS atual, enviando para `POST /api/v1/driver/deliveries/{id}/occurrences` (ou enfileirando via `POST /api/v1/sync/occurrences` quando offline).

### 2.6. Sincronização Offline e Perfil (`src/screens/SyncStatusScreen.tsx`, `PerfilMotoristaScreen.tsx`)
- **Status de Sincronização (`SyncStatusScreen`)**: Mostra os itens na fila local (`sync_queue`), último cursor sincronizado (`GET /api/v1/sync/cursor`), eventuais conflitos detectados pelo servidor e botão para forçar sincronização manual.
- **Perfil do Motorista (`PerfilMotoristaScreen`)**: Exibe dados do motorista, status do rastreamento GPS, versão do app e botão de **Sair da Conta**, que revoga o token do dispositivo no servidor (`POST /api/v1/driver/auth/logout`) e limpa o armazenamento seguro local.

---

## 3. Configuração e Comandos de Desenvolvimento

### 3.1. Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto (ou configure em `app.json` / EAS):
```env
EXPO_PUBLIC_API_URL=https://api.hub.portalscorpiustecnologia.com.br/api/v1
```

### 3.2. Comandos Principais
```bash
# Instalar dependências
pnpm install

# Iniciar o bundler Expo
pnpm start

# Executar no Android / iOS
pnpm android
pnpm ios

# Qualidade de código: Testes (Jest), Lint (ESLint) e Typecheck (TypeScript)
pnpm test
pnpm run lint
pnpm run typecheck
```
