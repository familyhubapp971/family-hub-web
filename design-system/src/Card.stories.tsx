import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from './Card';

const VARIANTS = ['default', 'yellow', 'pink', 'cyan', 'lime'] as const;
const RADII = ['md', 'xl', '2xl'] as const;

const meta = {
  title: 'Primitives/Card',
  component: Card,
  args: { children: 'A card holds one idea.', variant: 'default', radius: 'xl', hover: false },
  argTypes: {
    variant: { control: 'select', options: VARIANTS },
    radius: { control: 'inline-radio', options: RADII },
    hover: { control: 'boolean' },
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The pastel fills, which is how a screen colour-blocks its sections. */
export const AllVariants: Story = {
  render: (args) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {VARIANTS.map((variant) => (
        <Card key={variant} {...args} variant={variant}>
          {variant}
        </Card>
      ))}
    </div>
  ),
};

export const AllRadii: Story = {
  render: (args) => (
    <div className="grid gap-4 sm:grid-cols-3">
      {RADII.map((radius) => (
        <Card key={radius} {...args} radius={radius} variant="yellow">
          radius {radius}
        </Card>
      ))}
    </div>
  ),
};

/** Clickable cards lift on hover. The lift is gated for reduced motion. */
export const Clickable: Story = {
  args: { hover: true, variant: 'cyan', children: 'Tap me', onClick: () => {} },
};

export const LongContent: Story = {
  render: (args) => (
    <div className="max-w-sm">
      <Card {...args} variant="lime">
        School runs, swim class, dentist appointments, the reading log and two birthday parties, all
        of it sitting in one place so nobody has to hold it in their head.
      </Card>
    </div>
  ),
};
