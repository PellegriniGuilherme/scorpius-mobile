/**
 * Entry point for Expo + Web.
 *
 * Usa registerRootComponent para registrar o App como componente raiz.
 * Cross-platform: funciona em iOS, Android e Web.
 *
 * Reactotron: primeiro import (imports são hoisted; require() rodaria tarde demais).
 */
import './src/lib/reactotron-setup';

import registerRootComponent from 'expo/src/launch/registerRootComponent';
import App from './App';

registerRootComponent(App);
