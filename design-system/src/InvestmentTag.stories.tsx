import type { Meta, StoryObj } from '@storybook/react-vite';
import { InvestmentTag } from './InvestmentTag';

const meta = {
  title: 'Primitives/InvestmentTag',
  component: InvestmentTag,
  args: { multiplier: 2, deductible: true },
  argTypes: {
    multiplier: { control: { type: 'range', min: 1, max: 5, step: 1 } },
    deductible: { control: 'boolean' },
  },
} satisfies Meta<typeof InvestmentTag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Deductible and non-deductible read differently: that is the whole point. */
export const Deductible: Story = { args: { deductible: true } };
export const NotDeductible: Story = { args: { deductible: false } };

export const AllMultipliers: Story = {
  parameters: { layout: 'padded' },
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      {[1, 2, 3, 4, 5].map((multiplier) => (
        <InvestmentTag key={multiplier} {...args} multiplier={multiplier} />
      ))}
    </div>
  ),
};
