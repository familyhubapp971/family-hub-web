// FHS-644: the passcode gate. These lock the four things the ticket asks for:
// nothing shows without the code, the right code lets you in and keeps you in,
// a wrong code is refused, and half an hour of nothing shuts it again.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { EnvironmentLock } from '../../../../../src/app/components/EnvironmentLock';
import { IDLE_LIMIT_MS, STORAGE_KEY } from '../../../../../src/app/lib/environment-lock';

const SECRET = 'Hub contents';

function renderLocked() {
  return render(
    <EnvironmentLock>
      <p>{SECRET}</p>
    </EnvironmentLock>,
  );
}

const lockScreen = () => screen.queryByTestId('environment-lock');
const contents = () => screen.queryByText(SECRET);
const cells = () => screen.getAllByRole('textbox');

/** Type a code across the four cells, the way a visitor fills them in. */
function typeCode(code: string) {
  const inputs = cells();
  for (const [index, char] of [...code].entries()) {
    fireEvent.change(inputs[index]!, { target: { value: char } });
  }
}

/** Arm the gate the way a deployed build does: a production bundle. */
function arm() {
  vi.stubEnv('PROD', true);
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('when the gate is not armed', () => {
  it('renders the app untouched, so development and CI are never gated', () => {
    vi.stubEnv('PROD', false);
    renderLocked();

    expect(contents()).toBeInTheDocument();
    expect(lockScreen()).not.toBeInTheDocument();
  });

  it('stands down on a deployed build when VITE_ENV_LOCK is off', () => {
    arm();
    vi.stubEnv('VITE_ENV_LOCK', 'off');
    renderLocked();

    expect(contents()).toBeInTheDocument();
  });
});

describe('a visitor without the passcode', () => {
  beforeEach(arm);

  it('sees the lock screen and nothing of the product behind it', () => {
    renderLocked();

    expect(lockScreen()).toBeInTheDocument();
    expect(contents()).not.toBeInTheDocument();
  });

  it('gets four cells, focus already in the first, and a labelled group', () => {
    renderLocked();

    expect(cells()).toHaveLength(4);
    expect(cells()[0]).toHaveFocus();
    expect(screen.getByRole('group', { name: 'Passcode' })).toBeInTheDocument();
  });

  it('names the screen as a landmark for a screen reader', () => {
    renderLocked();
    expect(screen.getByRole('main', { name: 'Locked' })).toBeInTheDocument();
  });
});

describe('entering the passcode', () => {
  beforeEach(arm);

  it('opens the site', () => {
    renderLocked();
    typeCode('2FH3');

    expect(contents()).toBeInTheDocument();
    expect(lockScreen()).not.toBeInTheDocument();
  });

  it('opens the site when typed in lower case', () => {
    renderLocked();
    typeCode('2fh3');

    expect(contents()).toBeInTheDocument();
  });

  it('drops characters the code cannot contain rather than jamming a cell', () => {
    renderLocked();
    fireEvent.change(cells()[0]!, { target: { value: '-' } });

    expect(cells()[0]).toHaveValue('');
  });

  it('remembers, so a refresh or a second tab does not ask again', () => {
    renderLocked();
    typeCode('2FH3');

    expect(Number(window.localStorage.getItem(STORAGE_KEY))).toBeGreaterThan(0);
  });
});

describe('a wrong passcode', () => {
  beforeEach(arm);

  it('is refused and the site stays hidden', () => {
    renderLocked();
    typeCode('ABCD');

    expect(lockScreen()).toBeInTheDocument();
    expect(contents()).not.toBeInTheDocument();
  });

  it('says so, out loud', () => {
    renderLocked();
    typeCode('ABCD');

    expect(screen.getByRole('alert')).toHaveTextContent('That passcode is not right');
  });

  it('clears the cells so the next try starts from empty', () => {
    renderLocked();
    typeCode('ABCD');

    expect(cells().map((cell) => (cell as HTMLInputElement).value)).toEqual(['', '', '', '']);
  });

  it('lets the next try through', () => {
    renderLocked();
    typeCode('ABCD');
    typeCode('2FH3');

    expect(contents()).toBeInTheDocument();
  });

  it('takes the message away as soon as they start typing again', () => {
    renderLocked();
    typeCode('ABCD');
    fireEvent.change(cells()[0]!, { target: { value: '2' } });

    expect(screen.getByRole('alert')).toHaveTextContent('');
  });

  it('does not leave a stamp behind that would let anyone in', () => {
    renderLocked();
    typeCode('ABCD');

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('coming back later', () => {
  beforeEach(arm);

  it('goes straight in when the last visit was recent', () => {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now() - 60_000));
    renderLocked();

    expect(contents()).toBeInTheDocument();
  });

  it('asks again when the last visit was over the limit', () => {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now() - IDLE_LIMIT_MS - 1));
    renderLocked();

    expect(lockScreen()).toBeInTheDocument();
  });

  it('asks again when the stored stamp is nonsense', () => {
    window.localStorage.setItem(STORAGE_KEY, 'let-me-in');
    renderLocked();

    expect(lockScreen()).toBeInTheDocument();
  });
});

describe('sitting untouched', () => {
  beforeEach(() => {
    arm();
    vi.useFakeTimers();
  });

  function unlock() {
    renderLocked();
    typeCode('2FH3');
    expect(contents()).toBeInTheDocument();
  }

  const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

  it('locks again after thirty minutes of nothing', () => {
    unlock();

    wait(IDLE_LIMIT_MS + 1_000);

    expect(lockScreen()).toBeInTheDocument();
    expect(contents()).not.toBeInTheDocument();
  });

  it('stays open right up to the limit', () => {
    unlock();

    wait(IDLE_LIMIT_MS - 60_000);

    expect(contents()).toBeInTheDocument();
  });

  it('starts the clock again on any sign of life', () => {
    unlock();

    wait(IDLE_LIMIT_MS - 60_000);
    act(() => void fireEvent.keyDown(window, { key: 'a' }));
    wait(IDLE_LIMIT_MS - 60_000);

    // Nearly an hour has passed, but never a full window without activity.
    expect(contents()).toBeInTheDocument();
  });

  it('counts scrolling as being here, not just clicking', () => {
    unlock();

    wait(IDLE_LIMIT_MS - 60_000);
    act(() => void fireEvent.scroll(window));
    wait(IDLE_LIMIT_MS - 60_000);

    expect(contents()).toBeInTheDocument();
  });

  it('forgets the stamp when it locks, so a refresh does not walk back in', () => {
    unlock();

    wait(IDLE_LIMIT_MS + 1_000);

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('asks for the passcode again, and takes it', () => {
    unlock();
    wait(IDLE_LIMIT_MS + 1_000);

    typeCode('2FH3');

    expect(contents()).toBeInTheDocument();
  });

  it('catches a machine that was asleep, the moment the tab is looked at', () => {
    unlock();

    // A sleeping laptop runs no timers, so nothing swept while it was shut.
    // Move the clock without letting the interval fire.
    vi.setSystemTime(Date.now() + IDLE_LIMIT_MS + 60_000);
    act(() => void fireEvent(document, new Event('visibilitychange')));

    expect(lockScreen()).toBeInTheDocument();
  });
});
