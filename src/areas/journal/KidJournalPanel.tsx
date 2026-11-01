import { JournalTab } from './JournalTab';

// FHS-366: kid Journal tab. Reuses the full JournalTab (mood, gratitude,
// what-happened, creativity prompts, past entries) in KID mode: it talks to the
// token-scoped /api/kid/journal endpoints instead of the parent session.
export function KidJournalPanel({ kidToken }: { kidToken: string | null }) {
  if (!kidToken) return null;
  return <JournalTab kidToken={kidToken} />;
}
