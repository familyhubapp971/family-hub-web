import { Award, CheckCircle, Heart, Sparkles, Star, Zap, type LucideIcon } from 'lucide-react';

// FHS-631: the API stores a habit's icon as a STRING NAME ("heart", "star"),
// never an emoji or a component. Anything that renders `habit.icon` directly
// prints the literal word, which is what the money sheets were doing: a habit
// row read "heart" in a grey box instead of showing an icon.
//
// This lived in src/areas/my-world/kid/icons.tsx, out of reach
// of anything outside the kid pages, so the same bug was reintroduced in a new
// place (FHS-374 first, then FHS-630). It lives here now so there is one copy
// every screen can reach.
//
// The fallback is deliberate: an unknown or missing name gets a Star, never the
// raw string, so a new icon name added server-side can never leak text into the
// UI. `tests/unit/web/ui/habitIcon.test.tsx` fails if that stops being true.

const ICON_BY_NAME: Record<string, LucideIcon> = {
  heart: Heart,
  star: Star,
  magic: Sparkles,
  sparkles: Sparkles,
  trophy: Award,
  award: Award,
  lightning: Zap,
  zap: Zap,
  check: CheckCircle,
  checkcircle: CheckCircle,
};

/** The icon component for a stored habit icon name. Never returns a string. */
export function habitIcon(name: string | null | undefined): LucideIcon {
  return ICON_BY_NAME[(name ?? '').toLowerCase()] ?? Star;
}

/** Every name that maps to its own icon, for tests and for pickers. */
export const HABIT_ICON_NAMES: readonly string[] = Object.keys(ICON_BY_NAME);
