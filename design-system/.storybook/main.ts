import type { StorybookConfig } from '@storybook/react-vite';

/**
 * Storybook for the design system (FHS-643). It runs from this package so the
 * catalogue is built against the components themselves, not against a copy of
 * them inside the app.
 */
const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.tsx'],
  // The brand fonts are self-hosted, not fetched from Google (FHS-566): the
  // @font-face rules in src/styles/globals.css point at /fonts/*.woff2, which
  // ship inside the web app's public folder. Serving that folder here is what
  // stops every heading in the catalogue falling back to a system face and
  // misrepresenting the design.
  staticDirs: ['../../public'],
  // No anonymous usage pings from developer machines or CI.
  core: { disableTelemetry: true },
};

export default config;
