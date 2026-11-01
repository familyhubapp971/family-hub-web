import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { BoostButton } from './BoostButton';

const MULTIPLIERS = [1, 2, 3, 5];

// The real screen shows a row where exactly one boost is selected, so the story
// models that rather than a lone button frozen in one state.
function BoostRow() {
  const [selected, setSelected] = useState(2);
  return (
    <div className="flex flex-wrap items-center gap-3">
      {MULTIPLIERS.map((multiplier) => (
        <BoostButton
          key={multiplier}
          multiplier={multiplier}
          selected={selected === multiplier}
          onClick={() => setSelected(multiplier)}
        />
      ))}
    </div>
  );
}

const meta = {
  title: 'Primitives/BoostButton',
  component: BoostButton,
  args: { multiplier: 2, selected: false, onClick: () => {} },
  argTypes: { multiplier: { control: { type: 'range', min: 1, max: 5, step: 1 } } },
} satisfies Meta<typeof BoostButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const Selected: Story = { args: { selected: true } };

/** How it is really used: picking one clears the others. */
export const PickerRow: Story = {
  parameters: { layout: 'padded' },
  render: () => <BoostRow />,
};
