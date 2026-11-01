import { useEffect, useState } from 'react';
import { helloResponseSchema, type HelloResponse } from '@familyhub/shared';
import { Button, Card, Badge } from '@familyhub/ui';
import { Link } from 'react-router-dom';
import { useAuth } from '../../app/lib/auth-context';
import { API_BASE } from '../../app/lib/api';

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: HelloResponse }
  | { status: 'error'; message: string };

async function fetchHello(signal: AbortSignal): Promise<HelloResponse> {
  // The hello / health endpoints are mounted at the root of the API
  // (`/hello`, `/health`), not under `/api/`. Feature endpoints live
  // under `/api/*` (see family-hub-api/src/app.ts).
  const response = await fetch(`${API_BASE}/hello`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`/hello returned ${response.status}`);
  }
  const data: unknown = await response.json();
  const parsed = helloResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error('invalid /hello response shape');
  }
  return parsed.data;
}

export function LandingPage() {
  const [state, setState] = useState<FetchState>({ status: 'idle' });
  const { session } = useAuth();

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    fetchHello(ctrl.signal)
      .then((data) => setState({ status: 'success', data }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: 'error', message });
      });
    return () => ctrl.abort();
  }, []);

  return (
    <main className="flex min-h-full items-center justify-center px-4 py-10">
      <Card className="w-full max-w-xl border-4 border-white p-8 text-gray-900 shadow-neo-lg">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-4xl text-kingdom-bg">Family Hub</h1>
          <Badge variant="info">FHS-199</Badge>
        </div>
        <p className="mt-2 font-body text-sm text-gray-600">
          SaaS scaffold · proving the end-to-end pipe with the ported design system.
        </p>

        <Card className="mt-6 border-2 border-black p-4 shadow-neo-sm">
          <h2 className="font-display text-lg">/hello response</h2>
          <StateView state={state} />
        </Card>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            testId="refetch"
            onClick={() => window.location.reload()}
            variant="primary"
            size="sm"
          >
            Refetch
          </Button>
          {session ? (
            <Link to="/dashboard">
              <Button variant="secondary" size="sm">
                Dashboard
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/login">
                <Button variant="secondary" size="sm">
                  Log in
                </Button>
              </Link>
              <Link to="/signup">
                <Button variant="success" size="sm">
                  Sign up
                </Button>
              </Link>
            </>
          )}
        </div>
      </Card>
    </main>
  );
}

function StateView({ state }: { state: FetchState }) {
  if (state.status === 'idle' || state.status === 'loading') {
    return <p className="mt-2 font-body text-gray-600">Fetching…</p>;
  }
  if (state.status === 'error') {
    return (
      <p className="mt-2 font-body text-red-600" data-testid="hello-error">
        Error: {state.message}
      </p>
    );
  }
  return (
    <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 font-body text-sm">
      <dt className="font-semibold">message</dt>
      <dd data-testid="hello-message">{state.data.message}</dd>
      <dt className="font-semibold">timestamp</dt>
      <dd data-testid="hello-timestamp">{state.data.timestamp}</dd>
    </dl>
  );
}
