import type { Meta, StoryObj } from '@storybook/react-vite';
import { Spinner } from './Spinner';

const SIZES = ['sm', 'md', 'lg'] as const;

const meta = {
  title: 'Primitives/Spinner',
  component: Spinner,
  args: { size: 'md', label: 'Loading' },
  argTypes: { size: { control: 'inline-radio', options: SIZES } },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const AllSizes: Story = {
  parameters: { layout: 'padded' },
  render: (args) => (
    <div className="flex items-center gap-6">
      {SIZES.map((size) => (
        <Spinner key={size} {...args} size={size} />
      ))}
    </div>
  ),
};
