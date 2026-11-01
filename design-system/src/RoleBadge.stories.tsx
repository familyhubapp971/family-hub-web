import type { Meta, StoryObj } from '@storybook/react-vite';
import { RoleBadge, ROLE_STYLE } from './RoleBadge';

const ROLES = Object.keys(ROLE_STYLE);

const meta = {
  title: 'Primitives/RoleBadge',
  component: RoleBadge,
  args: { role: 'admin', age: null },
  argTypes: { role: { control: 'select', options: ROLES } },
} satisfies Meta<typeof RoleBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Every role at once: this is the colour map the whole app reads from. */
export const AllRoles: Story = {
  parameters: { layout: 'padded' },
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      {ROLES.map((role) => (
        <RoleBadge key={role} {...args} role={role} />
      ))}
    </div>
  ),
};

/** Children carry their age beside the role. */
export const WithAge: Story = { args: { role: 'child', age: 7 } };

/** An unknown role must fall back rather than render blank. */
export const UnknownRole: Story = { args: { role: 'wizard' } };
