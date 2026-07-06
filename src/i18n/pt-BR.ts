/**
 * Scorpius Move — i18n (pt-BR).
 *
 * Apenas pt-BR no MVP (F2 Mobile Foundation). Quando o app precisar de
 * i18n dinâmico, refatorar para um sistema de dicionários com seletor
 * de locale (ex: i18next, expo-localization).
 */
export const ptBR = {
  app: {
    name: 'Scorpius Move',
    tagline: 'App do motorista',
  },
  login: {
    title: 'Entrar',
    description: 'Use seu WhatsApp cadastrado para receber o código de acesso.',
    whatsappLabel: 'WhatsApp',
    whatsappPlaceholder: '+55 (11) 99999-8888',
    submit: 'Enviar código',
    submitting: 'Enviando...',
    errorInvalidPhone: 'Informe um número de WhatsApp válido.',
    errorGeneric: 'Não foi possível enviar o código. Tente novamente.',
    // T122: gate check-phone retornou exists=false. Motorista NÃO se cadastra
    // via app — empresa precisa provisionar antes do login.
    errorAccessNotAllowed:
      'Acesso não liberado. Entre em contato com sua transportadora.',
  },
  otp: {
    title: 'Confirme o código',
    description: 'Enviamos um código de 6 dígitos para {phone}.',
    codeLabel: 'Código de 6 dígitos',
    submit: 'Confirmar',
    submitting: 'Confirmando...',
    resend: 'Reenviar código',
    resendIn: 'Reenviar em {seconds}s',
    // T101: countdown do OTP (TTL total). Format m:ss.
    expiresIn: 'Expira em {time}',
    expired: 'Código expirado. Toque em "Reenviar código".',
    errorInvalidCode: 'Código inválido ou expirado.',
    errorGeneric: 'Não foi possível confirmar. Tente novamente.',
  },
  dashboard: {
    title: 'Olá, {name}',
    welcome: 'Bem-vindo ao Scorpius Move',
    nextDeliveriesTitle: 'Próximas entregas',
    noDeliveries: 'Nenhuma entrega atribuída ainda.',
    logout: 'Sair',
  },
  home: {
    title: 'Minhas entregas',
    subtitle: 'Hoje',
    emptyTitle: 'Nenhuma entrega hoje',
    emptyDesc: 'Aproveite o descanso — você não tem entregas atribuídas para hoje.',
    filter: { all: 'Todas', pending: 'Pendentes', inRoute: 'Em rota', delivered: 'Entregues' },
  },
  detail: {
    title: 'Entrega #{code}',
    customerSection: 'Cliente',
    addressSection: 'Endereço',
    itemsSection: 'Itens ({count})',
    windowSection: 'Janela de entrega',
    openMap: 'Abrir mapa',
    collectProof: 'Coletar comprovante',
    statusPending: 'Pendente',
    statusInRoute: 'Em rota',
    statusDelivered: 'Entregue',
    statusFailed: 'Falhou',
  },
  map: {
    title: 'Rota até o destino',
    origin: 'Origem',
    destination: 'Destino',
    distance: '{km} km',
    duration: '{min} min',
    openExternal: 'Abrir no app de mapas',
    apiKeyMissing:
      'Google Maps não configurado. Defina EXPO_PUBLIC_GOOGLE_MAPS_API_KEY no .env e faça rebuild.',
  },
  proof: {
    title: 'Comprovante de entrega',
    photoLabel: 'Foto do pacote',
    signatureLabel: 'Assinatura do destinatário',
    capturePhoto: 'Capturar foto',
    captureSignature: 'Coletar assinatura',
    retakePhoto: 'Tirar novamente',
    submit: 'Confirmar entrega',
    successTitle: 'Entrega confirmada!',
    successDesc: 'Voltando para a lista de entregas…',
    placeholder: 'No Expo Web, captura real requer expo-camera.\nEm produção (iOS/Android), abre a câmera nativa.',
  },
  profile: {
    title: 'Meu perfil',
    statusLabel: 'Status',
    whatsappLabel: 'WhatsApp',
    memberSinceLabel: 'Motorista desde',
    deliveriesToday: 'Entregas hoje: {count}',
    logout: 'Sair',
    logoutConfirmTitle: 'Sair da conta?',
    logoutConfirmDesc: 'Você precisará fazer login novamente para acessar entregas.',
    cancel: 'Cancelar',
    confirm: 'Sair',
    versionLabel: 'Versão {version}',
  },
  common: {
    cancel: 'Cancelar',
    retry: 'Tentar novamente',
    back: 'Voltar',
    loading: 'Carregando...',
  },
} as const;

export type I18n = typeof ptBR;
