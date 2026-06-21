module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      '@babel/preset-flow', // T068.2: para transpilar Flow types em @react-native/js-polyfills
      'babel-preset-expo',
    ],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
          },
        },
      ],
    ],
  };
};
