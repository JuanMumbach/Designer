// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      'babel-preset-expo',
      ['@babel/preset-react', { runtime: 'automatic' }],
      '@babel/preset-flow',
    ],
    // 👇 Forzamos transpilación de expo-router y expo para que JSX no llegue crudo
    overrides: [
      {
        test: /node_modules[\\/]expo-router[\\/].*\.(js|jsx|ts|tsx)$/,
        presets: [['@babel/preset-react', { runtime: 'automatic' }]],
      },
      {
        test: /node_modules[\\/]expo[\\/].*\.(js|jsx|ts|tsx)$/,
        presets: [['@babel/preset-react', { runtime: 'automatic' }]],
      },
    ],
  };
};
