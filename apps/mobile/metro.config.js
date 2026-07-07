const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// `withNativeWind` teaches Metro to run the CSS file through Tailwind's
// compiler and inject the results, so utility classes resolve on-device
// without a separate build step.
const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './src/global.css' });
