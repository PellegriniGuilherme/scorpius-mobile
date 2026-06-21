/**
 * Scorpius Move — Navigation type registry.
 *
 * AuthStack: telas pré-login (Login → OTP).
 * AppStack: telas pós-login (Dashboard, futuras: deliveries, etc).
 * RootNavigator decide qual stack mostrar baseado em isAuthenticated.
 */
export type AuthStackParamList = {
  Login: undefined;
  Otp: { phone: string };
};

export type AppStackParamList = {
  Dashboard: undefined;
};
