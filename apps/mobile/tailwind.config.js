/** @type {import('tailwindcss').Config} */
module.exports = {
  // Only files listed here are scanned for class names — a missing path means
  // classes in that file silently produce no styles, which is the most common
  // NativeWind "why is nothing styled" pitfall.
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {},
  },
  plugins: [],
};
