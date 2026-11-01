import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Button,
  Card,
  Input,
  TopNav,
  AvatarGrid,
  PinInput,
  StepperHeader,
  FeatureCard,
  PricingCard,
  FloatingDecorations,
  ConfirmDialog,
} from '../../../design-system/src';

// Sanity tests for the FHS-242 design-system extensions:
//   - Button.fullWidth → adds `w-full`
//   - Card.radius → defaults to `rounded-xl`; opts into `rounded-md` /
//     `rounded-2xl` via prop
//   - Input.variant='dark' → applies `border-black` + purple focus ring
// Each test asserts a single class so a future Tailwind rename is loud.

describe('Button.fullWidth', () => {
  it('does NOT include w-full by default', () => {
    render(<Button testId="btn">click</Button>);
    expect(screen.getByTestId('btn').className).not.toContain('w-full');
  });

  it('includes w-full when fullWidth is true', () => {
    render(
      <Button testId="btn" fullWidth>
        click
      </Button>,
    );
    expect(screen.getByTestId('btn').className).toContain('w-full');
  });
});

describe('Card.radius', () => {
  it('defaults to rounded-xl (matches MP design)', () => {
    render(<Card testId="card">x</Card>);
    expect(screen.getByTestId('card').className).toContain('rounded-xl');
    expect(screen.getByTestId('card').className).not.toContain('rounded-2xl');
  });

  it('honours radius="md"', () => {
    render(
      <Card testId="card" radius="md">
        x
      </Card>,
    );
    expect(screen.getByTestId('card').className).toContain('rounded-md');
  });

  it('honours radius="2xl" (legacy soft-corner opt-in)', () => {
    render(
      <Card testId="card" radius="2xl">
        x
      </Card>,
    );
    expect(screen.getByTestId('card').className).toContain('rounded-2xl');
    expect(screen.getByTestId('card').className).not.toContain('rounded-xl ');
  });
});

describe('Input.variant', () => {
  it('default variant uses gray-50 background + pink focus ring', () => {
    render(<Input data-testid="input" />);
    const input = screen.getByTestId('input');
    expect(input.className).toContain('bg-gray-50');
    expect(input.className).toContain('focus-visible:ring-pink-400');
  });

  it('dark variant uses white background + black border + purple focus ring', () => {
    render(<Input data-testid="input" variant="dark" />);
    const input = screen.getByTestId('input');
    expect(input.className).toContain('bg-white');
    expect(input.className).toContain('border-black');
    expect(input.className).toContain('focus-visible:ring-purple-500');
  });
});

describe('TopNav', () => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'meals', label: 'Meals' },
    { id: 'calendar', label: 'Calendar' },
  ];

  it('renders every tab and marks the active one with aria-selected', () => {
    render(<TopNav tabs={tabs} activeTab="meals" onTabChange={() => {}} brand="FamilyHub" />);
    expect(screen.getByRole('tab', { name: /dashboard/i })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(screen.getByRole('tab', { name: /meals/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('lets the brand shrink so a long name cannot widen the page (FHS-606)', () => {
    render(<TopNav tabs={tabs} activeTab="meals" onTabChange={() => {}} brand="FamilyHub" />);
    const wrapper = screen.getByText('FamilyHub').closest('div');
    expect(wrapper).toHaveClass('min-w-0', 'max-w-full');
    expect(wrapper).not.toHaveClass('shrink-0');
  });

  it('calls onTabChange with the clicked tab id', () => {
    const onTabChange = vi.fn();
    render(<TopNav tabs={tabs} activeTab="dashboard" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('tab', { name: /calendar/i }));
    expect(onTabChange).toHaveBeenCalledWith('calendar');
  });

  it('gives every tab button an id matching its aria-controls panel id', () => {
    render(<TopNav tabs={tabs} activeTab="dashboard" onTabChange={() => {}} />);
    for (const t of tabs) {
      const btn = screen.getByRole('tab', { name: new RegExp(t.label, 'i') });
      expect(btn.id).toBe(`tab-${t.id}`);
      expect(btn.getAttribute('aria-controls')).toBe(`panel-${t.id}`);
    }
  });

  it('renders the brand and rightSlot when provided', () => {
    render(
      <TopNav
        tabs={tabs}
        activeTab="dashboard"
        onTabChange={() => {}}
        brand="FamilyHub"
        rightSlot={<button>Profile</button>}
      />,
    );
    expect(screen.getByText('FamilyHub')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument();
  });
});

describe('AvatarGrid', () => {
  const avatars = [
    { id: 'sarah', name: 'Sarah', role: 'Mum', color: 'bg-pink-200' },
    { id: 'amina', name: 'Amina', role: 'Teen (14)', color: 'bg-yellow-200', avatar: '👧' },
  ];

  it('renders one button per avatar with accessible name', () => {
    render(<AvatarGrid avatars={avatars} />);
    expect(screen.getByRole('button', { name: 'Sarah, Mum' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Amina, Teen (14)' })).toBeInTheDocument();
  });

  it('falls back to first letter when no avatar prop given', () => {
    render(<AvatarGrid avatars={[avatars[0]!]} />);
    expect(screen.getByText('S')).toBeInTheDocument();
  });

  it('renders the provided avatar node when given', () => {
    render(<AvatarGrid avatars={[avatars[1]!]} />);
    expect(screen.getByText('👧')).toBeInTheDocument();
  });

  it('marks the selected tile with aria-pressed=true', () => {
    render(<AvatarGrid avatars={avatars} selectedId="amina" />);
    expect(screen.getByRole('button', { name: 'Sarah, Mum' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Amina, Teen (14)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('calls onSelect with the clicked avatar id', () => {
    const onSelect = vi.fn();
    render(<AvatarGrid avatars={avatars} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sarah, Mum' }));
    expect(onSelect).toHaveBeenCalledWith('sarah');
  });
});

describe('PinInput', () => {
  it('renders 4 cells by default with correct aria labels', () => {
    render(<PinInput autoFocus={false} />);
    for (let i = 1; i <= 4; i++) {
      expect(
        screen.getByLabelText(`Enter PIN digit ${i} of 4`, { exact: false }),
      ).toBeInTheDocument();
    }
  });

  it('respects custom length prop', () => {
    render(<PinInput length={6} autoFocus={false} />);
    expect(screen.getByLabelText('Enter PIN digit 6 of 6', { exact: false })).toBeInTheDocument();
  });

  it('fires onChange on each keystroke and onComplete when full', () => {
    const onChange = vi.fn();
    const onComplete = vi.fn();
    render(<PinInput length={3} autoFocus={false} onChange={onChange} onComplete={onComplete} />);
    const inputs = [1, 2, 3].map(
      (i) =>
        screen.getByLabelText(`Enter PIN digit ${i} of 3`, { exact: false }) as HTMLInputElement,
    );
    fireEvent.change(inputs[0]!, { target: { value: '1' } });
    fireEvent.change(inputs[1]!, { target: { value: '2' } });
    fireEvent.change(inputs[2]!, { target: { value: '3' } });
    expect(onChange).toHaveBeenLastCalledWith('123');
    expect(onComplete).toHaveBeenCalledWith('123');
  });

  it('drops non-digit characters', () => {
    const onChange = vi.fn();
    render(<PinInput length={2} autoFocus={false} onChange={onChange} />);
    const cell = screen.getByLabelText('Enter PIN digit 1 of 2', {
      exact: false,
    }) as HTMLInputElement;
    fireEvent.change(cell, { target: { value: 'a' } });
    expect(onChange).toHaveBeenLastCalledWith('');
  });
});

describe('StepperHeader', () => {
  it('renders the right number of steps', () => {
    render(<StepperHeader steps={4} current={2} testId="stepper" />);
    const stepper = screen.getByTestId('stepper');
    // 4 circles: 1 done (✓), current (2), and 3 future numbered
    expect(stepper.textContent).toContain('✓');
    expect(stepper.textContent).toContain('2');
    expect(stepper.textContent).toContain('3');
    expect(stepper.textContent).toContain('4');
  });

  it('marks the active step with aria-current="step"', () => {
    render(<StepperHeader steps={3} current={2} testId="stepper" />);
    const active = screen.getByTestId('stepper').querySelector('[aria-current="step"]');
    expect(active).not.toBeNull();
    expect(active?.textContent).toContain('2');
  });

  it('renders labels under each step on sm+ when provided', () => {
    render(
      <StepperHeader
        steps={3}
        current={1}
        labels={['Family', 'Members', 'Done']}
        testId="stepper"
      />,
    );
    expect(screen.getByText('Family')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  // FHS-255: bar must anchor to the circle's vertical centre
  // (top-5 = 20px = h-10 / 2) regardless of whether labels are
  // rendered. Using top-1/2 makes the bar drift down when labels
  // grow the parent flex row's height.
  it('progress bar anchors to the circle centre, not the label-row centre', () => {
    render(
      <StepperHeader
        steps={3}
        current={2}
        labels={['Welcome', 'Members', 'Done']}
        testId="stepper"
      />,
    );
    const bar = screen.getByTestId('stepper-bar');
    expect(bar.className).toContain('top-5');
    expect(bar.className).not.toContain('top-1/2');
  });

  it('progress bar still uses the same fixed offset when labels are absent', () => {
    render(<StepperHeader steps={3} current={2} testId="stepper" />);
    const bar = screen.getByTestId('stepper-bar');
    expect(bar.className).toContain('top-5');
  });

  it('omits the progress bar entirely when hideBar is true', () => {
    render(<StepperHeader steps={3} current={2} hideBar testId="stepper" />);
    expect(screen.queryByTestId('stepper-bar')).toBeNull();
  });
});

describe('FeatureCard', () => {
  it('renders title + body + applies accent / cardBg classes', () => {
    render(
      <FeatureCard
        icon={<span data-testid="icon">icon</span>}
        title="One calendar"
        body="See everyone in one place"
        headerBg="bg-yellow-200"
        cardBg="bg-yellow-50"
        iconColor="text-pink-500"
        accentBar="border-l-pink-400"
        testId="fc"
      />,
    );
    const card = screen.getByTestId('fc');
    expect(screen.getByText('One calendar')).toBeInTheDocument();
    expect(screen.getByText('See everyone in one place')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(card.className).toContain('border-l-pink-400');
    expect(card.className).toContain('bg-yellow-50');
  });
});

describe('PricingCard', () => {
  const baseProps = {
    name: 'Family',
    price: '$7.99',
    priceSuffix: '/mo',
    ctaLabel: 'Start free trial',
    onCta: () => {},
    features: [
      { label: 'Unlimited members', included: true },
      { label: 'Custom subdomain', included: false },
    ],
  };

  it('renders the tier name + price + suffix + CTA + features', () => {
    render(<PricingCard {...baseProps} />);
    expect(screen.getByText('Family')).toBeInTheDocument();
    expect(screen.getByText('$7.99')).toBeInTheDocument();
    expect(screen.getByText('/mo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start free trial' })).toBeInTheDocument();
    expect(screen.getByText('Unlimited members')).toBeInTheDocument();
    expect(screen.getByText('Custom subdomain')).toBeInTheDocument();
  });

  it('renders Free as plain text when price === "Free"', () => {
    render(<PricingCard {...baseProps} price="Free" priceSuffix={undefined} />);
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('shows the Most popular badge only when featured=true', () => {
    const { rerender } = render(<PricingCard {...baseProps} testId="pc" />);
    expect(screen.queryByText('Most popular')).not.toBeInTheDocument();
    rerender(<PricingCard {...baseProps} featured testId="pc" />);
    expect(screen.getByText('Most popular')).toBeInTheDocument();
  });

  it('fires onCta when the CTA button is clicked', () => {
    const onCta = vi.fn();
    render(<PricingCard {...baseProps} onCta={onCta} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start free trial' }));
    expect(onCta).toHaveBeenCalledOnce();
  });
});

describe('FloatingDecorations', () => {
  it('renders one element per item with the correct icon', () => {
    render(
      <FloatingDecorations
        elements={[
          { icon: '📅', top: '15%', left: '10%' },
          { icon: '⭐', top: '20%', right: '12%' },
        ]}
        testId="fd"
      />,
    );
    const wrapper = screen.getByTestId('fd');
    expect(wrapper.textContent).toContain('📅');
    expect(wrapper.textContent).toContain('⭐');
  });

  it('marks the wrapper aria-hidden so it is invisible to screen readers', () => {
    render(<FloatingDecorations elements={[{ icon: '📅', top: '15%' }]} testId="fd" />);
    expect(screen.getByTestId('fd')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('ConfirmDialog', () => {
  const noop = () => {};

  it('renders nothing when closed', () => {
    render(
      <ConfirmDialog isOpen={false} title="Delete?" onConfirm={noop} onCancel={noop} testId="cd" />,
    );
    expect(screen.queryByTestId('cd')).toBeNull();
  });

  it('shows the title + message and is a role=dialog when open', () => {
    render(
      <ConfirmDialog
        isOpen
        title="Delete Playdate?"
        message="This will be removed."
        onConfirm={noop}
        onCancel={noop}
        testId="cd"
      />,
    );
    expect(screen.getByTestId('cd')).toHaveAttribute('role', 'dialog');
    expect(screen.getByTestId('cd').textContent).toContain('Delete Playdate?');
    expect(screen.getByTestId('cd-message').textContent).toContain('This will be removed.');
  });

  it('fires onConfirm / onCancel from the buttons', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        isOpen
        title="Delete?"
        onConfirm={onConfirm}
        onCancel={onCancel}
        testId="cd"
      />,
    );
    fireEvent.click(screen.getByTestId('cd-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('cd-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons while busy', () => {
    render(
      <ConfirmDialog isOpen busy title="Delete?" onConfirm={noop} onCancel={noop} testId="cd" />,
    );
    expect(screen.getByTestId('cd-confirm')).toBeDisabled();
    expect(screen.getByTestId('cd-cancel')).toBeDisabled();
  });

  // FHS-435: "type the name to confirm" gate for the delete-account dialog.
  it('confirmDisabled disables only the confirm button, not cancel', () => {
    render(
      <ConfirmDialog
        isOpen
        confirmDisabled
        title="Delete account?"
        onConfirm={noop}
        onCancel={noop}
        testId="cd"
      />,
    );
    expect(screen.getByTestId('cd-confirm')).toBeDisabled();
    expect(screen.getByTestId('cd-cancel')).not.toBeDisabled();
  });

  it('renders children below the message (e.g. a confirmation input)', () => {
    render(
      <ConfirmDialog isOpen title="Delete account?" onConfirm={noop} onCancel={noop} testId="cd">
        <input data-testid="cd-extra-input" />
      </ConfirmDialog>,
    );
    expect(screen.getByTestId('cd-extra-input')).toBeInTheDocument();
  });
});
