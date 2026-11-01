// FHS-513: shared role → colour/label map, extracted out of MembersPage
// and TodayTabPanel (both had an identical literal `ROLE_STYLE` object,
// the design-system rule calls that drift out for consolidation). Any
// page that shows a member's role badge or avatar disc should use this
// module instead of a local copy.

export interface RoleStyle {
  /** Tailwind background class for the round avatar disc. */
  disc: string;
  /** Tailwind background class for the role pill/badge. */
  badge: string;
  /** Human-readable label, e.g. "Admin". */
  label: string;
}

export const ROLE_STYLE: Record<string, RoleStyle> = {
  admin: { disc: 'bg-pink-300', badge: 'bg-pink-200', label: 'Admin' },
  adult: { disc: 'bg-cyan-300', badge: 'bg-cyan-200', label: 'Adult' },
  teen: { disc: 'bg-yellow-300', badge: 'bg-yellow-200', label: 'Teen' },
  child: { disc: 'bg-purple-300', badge: 'bg-purple-200', label: 'Child' },
  guest: { disc: 'bg-gray-300', badge: 'bg-gray-200', label: 'Guest' },
};

export function roleStyle(role: string): RoleStyle {
  return ROLE_STYLE[role] ?? ROLE_STYLE.guest!;
}

export interface RoleBadgeProps {
  role: string;
  /** Shown as "Child (6)" for child/teen rows that have a collected age. */
  age?: number | null;
  className?: string;
  testId?: string;
}

// FHS-520 (design-fidelity): the Magic Patterns mock uses the same
// -300 shade for the RoleBadge pill as the avatar disc (not the softer
// -200 badge tone `roleStyle().badge` carries for other surfaces like
// the Today tab's role pill), reuse `style.disc` here so the two design
// tokens don't have to be duplicated.
/** Small pill badge: role label, coloured per `ROLE_STYLE`. */
export function RoleBadge({ role, age = null, className = '', testId }: RoleBadgeProps) {
  const style = roleStyle(role);
  const showAge = (role === 'child' || role === 'teen') && age !== null;
  return (
    <span
      data-testid={testId}
      className={`inline-block rounded-full border-2 border-black px-3 py-1 text-xs font-bold uppercase tracking-wide ${style.disc} ${className}`.trim()}
    >
      {style.label}
      {showAge ? ` (${age})` : ''}
    </span>
  );
}

export interface AvatarDiscProps {
  role: string;
  name: string;
  /** Emoji shown in the disc; falls back to the name's first letter. */
  emoji?: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  testId?: string;
}

const DISC_SIZES: Record<NonNullable<AvatarDiscProps['size']>, string> = {
  sm: 'h-10 w-10 text-lg',
  md: 'h-14 w-14 text-2xl',
  lg: 'h-16 w-16 text-3xl',
};

/** Round avatar disc: emoji or initial, coloured per the member's role. */
export function AvatarDisc({
  role,
  name,
  emoji,
  size = 'md',
  className = '',
  testId,
}: AvatarDiscProps) {
  const style = roleStyle(role);
  const initial = [...name.trim()][0]?.toUpperCase() ?? '?';
  return (
    <div
      aria-hidden="true"
      data-testid={testId}
      className={`flex shrink-0 items-center justify-center rounded-full border-2 border-black font-heading shadow-neo-sm ${style.disc} ${DISC_SIZES[size]} ${className}`.trim()}
    >
      {emoji ?? initial}
    </div>
  );
}
