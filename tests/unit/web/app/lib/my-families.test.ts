import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// FHS-718: the saved list of the signed-in person's families. Asked for once
// per visit, given a time limit, and forgotten when they sign out.

import {
  FAMILY_CHECK_TIME_LIMIT_MS,
  fetchFamilyCodes,
  forgetFamilyCodes,
  knownFamilyCodes,
  rememberFamilyCodes,
} from '../../../../../src/app/lib/my-families';

const fetchMock = vi.fn();

function me(slugs: string[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ tenants: slugs.map((slug) => ({ slug })) }),
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  forgetFamilyCodes();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('my families (FHS-718)', () => {
  it('keeps the list after asking once', async () => {
    fetchMock.mockResolvedValue(me(['e29b-41d4', 'aaaa-1111']));
    expect(await fetchFamilyCodes('user-1', 'tok')).toEqual(['e29b-41d4', 'aaaa-1111']);
    expect(knownFamilyCodes('user-1')).toEqual(['e29b-41d4', 'aaaa-1111']);
  });

  it('two pages asking at once share one request', async () => {
    fetchMock.mockResolvedValue(me(['e29b-41d4']));
    await Promise.all([fetchFamilyCodes('user-1', 'tok'), fetchFamilyCodes('user-1', 'tok')]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('signing out and back in asks for a fresh list', async () => {
    fetchMock.mockResolvedValue(me(['e29b-41d4']));
    await fetchFamilyCodes('user-1', 'tok');
    forgetFamilyCodes();
    expect(knownFamilyCodes('user-1')).toBeNull();
    await fetchFamilyCodes('user-1', 'tok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a different person never gets the first person's list", async () => {
    fetchMock.mockResolvedValue(me(['e29b-41d4']));
    await fetchFamilyCodes('user-1', 'tok');
    expect(knownFamilyCodes('user-2')).toBeNull();
  });

  it('a sign-out while the list is on its way keeps nothing', async () => {
    let answer: (value: unknown) => void = () => {};
    fetchMock.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const asked = fetchFamilyCodes('user-1', 'tok');
    forgetFamilyCodes();
    answer(me(['e29b-41d4']));
    await asked;
    expect(knownFamilyCodes('user-1')).toBeNull();
  });

  it('gives up after 8 seconds and answers "could not tell"', async () => {
    vi.useFakeTimers();
    fetchMock.mockReturnValue(new Promise(() => {}));
    const asked = fetchFamilyCodes('user-1', 'tok');
    await vi.advanceTimersByTimeAsync(FAMILY_CHECK_TIME_LIMIT_MS);
    expect(await asked).toBeNull();
    expect(knownFamilyCodes('user-1')).toBeNull();
  });

  it('answers "could not tell" when the server fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    expect(await fetchFamilyCodes('user-1', 'tok')).toBeNull();
  });

  it('keeps a list the app already has, so nobody asks again', () => {
    rememberFamilyCodes('user-1', [{ slug: 'e29b-41d4' }, { name: 'no code' }]);
    expect(knownFamilyCodes('user-1')).toEqual(['e29b-41d4']);
  });
});
