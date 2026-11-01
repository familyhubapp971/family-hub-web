/** @type {import('tailwindcss').Config} */
// Storybook (FHS-643) compiles Tailwind from this package, so it needs its own
// config. It extends the same shared preset the web site does, so the catalogue and
// the app cannot drift: never redeclare tokens here.
import preset from './tailwind.preset.js';

export default {
  presets: [preset],
  content: ['./src/**/*.{js,ts,jsx,tsx}', './.storybook/**/*.{js,ts,jsx,tsx}'],
};
