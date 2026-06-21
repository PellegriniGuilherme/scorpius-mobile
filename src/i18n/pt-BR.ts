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
    whatsappPlaceholder: '(11) 99999-8888',
    submit: 'Enviar código',
    submitting: 'Enviando...',
    errorInvalidPhone: 'Informe um número de WhatsApp válido.',
    errorGeneric: 'Não foi possível enviar o código. Tente novamente.',
  },
  otp: {
    title: 'Confirme o código',
    description: 'Enviamos um código de 6 dígitos para {phone}.',
    codeLabel: 'Código de 6 dígitos',
    submit: 'Confirmar',
    submitting: 'Confirmando...',
    resend: 'Reenviar código',
    resendIn: 'Reenviar em {seconds}s',
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
  common: {
    cancel: 'Cancelar',
    retry: 'Tentar novamente',
    back: 'Voltar',
    loading: 'Carregando...',
  },
} as const;

export type I18n = typeof ptBR;
