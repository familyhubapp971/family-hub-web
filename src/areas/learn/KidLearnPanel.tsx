import { LearnTab } from './LearnTab';

// FHS-367 / FHS-373: kid Learn tab. Reuses LearnTab in kid mode: lesson subjects
// (Maths/Science/Logic) + World Flags + the reading log, talking to the token-scoped
// /api/kid/learn, /api/kid/world-flags*, and /api/kid/reading-log endpoints.
export function KidLearnPanel({ kidToken }: { kidToken: string | null }) {
  if (!kidToken) return null;
  return <LearnTab kidToken={kidToken} />;
}
