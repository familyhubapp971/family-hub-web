import { H3, LegalLayout, List, Note, P, Placeholder, type LegalSection } from './LegalLayout';

// CookiesPage: /legal/cookies (FHS-509). Forensic port of the Magic
// Patterns design (7f19f840-c796-4eaa-90fc-934fb4ef587d,
// pages/legal/Cookies.tsx). Every heading, plain-English summary,
// bullet list and [placeholder] below is the founder's placeholder
// copy pending legal review: verbatim, not paraphrased.

const sections: LegalSection[] = [
  {
    id: 'summary',
    title: 'The short version',
    summary:
      'We store what is needed to keep you signed in. There are no advertising or tracking cookies.',
    body: (
      <>
        <P>
          Family Hub uses a little browser storage so you stay signed in and the app remembers a few
          preferences. That is all. Nothing is shared with ad networks.
        </P>
        <Note>
          We only use strictly necessary storage, so there is no cookie banner nagging you on every
          visit.
        </Note>
      </>
    ),
  },
  {
    id: 'what-we-store',
    title: 'What is stored on your device',
    summary:
      'A session token, a note of which child view is unlocked, and small interface preferences.',
    body: (
      <>
        <H3>Strictly necessary</H3>
        <List
          items={[
            'Session token: proves you are signed in so you do not have to request a new email link on every page. Set by our sign-in provider, Supabase.',
            'Sign-in state: a simple flag that tells the app a grown-up is logged in on this device.',
            'Child view unlock: remembers which child profile is currently open after the correct PIN was entered.',
            'Security: short-lived values used to protect sign-in links from being reused or forged.',
          ]}
        />

        <H3>Preferences</H3>
        <List
          items={[
            'Setup progress, so the getting-started guide knows which steps you finished.',
            'Small interface choices, such as which sections you collapsed.',
          ]}
        />

        <H3>What we never store</H3>
        <List
          items={[
            'Advertising or cross-site tracking identifiers.',
            'Third-party analytics profiles.',
            'A child’s PIN in readable form.',
            'Payment details.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'how-long',
    title: 'How long it stays',
    summary:
      'Sign-in storage lasts until you log out or it expires. Preferences stay until you clear your browser.',
    body: (
      <>
        <List
          items={[
            'Session token: expires after a period of inactivity, or immediately when you log out.',
            'Child view unlock: cleared when the child signs out or the browser data is cleared.',
            'Preferences: kept on the device until you clear them.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'your-choices',
    title: 'Your choices',
    summary: 'You can clear this storage in your browser, but you will be signed out.',
    body: (
      <>
        <P>
          Clearing Family Hub&apos;s site data in your browser signs everyone out on that device and
          resets preferences. Your family&apos;s data is untouched, because it lives in your hub,
          not the browser.
        </P>
        <P>
          On a shared tablet, sign out when a child finishes so the next person must enter their own
          PIN. Questions: <Placeholder>[Privacy contact]</Placeholder>.
        </P>
      </>
    ),
  },
];

export function CookiesPage() {
  return (
    <LegalLayout
      title="Cookies & Storage"
      intro="Exactly what Family Hub keeps in your browser, why it is needed, and how to clear it."
      sections={sections}
    />
  );
}
