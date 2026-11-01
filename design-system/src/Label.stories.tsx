import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './Input';
import { Label } from './Label';

const meta = {
  title: 'Primitives/Label',
  component: Label,
  args: { children: 'Email address', required: false },
  argTypes: { required: { control: 'boolean' } },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Required: Story = { args: { required: true } };

/** How it is actually used: bound to a field via htmlFor. */
export const WithField: Story = {
  render: (args) => (
    <div className="w-80 max-w-full space-y-1.5">
      <Label {...args} htmlFor="story-email" required />
      <Input id="story-email" placeholder="you@example.com" />
    </div>
  ),
};
