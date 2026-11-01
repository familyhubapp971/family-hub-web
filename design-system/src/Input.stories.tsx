import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input, Textarea } from './Input';

const meta = {
  title: 'Primitives/Input',
  component: Input,
  args: { placeholder: 'you@example.com', error: false, variant: 'default', disabled: false },
  argTypes: {
    variant: { control: 'inline-radio', options: ['default', 'dark'] },
    error: { control: 'boolean' },
  },
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The error state has to be visible without relying on colour alone. */
export const Error: Story = {
  args: { error: true, defaultValue: 'not-an-email' },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'Locked while saving' },
};

/** The dark variant is what sits on the purple surfaces. */
export const OnDarkSurface: Story = {
  args: { variant: 'dark', placeholder: 'Search the family' },
};

/** Textarea ships from the same file and shares the input styling. */
export const TextareaDefault: Story = {
  render: () => <Textarea rows={4} placeholder="What happened today?" />,
};

export const TextareaError: Story = {
  render: () => <Textarea rows={4} error defaultValue="Too short" />,
};
