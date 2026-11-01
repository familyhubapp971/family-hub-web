import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';

const VARIANTS = ['default', 'success', 'warning', 'danger', 'info'] as const;

const meta = {
  title: 'Primitives/Badge',
  component: Badge,
  args: { children: 'Active', variant: 'default' },
  argTypes: { variant: { control: 'inline-radio', options: VARIANTS } },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const AllVariants: Story = {
  parameters: { layout: 'padded' },
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      {VARIANTS.map((variant) => (
        <Badge key={variant} {...args} variant={variant}>
          {variant}
        </Badge>
      ))}
    </div>
  ),
};
