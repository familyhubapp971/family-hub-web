import { H3, LegalLayout, List, Note, P, Placeholder, type LegalSection } from './LegalLayout';

// PrivacyPolicyPage: /legal/privacy (FHS-509). Forensic port of the
// Magic Patterns design (7f19f840-c796-4eaa-90fc-934fb4ef587d,
// pages/legal/Privacy.tsx). Every heading, plain-English summary,
// bullet list and [placeholder] below is the founder's placeholder
// copy pending legal review: verbatim, not paraphrased.

const sections: LegalSection[] = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    summary:
      'Family Hub is a private organiser for one family at a time, run by [Legal entity name].',
    body: (
      <>
        <P>
          Family Hub helps a household track habits, chores, meals and a shared calendar. Each
          family gets its own private hub, invisible to other families.
        </P>
        <P>
          Provided by <Placeholder>[Legal entity name]</Placeholder>. Privacy questions:{' '}
          <Placeholder>[Privacy contact]</Placeholder>.
        </P>
      </>
    ),
  },
  {
    id: 'what-we-collect',
    title: 'What we collect',
    summary:
      'The email of the grown-up who signs up, whatever your family adds to the hub, and basic technical logs.',
    body: (
      <>
        <H3>From the grown-up who signs up</H3>
        <List
          items={[
            'Email address. This is how you sign in, because we use a magic link instead of a password.',
            'Display name, so the rest of the family knows who is who.',
            'The name you give your family hub.',
          ]}
        />

        <H3>What your family puts in the hub</H3>
        <List
          items={[
            'Members you add: first names, chosen avatar and role.',
            'Habits, chores and who they belong to.',
            'Calendar events, including recurring ones.',
            'Meal plans.',
            'Reward settings and virtual balances.',
            'Anything typed into the Learn area.',
          ]}
        />

        <H3>Technical information</H3>
        <List
          items={[
            'Sign-in records, so we can keep your account secure and spot abuse.',
            'Basic error and performance logs from our hosting provider.',
          ]}
        />

        <Note>
          No adverts, no ad trackers, no analytics profiles, and we never sell or rent personal
          information.
        </Note>
      </>
    ),
  },
  {
    id: 'why',
    title: 'Why we use it',
    summary:
      'Only to run the app for your family, keep it secure, and support you when something breaks.',
    body: (
      <>
        <List
          items={[
            'To create your hub and let members sign in.',
            'To show the right habits, chores, meals and events to the right people.',
            'To send the small number of emails the service needs: sign-in links, invitations and important service notices.',
            'To keep accounts secure and investigate misuse.',
            'To fix bugs and improve the product.',
          ]}
        />
        <P>
          Our legal basis is the contract with you, plus our legitimate interest in keeping the
          service safe. Any consent can be withdrawn at any time.
        </P>
      </>
    ),
  },
  {
    id: 'children',
    title: "Children's privacy",
    summary:
      'A parent creates and controls every child profile. We collect the minimum about kids and never advertise to them.',
    body: (
      <>
        <P>
          Children use Family Hub, but a parent always sets it up and controls it. A child cannot
          create an account, invite anyone, or make their data public.
        </P>

        <H3>What we hold about a child</H3>
        <List
          items={[
            'A first name or nickname chosen by the parent.',
            'An avatar or colour.',
            'A 4-digit PIN, stored in a hashed form, used only to unlock their view on a family device.',
            'Their habits, chores and completion history.',
            'Their virtual reward balance.',
            'Learn activity, such as topics attempted and scores.',
          ]}
        />

        <H3>What we never ask a child for</H3>
        <List
          items={[
            'An email address or phone number.',
            'A home address or precise location.',
            'A photo, unless a parent chooses to upload an avatar.',
            'Any payment information.',
          ]}
        />

        <H3>Parental consent and control</H3>
        <P>
          Adding a child confirms the admin is their parent or guardian, or has permission. An admin
          can rename a child, reset their PIN, clear their history, or delete the profile at any
          time.
        </P>

        <Note>No advertising, profiling or selling of children&apos;s data. Ever.</Note>

        <H3>The Learn area</H3>
        <P>
          Learn sends only a topic and difficulty to an AI provider, never a child&apos;s name, PIN
          or contact details. Learn content is not used to train public models.
        </P>
      </>
    ),
  },
  {
    id: 'sharing',
    title: 'Who else can see it',
    summary:
      'Only your own family members, plus a short list of service providers who help us run the app.',
    body: (
      <>
        <H3>Inside your family</H3>
        <P>
          What a member sees depends on their role. Admins see everything, adults see day-to-day
          information, teens and guests can look but not change things, and children see only their
          own world.
        </P>

        <H3>Shareable calendar links</H3>
        <P>
          Anyone with a read-only calendar link can see those events without signing in. Treat it
          like a public web address. An admin can switch it off at any time.
        </P>

        <H3>Our providers</H3>
        <List
          items={[
            'Supabase, for the database and sign-in.',
            'Resend, for sending sign-in links and invitations.',
            'Railway, for hosting the app.',
            'An AI provider, used only to generate content in the Learn area.',
          ]}
        />
        <P>
          They process data on our instructions only. We also disclose information if the law
          requires it, or to protect someone&apos;s safety.
        </P>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    summary:
      'While your hub is active, then a short grace period after deletion before it is permanently erased.',
    body: (
      <>
        <List
          items={[
            'Active hub: we keep your content for as long as the hub exists, so your history and streaks stay intact.',
            'Deleting a member: their profile and personal content leave the live service straight away.',
            'Deleting the whole hub: we remove it from the live service immediately and purge it from backups within 30 days.',
            'Inactive hubs: if nobody signs in for 24 months, we will email the admin and then delete the hub.',
            'Security logs: kept for a limited period for fraud and abuse investigation.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'rights',
    title: 'Your rights',
    summary:
      'You can see, export, correct or delete your family data, including a child’s, at any time.',
    body: (
      <>
        <List
          items={[
            'Access: ask for a copy of what we hold.',
            'Export: download your hub content in a portable format.',
            'Correction: fix anything wrong, mostly directly in the app.',
            'Deletion: remove a member or the entire hub.',
            'Objection and restriction: ask us to stop certain processing.',
            'Complaint: raise a concern with your local data protection authority.',
          ]}
        />
        <P>
          A parent can exercise these on behalf of their child. Contact{' '}
          <Placeholder>[Privacy contact]</Placeholder> and we will verify you are the admin first.
        </P>
      </>
    ),
  },
  {
    id: 'security',
    title: 'How we protect it',
    summary: 'Encryption in transit, per-family isolation, hashed PINs and passwordless sign-in.',
    body: (
      <>
        <List
          items={[
            'All traffic is encrypted in transit.',
            'Each family hub is isolated so one family can never read another.',
            'Sign-in uses one-time email links, so there is no password to leak.',
            'Child PINs are stored hashed and only unlock a view on a device that is already signed in to your family.',
            'Access to production data is limited to the people who need it to run the service.',
          ]}
        />
        <P>
          No service is perfectly secure. If a breach affects your family, we will tell the admin
          promptly.
        </P>
      </>
    ),
  },
  {
    id: 'transfers-changes',
    title: 'Transfers, changes and contact',
    summary:
      'Data may be processed abroad with safeguards, and we will tell you before meaningful policy changes.',
    body: (
      <>
        <P>
          Providers may process data abroad under recognised safeguards such as standard contractual
          clauses. If we make a change that meaningfully affects your family, we email the admin
          first.
        </P>
        <P>
          Questions or complaints: <Placeholder>[Privacy contact]</Placeholder> or{' '}
          <Placeholder>[Contact email]</Placeholder>.
        </P>
      </>
    ),
  },
];

export function PrivacyPolicyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      intro="What Family Hub collects, why, and how a parent stays in control of everything about their children."
      sections={sections}
    />
  );
}
