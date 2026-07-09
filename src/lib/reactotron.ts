/**
 * Scorpius Move — Reactotron (dev-only).
 *
 * Aba Network: plugin `useReactNative({ networking })`.
 */
import Reactotron from 'reactotron-react-native';

const reactotron = Reactotron.configure({
  name: 'Scorpius Move',
})
  .useReactNative({
    networking: {
      ignoreUrls: /symbolicate|logs\.reactotron|127\.0\.0\.1/,
    },
  })
  .connect();

declare global {
  interface Console {
    tron: typeof reactotron;
  }
}

console.tron = reactotron;

export default reactotron;
