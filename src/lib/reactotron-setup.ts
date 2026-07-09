/**
 * Bootstrap do Reactotron — deve ser o primeiro import do entry.js.
 * Import estático garante ordem antes do App (require() não funciona: imports são hoisted).
 */
if (__DEV__) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./reactotron');
}
