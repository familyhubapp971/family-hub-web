import { useEffect } from 'react';

// FHS-309: lightweight signal so a task (and, later, assignment/notice)
// mutation in one dashboard tab refreshes the Today snapshot + header
// counts without a manual page reload. A plain window event keeps the
// tabs fully decoupled: a mutating tab fires `notifyDashboardStale()`,
// and any mounted dashboard surface listening via
// `useDashboardStaleSignal` refetches. (Tabs that aren't currently
// mounted refetch on their next mount anyway.)
const DASHBOARD_STALE_EVENT = 'fh:dashboard-stale';

export function notifyDashboardStale(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(DASHBOARD_STALE_EVENT));
  }
}

export function useDashboardStaleSignal(onStale: () => void): void {
  useEffect(() => {
    const handler = () => onStale();
    window.addEventListener(DASHBOARD_STALE_EVENT, handler);
    return () => window.removeEventListener(DASHBOARD_STALE_EVENT, handler);
  }, [onStale]);
}
