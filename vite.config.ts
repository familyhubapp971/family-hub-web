import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const webRoot = fileURLToPath(new URL('.', import.meta.url));

// One config for the web site: dev server, build, styling and unit tests.
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Source-map upload only fires when the full Sentry CI bundle is
  // present. Locally we still emit source maps (build.sourcemap: true)
  // for in-browser debugging: just don't upload them anywhere.
  const sentryAuth: string | undefined = env.SENTRY_AUTH_TOKEN;
  const sentryOrg: string | undefined = env.SENTRY_ORG;
  const sentryProject: string | undefined = env.SENTRY_PROJECT_WEB;

  const sentryPlugin =
    sentryAuth && sentryOrg && sentryProject
      ? sentryVitePlugin({
          org: sentryOrg,
          project: sentryProject,
          authToken: sentryAuth,
          ...(env.VITE_SENTRY_RELEASE ? { release: { name: env.VITE_SENTRY_RELEASE } } : {}),
          telemetry: false,
        })
      : null;

  // Unit tests (vitest runs with mode "test") live under <repo>/tests/unit/.
  // Pin their bare imports to the root node_modules, and alias the design
  // system at its source so vite's dep optimizer never serves a stale
  // snapshot of it (any new workspace package used by tests needs an alias
  // here too).
  const isTest = mode === 'test';

  return {
    plugins: [react(), ...(sentryPlugin ? [sentryPlugin] : [])],
    css: {
      postcss: { plugins: [tailwindcss(), autoprefixer()] },
    },
    ...(isTest
      ? {
          resolve: {
            alias: [
              {
                find: /^react-router-dom$/,
                replacement: `${webRoot}node_modules/react-router-dom`,
              },
              {
                find: /^@supabase\/supabase-js$/,
                replacement: `${webRoot}node_modules/@supabase/supabase-js`,
              },
              { find: /^@familyhub\/ui$/, replacement: `${webRoot}design-system/src/index.ts` },
            ],
          },
          optimizeDeps: { exclude: ['@familyhub/ui'] },
        }
      : {}),
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          // FHS-560: split the big third-party libraries out of the entry
          // chunk so the landing page does not pay for charting, mapping
          // and animation code it never renders. Route-level code splitting
          // (React.lazy in App.tsx) does the rest.
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts'],
            maps: ['leaflet', 'react-leaflet'],
            motion: ['framer-motion'],
            supabase: ['@supabase/supabase-js'],
          },
        },
      },
    },
    server: {
      port: 5273,
      strictPort: true,
      proxy: {
        // Forward /api/* to the Hono API during dev so the browser sees
        // a single origin and we don't need CORS yet.
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    preview: {
      port: 5273,
      strictPort: true,
    },
    test: {
      environment: 'jsdom',
      // setup.ts stays in src/app/test/ so it sits with the web site's code.
      setupFiles: ['./src/app/test/setup.ts'],
      include: ['tests/unit/{web,ui}/**/*.{test,spec}.{ts,tsx}'],
      passWithNoTests: true,
      globals: true,
      css: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        reportsDirectory: './coverage',
        include: ['src/**/*.{ts,tsx}', 'design-system/src/**/*.{ts,tsx}'],
        exclude: [
          '**/node_modules/**',
          '**/dist/**',
          '**/*.test.{ts,tsx}',
          '**/*.spec.{ts,tsx}',
          '**/*.d.ts',
          'vite.config.ts',
          'tailwind.config.js',
          'src/app/main.tsx',
          'src/app/test/**', // setup files, not logic
        ],
        all: true,
      },
    },
  };
});
