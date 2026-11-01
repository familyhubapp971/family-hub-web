import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  notifyDashboardStale,
  useDashboardStaleSignal,
} from '../../../../../src/app/lib/dashboard-refresh';

// FHS-309: the dashboard-stale signal that lets a task/notice mutation in
// one tab refresh the dashboard snapshot + header counts.

describe('dashboard-refresh signal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('notifyDashboardStale dispatches the fh:dashboard-stale event', () => {
    const spy = vi.fn();
    window.addEventListener('fh:dashboard-stale', spy);
    notifyDashboardStale();
    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener('fh:dashboard-stale', spy);
  });

  it('useDashboardStaleSignal runs the callback when the signal fires', () => {
    const cb = vi.fn();
    renderHook(() => useDashboardStaleSignal(cb));
    expect(cb).not.toHaveBeenCalled();
    notifyDashboardStale();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('useDashboardStaleSignal stops listening after unmount', () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() => useDashboardStaleSignal(cb));
    unmount();
    notifyDashboardStale();
    expect(cb).not.toHaveBeenCalled();
  });
});
