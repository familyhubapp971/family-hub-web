import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProfilePill } from '../../../../../src/app/layout/AppHeader';

// FHS-625: a door only appears if the person can use what is behind it.
//
// The rule, and why: an adult may move a child's money and set a kid's PIN
// (the server's canManage tier), so they keep Kids money, Earning rules and
// Manage family. Every control behind Family settings (name, currency, export,
// delete the family) is admin-only, so offering an adult that door would walk
// them into a wall. Kids and guests get no family-admin doors at all.
//
// The server is the gate; this is only about not lying in the menu.

const DOORS = {
  kidsMoney: 'dashboard-profile-kids-money',
  earningRules: 'dashboard-profile-reward-settings',
  manageFamily: 'dashboard-profile-manage-members',
  familySettings: 'dashboard-profile-family-settings',
} as const;

function renderMenu(role: string | null) {
  return render(
    <MemoryRouter>
      <ProfilePill
        parentName="Sarah Khan"
        role={role}
        childMembers={[{ id: 'kid1', displayName: 'Amina' }]}
        onManageMembers={vi.fn()}
        onRewardSettings={vi.fn()}
        onKidsMoney={vi.fn()}
        onFamilySettings={vi.fn()}
        onLogout={vi.fn()}
        signingOut={false}
        slug="khan"
      />
    </MemoryRouter>,
  );
}

function openMenu(role: string | null) {
  renderMenu(role);
  fireEvent.click(screen.getByTestId('dashboard-profile-pill'));
}

describe('the profile menu shows only the doors you can walk through (FHS-625)', () => {
  it('an admin sees all four doors', () => {
    openMenu('admin');
    for (const testId of Object.values(DOORS)) {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    }
  });

  it('an adult sees the three they can use, and not Family settings', () => {
    openMenu('adult');
    expect(screen.getByTestId(DOORS.kidsMoney)).toBeInTheDocument();
    expect(screen.getByTestId(DOORS.earningRules)).toBeInTheDocument();
    expect(screen.getByTestId(DOORS.manageFamily)).toBeInTheDocument();
    // Every control behind this one is admin-only.
    expect(screen.queryByTestId(DOORS.familySettings)).not.toBeInTheDocument();
  });

  it.each(['teen', 'child', 'guest'])('a %s sees none of them', (role) => {
    openMenu(role);
    for (const testId of Object.values(DOORS)) {
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    }
  });

  it('shows nothing while the role is still loading, rather than a door it takes back', () => {
    openMenu(null);
    for (const testId of Object.values(DOORS)) {
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    }
  });

  it('an unrecognised role gets no doors', () => {
    openMenu('owner');
    for (const testId of Object.values(DOORS)) {
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    }
  });

  it('the rest of the menu still works for someone with no doors', () => {
    openMenu('child');
    // The menu is not empty: the role pill, the child links and Log out remain,
    // so hiding the doors never leaves a blank panel.
    expect(screen.getByTestId('dashboard-profile-role')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-logout')).toBeInTheDocument();
  });
});
