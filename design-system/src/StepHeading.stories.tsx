import type { Meta, StoryObj } from '@storybook/react-vite';
import { StepHeading } from './StepHeading';

const TONES = ['bg-yellow-300', 'bg-pink-300', 'bg-cyan-300', 'bg-lime-300'] as const;

const meta = {
  title: 'Primitives/StepHeading',
  component: StepHeading,
  args: { number: 1, title: 'Add your children', tone: TONES[0] },
  argTypes: { tone: { control: 'select', options: [...TONES] } },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof StepHeading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** A whole wizard: the only way to judge the rhythm between steps. */
export const StepSequence: Story = {
  render: () => (
    <div className="max-w-md space-y-5">
      <StepHeading number={1} title="Name your family" tone={TONES[0]} />
      <StepHeading number={2} title="Add your children" tone={TONES[1]} />
      <StepHeading number={3} title="Pick the first habits" tone={TONES[2]} />
      <StepHeading number={4} title="Invite the other parent" tone={TONES[3]} />
    </div>
  ),
};

/** Two digits must not break the disc, and a long title must wrap. */
export const LongTitle: Story = {
  args: { number: 12, title: 'Choose which rewards need a parent to approve them first' },
  render: (args) => (
    <div className="max-w-xs">
      <StepHeading {...args} />
    </div>
  ),
};
