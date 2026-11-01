import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { EnvironmentLock } from './components/EnvironmentLock';
import { ErrorBoundary, initSentry } from './sentry';
import 'leaflet/dist/leaflet.css';
import './index.css';

initSentry();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('missing #root element');

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary fallback={<p>Something went wrong. Refresh to try again.</p>}>
      {/* FHS-644: the passcode gate sits above the router, so there is one way
          in rather than one per route. On a deployed build nothing below this
          renders, or fetches, until the passcode is right. */}
      <EnvironmentLock>
        <App />
      </EnvironmentLock>
    </ErrorBoundary>
  </StrictMode>,
);
