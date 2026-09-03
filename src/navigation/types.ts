export type AuthStackParamList = {
  Login: undefined;
  Otp: { phone: string };
};

export type AppStackParamList = {
  HomeMotorista: undefined;
  DetalheEntrega: { deliveryId: number; documentId?: number };
  MapaRota: { deliveryId: number };
  Comprovante: { deliveryId: number; documentId: number };
  Ocorrencia: { deliveryId: number };
  PerfilMotorista: undefined;
};
