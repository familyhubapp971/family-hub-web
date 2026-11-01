/** @type {import('tailwindcss').Config} */
// Family Hub design tokens (fonts, neo shadows, kingdom colour, shake
// animation, xs breakpoint) live in the shared preset at
// @familyhub/ui/tailwind.preset.js so the web site and any future surface
// stay in lockstep. Never copy tokens here: extend the preset.
import preset from '@familyhub/ui/tailwind.preset.js';

export default {
  presets: [preset],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    // Scan the shared component library so its Tailwind classes get
    // emitted into the web site's bundle.
    './design-system/src/**/*.{js,ts,jsx,tsx}',
  ],
};
