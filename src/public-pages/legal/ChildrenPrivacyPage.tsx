import { Link } from 'react-router-dom';
import { H3, LegalLayout, List, Note, P, Placeholder, type LegalSection } from './LegalLayout';

// ChildrenPrivacyPage: /legal/children (FHS-509). Forensic port of the
// Magic Patterns design (7f19f840-c796-4eaa-90fc-934fb4ef587d,
// pages/legal/ChildrenPrivacy.tsx). Every heading, plain-English
// summary, bullet list and [placeholder] below is the founder's
// placeholder copy pending legal review: verbatim, not paraphrased.

const sections: LegalSection[] = [
  {
    id: 'promise',
    title: 'Our promise to families',
    summary: 'Kids use Family Hub, but a parent sets it up, controls it, and can erase it.',
    body: (
      <>
        <P>
          The plain-English companion to our{' '}
          <Link to="/legal/privacy" className="underline font-bold">
            Privacy Policy
          </Link>
          , covering your child&apos;s data in one place.
        </P>
        <Note>
          No adverts. No tracking. No selling data. No public profiles. No way for a stranger to
          contact your child through Family Hub.
        </Note>
      </>
    ),
  },
  {
    id: 'how-kids-join',
    title: 'How a child joins',
    summary: 'Only an admin can add a child, and children never provide an email address.',
    body: (
      <>
        <List
          items={[
            'A parent or guardian adds the child from Manage family.',
            'The parent chooses the child’s first name or nickname and an avatar.',
            'The parent sets a 4-digit PIN. The child taps their avatar and enters that PIN to open their world.',
            'A child cannot sign themselves up, invite anyone, or change their own role.',
          ]}
        />
        <P>
          Adding a child confirms the admin is the parent or guardian, or has their permission. That
          is our parental consent step.
        </P>
      </>
    ),
  },
  {
    id: 'what-kids-see',
    title: 'What a child can and cannot do',
    summary:
      'Children see their own habits, stars and Learn area. They cannot change family settings.',
    body: (
      <>
        <H3>A child can</H3>
        <List
          items={[
            'Tick off their own habits and chores.',
            'See their stars, savings and progress.',
            'Ask a grown-up for a reward, which a parent must approve.',
            'Use the Learn area.',
            'Look back at their finished weeks.',
          ]}
        />
        <H3>A child cannot</H3>
        <List
          items={[
            'See or change money settings, family settings or other members’ accounts.',
            'Add or remove members.',
            'Be given admin access, by design.',
            'Message anyone, or be messaged by anyone outside the family.',
            'Make their information visible outside the hub.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'controls',
    title: 'Controls a parent has',
    summary: 'Rename, reset the PIN, wipe history, or delete the child entirely, at any time.',
    body: (
      <>
        <List
          items={[
            'Change a child’s name or avatar.',
            'Set or reset their 4-digit PIN.',
            'Adjust what a habit pays and whether anything is deducted.',
            'Approve or decline every reward request.',
            'Clear their history or delete the child profile, which removes their data from the live service.',
            'Export a copy of the family’s data before deleting anything.',
          ]}
        />
        <P>
          Need help? Contact <Placeholder>[Privacy contact]</Placeholder>.
        </P>
      </>
    ),
  },
  {
    id: 'learn-ai',
    title: 'The AI in the Learn area',
    summary: 'We send a topic and difficulty to an AI provider, never a child’s identity.',
    body: (
      <>
        <P>
          Learn uses an AI provider to create age-appropriate questions. We send only the subject
          and level.
        </P>
        <List
          items={[
            'We do not send a child’s full name, PIN, email or contact details.',
            'Learn content is not used to train public AI models.',
            'AI can make mistakes, so a parent should stay involved and review progress.',
            'Parents can see how their child is doing in Learning Insights, which is read-only.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'safety',
    title: 'Safety by design',
    summary: 'A closed family space with no open messaging, no public profiles and no strangers.',
    body: (
      <>
        <List
          items={[
            'Family Hub is closed. Only people an admin invites or adds can see anything.',
            'There is no open chat, friend list, comment feed or public profile.',
            'Read-only calendar links are optional, off by default, and can be switched off by an admin.',
            'Sign-in for grown-ups uses one-time email links, so there is no password for a child to find.',
            'PINs are stored hashed and only unlock a view on a device already signed in to your family.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'contact',
    title: 'Questions or concerns',
    summary: 'Contact us and we will verify you are the admin, then help quickly.',
    body: (
      <>
        <P>
          To see, correct, export or delete anything about your child, email{' '}
          <Placeholder>[Privacy contact]</Placeholder>. We confirm you are the admin, then act. You
          can also complain to the data protection authority in{' '}
          <Placeholder>[Governing law / country]</Placeholder>.
        </P>
      </>
    ),
  },
];

export function ChildrenPrivacyPage() {
  return (
    <LegalLayout
      title="Children & Parents"
      intro="A parent-friendly guide to exactly what Family Hub knows about your child, and the controls you have over it."
      sections={sections}
    />
  );
}
