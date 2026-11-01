import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';

const VARIANTS = ['primary', 'secondary', 'ghost', 'danger', 'success', 'pink', 'purple'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;

const meta = {
  title: 'Primitives/Button',
  component: Button,
  args: { children: 'Start free', variant: 'primary', size: 'md', disabled: false },
  argTypes: {
    variant: { control: 'select', options: VARIANTS },
    size: { control: 'select', options: SIZES },
    fullWidth: { control: 'boolean' },
    onClick: { action: 'clicked' },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default call to action. Change variant and size from the controls. */
export const Playground: Story = {};

/** Every variant side by side, which is how drift gets spotted. */
export const AllVariants: Story = {
  parameters: { layout: 'padded' },
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      {VARIANTS.map((variant) => (
        <Button key={variant} {...args} variant={variant}>
          {variant}
        </Button>
      ))}
    </div>
  ),
};

export const AllSizes: Story = {
  parameters: { layout: 'padded' },
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      {SIZES.map((size) => (
        <Button key={size} {...args} size={size}>
          Size {size}
        </Button>
      ))}
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, children: 'Not right now' },
};

/** fullWidth is what forms and mobile sheets use. */
export const FullWidth: Story = {
  parameters: { layout: 'padded' },
  render: (args) => (
    <div className="w-80 max-w-full">
      <Button {...args} fullWidth>
        Join the family team
      </Button>
    </div>
  ),
};

/** Long labels must wrap or stay legible rather than blowing out the layout. */
export const LongLabel: Story = {
  parameters: { layout: 'padded' },
  render: (args) => (
    <div className="w-72 max-w-full">
      <Button {...args} fullWidth>
        Send the invitation to the other parent
      </Button>
    </div>
  ),
};
