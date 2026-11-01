import React from 'react';
import { Card } from './Card';
import { AvatarDisc } from './RoleBadge';

// FHS-513: the family-member card shell shared by the Manage Members
// "Grown-ups", "Kids", and "Waiting to join" groups: avatar disc + name
// + a status line (email / PIN state) + role badge up top, arbitrary
// body content (inline forms, info panels) in the middle, and an
// actions row pinned to the bottom via the flex-1 spacer.

export interface MemberCardProps {
  role: string;
  name: string;
  avatarEmoji?: string | null;
  /** Role badge element: pass a `<RoleBadge role={...} />`. */
  badge: React.ReactNode;
  /** Short line under the name: an email, "PIN set", "Pending", etc. */
  statusLine?: React.ReactNode;
  /** Extra body content: pending box, inline edit/PIN forms, info panels. */
  children?: React.ReactNode;
  /** Actions row rendered at the bottom of the card. */
  footer?: React.ReactNode;
  className?: string;
  testId?: string;
}

export function MemberCard({
  role,
  name,
  avatarEmoji,
  badge,
  statusLine,
  children,
  footer,
  className = '',
  testId,
}: MemberCardProps) {
  return (
    <Card
      className={`flex h-full flex-col bg-white p-5 sm:p-6 ${className}`.trim()}
      {...(testId ? { testId } : {})}
    >
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <AvatarDisc role={role} name={name} emoji={avatarEmoji} />
          <div className="min-w-0 pt-1">
            <h3
              className="truncate font-heading text-xl text-black"
              data-testid={testId ? `${testId}-name` : undefined}
            >
              {name}
            </h3>
            {statusLine && (
              <p
                className="mt-0.5 truncate text-sm font-bold text-gray-500"
                data-testid={testId ? `${testId}-status` : undefined}
              >
                {statusLine}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0 pt-1">{badge}</div>
      </div>
      {children}
      <div className="flex-1" />
      {footer && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t-2 border-dashed border-gray-200 pt-4">
          {footer}
        </div>
      )}
    </Card>
  );
}
