export type AuthStackParamList = {
  Login: undefined;
  /**
   * T101: `expiresIn` (segundos até OTP expirar) é opcional. LoginScreen
   * passa do response de `/auth/otp` (T101 backend já retorna). Default
   * 300 (5min) se não vier.
   */
  Otp: { phone: string; expiresIn?: number };
};

export type AppStackParamList = {
  HomeMotorista: undefined;
  DetalheEntrega: { deliveryId: number };
  MapaRota: { deliveryId: number };
  Comprovante: { deliveryId: number };
  ReportarOcorrencia: { deliveryId: number };
  PerfilMotorista: undefined;
};
