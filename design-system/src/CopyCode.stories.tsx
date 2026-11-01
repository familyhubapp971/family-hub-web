import type { Meta, StoryObj } from '@storybook/react-vite';
import { CopyCode } from './CopyCode';

const meta = {
  title: 'Primitives/CopyCode',
  component: CopyCode,
  args: {
    code: 'e29b-41d4',
    label: 'Family code',
  },
  argTypes: {
    copyLabel: { control: 'text' },
    copiedLabel: { control: 'text' },
  },
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-96 max-w-full rounded-xl border-2 border-black bg-white p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CopyCode>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The family code on the Members page. */
export const FamilyCode: Story = {};

/** On the narrowest phone the button drops under the code instead of squeezing it. */
export const NarrowPhone: Story = {
  decorators: [
    (Story) => (
      <div className="w-[260px]">
        <Story />
      </div>
    ),
  ],
};

export const OwnButtonWords: Story = {
  args: { copyLabel: 'Copy code', copiedLabel: 'Copied to clipboard' },
};
