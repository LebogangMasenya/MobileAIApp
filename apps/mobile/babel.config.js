// NativeWind hooks into Babel at two points:
//  1. `jsxImportSource: "nativewind"` swaps React's JSX runtime for NativeWind's,
//     which is what lets `className` work on native components at all.
//  2. The `nativewind/babel` preset compiles Tailwind classes at build time so
//     styling adds zero runtime cost on the JS thread (Constitution: Performance First).
// Reanimated's worklet plugin is injected automatically by `babel-preset-expo`
// on SDK 50+, so it must NOT be added manually here (doing so double-registers it).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
