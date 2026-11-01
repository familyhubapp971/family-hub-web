import type { Meta, StoryObj } from '@storybook/react-vite';
import { Select } from './Select';

const meta = {
  title: 'Primitives/Select',
  component: Select,
  args: { error: false, disabled: false },
  argTypes: { error: { control: 'boolean' } },
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-72 max-w-full">
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <Select {...args} defaultValue="adult">
      <option value="admin">Admin</option>
      <option value="adult">Adult</option>
      <option value="teen">Teen</option>
      <option value="child">Child</option>
    </Select>
  ),
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const Error: Story = { args: { error: true } };
export const Disabled: Story = { args: { disabled: true } };
