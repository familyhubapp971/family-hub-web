import { createContext, useContext, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';

// FHS-249: tenant context for SPA routes.
//
// The tenant slug lives in the URL (`/t/:slug/...`) per ADR 0012. This
// context exposes that slug to any descendant component without each
// one re-reading useParams. <TenantProvider> reads :slug once at the
// top of every /t/:slug/* subtree, useTenantSlug() consumes it.

const TenantContext = createContext<string | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  return <TenantContext.Provider value={slug}>{children}</TenantContext.Provider>;
}

// Hook for components mounted under /t/:slug/*. Throws when used
// outside a TenantProvider so the "I forgot to wrap my route" mistake
// is loud during development rather than a silent undefined slug.
export function useTenantSlug(): string {
  const slug = useContext(TenantContext);
  if (!slug) {
    throw new Error(
      'useTenantSlug() called outside <TenantProvider>: wrap the route in /t/:slug/* before rendering this component.',
    );
  }
  return slug;
}

// Convenience for routes that may or may not have tenant context (e.g.
// shared layout components rendered both inside and outside /t/:slug).
// Returns undefined on the marketing routes.
export function useOptionalTenantSlug(): string | undefined {
  return useContext(TenantContext);
}
