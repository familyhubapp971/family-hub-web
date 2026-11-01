import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@familyhub/ui';

// Shared shell for all auth screens: centred, single column, brand
// background, neo-brutalist card. Keeps the per-page components focused
// on the form + copy.
//
// FHS-360: pass `centered` + `subtitle` for the Magic Patterns "Welcome
// Back!" card: an F gradient avatar above a centred title + subtitle. Other
// auth pages omit these and keep the plain left-aligned title.
export function AuthLayout({
  title,
  subtitle,
  centered = false,
  children,
}: {
  title: string;
  subtitle?: string;
  centered?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-full">
      {/* Brand link top-left: clicks back to the homepage. */}
      <Link
        to="/"
        className="absolute left-6 top-6 font-heading text-2xl text-white transition-opacity hover:opacity-90 sm:left-10 sm:top-8"
      >
        FamilyHub
      </Link>
      <main className="flex min-h-full items-center justify-center px-4 pb-10 pt-24 md:pt-32">
        <Card className="w-full max-w-md translate-y-4 border-4 border-white p-8 text-gray-900 shadow-neo-lg md:translate-y-8">
          {centered ? (
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full border-2 border-black bg-gradient-to-br from-pink-400 to-purple-500 shadow-neo-sm">
                <span className="font-heading text-3xl text-white" aria-hidden="true">
                  F
                </span>
              </div>
              <h1 className="font-display text-3xl text-kingdom-bg">{title}</h1>
              {subtitle && <p className="mt-2 font-bold text-gray-500">{subtitle}</p>}
            </div>
          ) : (
            <h1 className="font-display text-3xl text-kingdom-bg">{title}</h1>
          )}
          <div className={centered ? '' : 'mt-6'}>{children}</div>
        </Card>
      </main>
    </div>
  );
}
