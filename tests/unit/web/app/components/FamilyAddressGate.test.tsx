import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

// FHS-715: an old surname address (/t/smith/...) forwards to the family's
// private code, but only for people in that family. Everyone else sees the
// page's usual not-found or sign-in, and a kid page goes to the code step.

const authState: { session: { access_token: string } | null; loading: boolean } = {
  session: { access_token: 'tok-1' },
  loading: false,
};
vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { FamilyAddressGate } from '../../../../../src/app/components/FamilyAddressGate';

const fetchMock = vi.fn();

function Where() {
  const loc = useLocation();
  return <span data-testid="where">{`${loc.pathname}${loc.search}${loc.hash}`}</span>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>
        <Route path="/t/:slug" element={<FamilyAddressGate />}>
          <Route path="kid-login" element={<p data-testid="page">faces</p>} />
          <Route path="members" element={<p data-testid="page">members</p>} />
          <Route path="child/:memberId" element={<p data-testid="page">child</p>} />
        </Route>
        <Route path="/login" element={<p data-testid="page">code step</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function reply(status: number, body: unknown = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  authState.session = { access_token: 'tok-1' };
  authState.loading = false;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('<FamilyAddressGate />', () => {
  it('a family code opens the page straight away, with no extra check', () => {
    renderAt('/t/e29b-41d4/members');
    expect(screen.getByTestId('page')).toHaveTextContent('members');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a code typed in capitals opens the same family', async () => {
    renderAt('/t/E29B-41D4/members');
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent('/t/e29b-41d4/members'),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a member opening an old surname address lands on the same page at the new code', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { slug: 'e29b-41d4', name: 'Smith' }));
    renderAt('/t/smith/child/kid-1?tab=money#top');
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent(
        '/t/e29b-41d4/child/kid-1?tab=money#top',
      ),
    );
    expect(screen.getByTestId('page')).toHaveTextContent('child');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/family-address/smith'),
      expect.objectContaining({ headers: { Authorization: 'Bearer tok-1' } }),
    );
  });

  it('someone outside the family sees the usual page, and the address stays as typed', async () => {
    fetchMock.mockResolvedValueOnce(reply(404));
    renderAt('/t/smith/members');
    await waitFor(() => expect(screen.getByTestId('page')).toHaveTextContent('members'));
    expect(screen.getByTestId('where')).toHaveTextContent('/t/smith/members');
  });

  it('no signal on the check shows the usual page rather than a dead end', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Load failed'));
    renderAt('/t/smith/members');
    await waitFor(() => expect(screen.getByTestId('page')).toHaveTextContent('members'));
  });

  it('someone not signed in gets the usual sign-in, with no check made', () => {
    authState.session = null;
    renderAt('/t/smith/members');
    expect(screen.getByTestId('page')).toHaveTextContent('members');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('waits for the sign-in to load before deciding', () => {
    authState.loading = true;
    renderAt('/t/smith/members');
    expect(screen.queryByTestId('page')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a kid page with an old surname goes to the family-code step, not the faces', async () => {
    renderAt('/t/smith/kid-login');
    await waitFor(() => expect(screen.getByTestId('page')).toHaveTextContent('code step'));
    expect(screen.getByTestId('where')).toHaveTextContent('/login?role=kid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a kid page with the family code shows the faces', () => {
    renderAt('/t/e29b-41d4/kid-login');
    expect(screen.getByTestId('page')).toHaveTextContent('faces');
  });
});
