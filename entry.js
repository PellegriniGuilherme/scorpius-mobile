/**
 * Entry point for Expo + Web.
 *
 * Usa registerRootComponent para registrar o App como componente raiz.
 * Cross-platform: funciona em iOS, Android e Web.
 */
import registerRootComponent from 'expo/src/launch/registerRootComponent';
import App from './App';

registerRootComponent(App);
