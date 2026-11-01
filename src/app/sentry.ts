import * as Sentry from '@sentry/react';

// Empty DSN = silent no-op. All Sentry.* calls remain safe before the
// project is provisioned. Init from main.tsx BEFORE rendering React so
// the SDK can capture errors during the initial render pass.
//
// VITE_SENTRY_DSN_WEB is build-time-baked; rotate via the Sentry
// dashboard (DSNs are public-by-design but project-scoped) and rebuild.
//
// tenant_id placeholder: every event gets `tenant_id: null` for now.
// Sprint 1 wires the real value by calling Sentry.setTag('tenant_id', …)
// from a TenantProvider once tenant context lands client-side.
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN_WEB;
  if (!dsn) {
    // Quiet log: only matters for the dev who wired the build. Use
    // warn so the eslint no-console rule (which allows warn/error) is
    // happy without an inline disable.
    if (import.meta.env.DEV) console.warn('[sentry] VITE_SENTRY_DSN_WEB not set: Sentry disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    integrations: [Sentry.browserTracingIntegration()],
    sendDefaultPii: false,
    initialScope: {
      tags: {
        tenant_id: 'null', // placeholder: Sprint 1 sets per-render
        service: '@familyhub/web',
      },
    },
  });
}

export const ErrorBoundary = Sentry.ErrorBoundary;
