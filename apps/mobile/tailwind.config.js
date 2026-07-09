/** @type {import('tailwindcss').Config} */
module.exports = {
  // Only files listed here are scanned for class names — a missing path means
  // classes in that file silently produce no styles, which is the most common
  // NativeWind "why is nothing styled" pitfall.
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Semantic tokens for the figma palette (specs/002 research §6). Screens
      // say `bg-surface` / `bg-primary` — never hex literals — so a palette
      // change is a one-file edit and light/dark stay consistent.
      colors: {
        surface: '#F6F2FB', // lavender canvas behind auth + dashboard content
        'surface-card': '#FFFFFF',
        'surface-dim': '#EDE6F7',
        primary: '#6C4AB0', // plum — primary CTAs
        'primary-pressed': '#5A3D93',
        'on-primary': '#FFFFFF',
        header: '#191524', // dark dashboard/hero header (figma p3)
        'on-header': '#F6F2FB',
        'on-header-muted': '#B9AFD1',
        ink: '#221C33', // body text on light surfaces
        'ink-muted': '#6F6786',
        line: '#E3DBF0',
        danger: '#B3261E',
        'danger-surface': '#FBEDEC',
      },
    },
  },
  plugins: [],
};
