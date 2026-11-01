import { useEffect, useState } from 'react';
import { Card } from '@familyhub/ui';
import { z } from 'zod';
import { apiFetch, ApiError } from '../../app/lib/api';

// FHS-195: frontend /me route.
//
// Hits GET /api/me with the current Supabase access token, displays
// "Hello, {email}". Mounted under <ProtectedRoute>, so we know there's
// a session by the time this renders. The API call still fails-open
// gracefully (renders a clear error) for the rare case where the token
// has expired between the route guard and the fetch.

const meSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
});

type Me = z.infer<typeof meSchema>;

type State = { kind: 'loading' } | { kind: 'ready'; me: Me } | { kind: 'error'; message: string };

export function MePage() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    void apiFetch<unknown>('/api/me')
      .then((raw) => {
        if (!active) return;
        const parsed = meSchema.safeParse(raw);
        if (!parsed.success) {
          setState({ kind: 'error', message: 'unexpected /api/me response shape' });
          return;
        }
        setState({ kind: 'ready', me: parsed.data });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message =
          err instanceof ApiError
            ? `/api/me → ${err.status}`
            : err instanceof Error
              ? err.message
              : 'unknown error';
        setState({ kind: 'error', message });
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex min-h-full items-center justify-center px-4 py-10">
      <Card className="w-full max-w-xl border-4 border-white p-8 text-gray-900 shadow-neo-lg">
        {state.kind === 'loading' ? (
          <p className="font-body text-sm text-gray-600" data-testid="me-loading">
            Loading…
          </p>
        ) : state.kind === 'error' ? (
          <p
            className="font-body text-sm text-red-600"
            data-testid="me-error"
          >{`Couldn't load /api/me: ${state.message}`}</p>
        ) : (
          <>
            <h1
              className="font-display text-4xl text-kingdom-bg"
              data-testid="me-greeting"
            >{`Hello, ${state.me.email}`}</h1>
            <Card className="mt-6 border-2 border-black p-4 shadow-neo-sm">
              <h2 className="font-display text-lg">From the mirror</h2>
              <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 font-body text-sm">
                <dt className="font-semibold">User ID</dt>
                <dd className="break-all font-mono text-xs" data-testid="me-id">
                  {state.me.id}
                </dd>
                <dt className="font-semibold">Created</dt>
                <dd data-testid="me-created-at">{state.me.createdAt}</dd>
              </dl>
            </Card>
          </>
        )}
      </Card>
    </main>
  );
}
