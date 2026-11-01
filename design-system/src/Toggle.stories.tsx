import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toggle } from './Toggle';

// Toggle is controlled, so a story that should actually move needs to own the
// state. A named component keeps the hook out of a render prop.
function ControlledToggle({ label, disabled }: { label: string; disabled: boolean }) {
  const [checked, setChecked] = useState(false);
  return <Toggle checked={checked} onChange={setChecked} label={label} disabled={disabled} />;
}

const meta = {
  title: 'Primitives/Toggle',
  component: Toggle,
  args: {
    checked: false,
    label: 'Weekly summary email',
    disabled: false,
    onChange: () => {},
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Click it: this one keeps its own state, so the animation is visible. */
export const Playground: Story = {
  render: (args) => <ControlledToggle label={args.label ?? ''} disabled={args.disabled ?? false} />,
};

export const On: Story = { args: { checked: true } };
export const Off: Story = { args: { checked: false } };
export const DisabledOn: Story = { args: { checked: true, disabled: true } };
export const DisabledOff: Story = { args: { checked: false, disabled: true } };

/** Without a label the control must still be reachable and operable. */
export const NoLabel: Story = {
  render: () => <Toggle checked onChange={() => {}} />,
};
