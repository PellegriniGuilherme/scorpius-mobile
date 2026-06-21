export type AuthStackParamList = {
  Login: undefined;
  Otp: { phone: string };
};

export type AppStackParamList = {
  HomeMotorista: undefined;
  DetalheEntrega: { deliveryId: number };
  MapaRota: { deliveryId: number };
  Comprovante: { deliveryId: number };
  PerfilMotorista: undefined;
};
