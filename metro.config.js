// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

// extensiones extra para Drei, useGLTF, etc.
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'cjs',
  'mjs',
  'jsx',
];
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'glb',
  'gltf',
  'png',
  'jpg',
];

module.exports = config;
