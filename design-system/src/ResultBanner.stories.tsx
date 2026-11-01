import type { Meta, StoryObj } from '@storybook/react-vite';
import { ResultBanner } from './ResultBanner';

const meta = {
  title: 'Primitives/ResultBanner',
  component: ResultBanner,
  args: {
    children: 'Nice work, the week is closed.',
    tone: 'positive',
    showIcon: true,
  },
  argTypes: {
    tone: { control: 'inline-radio', options: ['positive', 'warning'] },
    showIcon: { control: 'boolean' },
  },
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-96 max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ResultBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Positive: Story = { args: { tone: 'positive' } };

export const Warning: Story = {
  args: { tone: 'warning', children: 'Two habits were missed this week.' },
};

/** Without the icon the tone must still be readable from the copy and colour. */
export const NoIcon: Story = { args: { showIcon: false } };

export const LongMessage: Story = {
  args: {
    children:
      'The week is closed. Two habits were missed, one reward is still waiting on you, and next week starts fresh on Monday morning.',
  },
};
