import type { Preview } from '@storybook/react-vite';
import './preview.css';

/**
 * These components are drawn for a kingdom-purple page, so that is the default
 * canvas: a white background would make correct components look broken. White
 * stays available for the pastel cards, which sit on light surfaces in-app.
 */
const preview: Preview = {
  parameters: {
    layout: 'centered',
    backgrounds: {
      options: {
        kingdom: { name: 'Kingdom', value: '#3d1065' },
        night: { name: 'Kingdom deep', value: '#2a0b46' },
        white: { name: 'White', value: '#ffffff' },
      },
    },
    controls: { matchers: { color: /(background|color)$/i } },
  },
  initialGlobals: {
    backgrounds: { value: 'kingdom' },
  },
};

export default preview;
