import { H3, LegalLayout, List, Note, P, Placeholder, type LegalSection } from './LegalLayout';

// TermsOfServicePage: /legal/terms (FHS-509). Forensic port of the
// Magic Patterns design (7f19f840-c796-4eaa-90fc-934fb4ef587d,
// pages/legal/Terms.tsx). Every heading, plain-English summary, bullet
// list and [placeholder] below is the founder's placeholder copy
// pending legal review: verbatim, not paraphrased.

const sections: LegalSection[] = [
  {
    id: 'agreement',
    title: 'This agreement',
    summary: 'Using Family Hub means you accept these terms on behalf of your household.',
    body: (
      <>
        <P>
          These terms are between you and <Placeholder>[Legal entity name]</Placeholder>. Creating a
          hub means you accept them for your household and everyone you add to it.
        </P>
        <P>
          If you do not agree, please do not use the service. Contact us at{' '}
          <Placeholder>[Contact email]</Placeholder>.
        </P>
      </>
    ),
  },
  {
    id: 'accounts',
    title: 'Accounts and sign-in',
    summary: 'Grown-ups sign in by email link, children sign in with a PIN set by a parent.',
    body: (
      <>
        <List
          items={[
            'You must be 18 or older, or the legal age of majority where you live, to create a family hub.',
            'We sign grown-ups in with a one-time link sent to their email, so keep that inbox secure.',
            'Children and teens do not have email logins. They tap their avatar and enter a 4-digit PIN chosen by an admin.',
            'A PIN protects a view on a shared family device. It is not a high-security credential, so do not store anything sensitive in a child profile.',
            'Tell us promptly if you think someone has access to your hub who should not.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'admin',
    title: 'The family admin',
    summary:
      'The admin runs the hub and is responsible for who they add and what those people can see.',
    body: (
      <>
        <P>
          Whoever creates the hub becomes its admin and can promote other adults. Admins hold real
          power over the household&apos;s data.
        </P>
        <H3>An admin confirms that they</H3>
        <List
          items={[
            'Are the parent or guardian of every child they add, or have permission from one.',
            'Have the right to invite each adult they invite.',
            'Will only share read-only calendar links with people they trust.',
            'Will keep the family list accurate and remove people who no longer belong.',
          ]}
        />
        <P>
          Children and teens can never be given admin access, and a hub must always keep at least
          one admin.
        </P>
      </>
    ),
  },
  {
    id: 'rewards',
    title: 'Virtual rewards are play money',
    summary:
      'Stars and balances are a parenting tool inside the app. They have no cash value and cannot be bought or cashed out.',
    body: (
      <>
        <Note>
          Family Hub is not a bank, wallet or payment service. No real money moves through the app.
        </Note>
        <List
          items={[
            'Stars, balances and any currency figure a parent sets are pretend values used to motivate children.',
            'They cannot be purchased, topped up, redeemed, withdrawn, transferred between families, or exchanged for anything from us.',
            'A parent decides what a star is worth, what habits pay more, and whether anything is deducted. Those choices are yours, not ours.',
            'Any pocket money that actually changes hands is a private matter between a parent and their child, arranged outside the app.',
            'Balances may be adjusted or reset by an admin, and are deleted with the hub.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    summary: 'Use it for your own family, keep it kind, and do not attack or abuse the service.',
    body: (
      <>
        <H3>Please do not</H3>
        <List
          items={[
            'Use the service to bully, frighten, shame or punish a child.',
            'Upload unlawful, hateful or sexual content, or anything unsuitable for a child to see.',
            'Add a child you are not responsible for.',
            'Try to access another family’s hub, probe our systems, or get around security limits.',
            'Scrape, resell or rebrand the service, or use it to build a competing product.',
            'Rely on the Learn area as a substitute for schooling, medical, legal or financial advice.',
          ]}
        />
        <P>
          Learn is AI-assisted and can get things wrong. Treat it as a helper and keep a grown-up in
          the loop.
        </P>
      </>
    ),
  },
  {
    id: 'content',
    title: 'Your content',
    summary: 'Your family’s content stays yours. We only use it to run the service for you.',
    body: (
      <>
        <P>
          You keep ownership of everything your family adds, and give us only the permission needed
          to store, display and back it up. You are responsible for what your household adds,
          including anything an adult adds about a child.
        </P>
      </>
    ),
  },
  {
    id: 'availability',
    title: 'Availability and changes',
    summary:
      'We improve the app continuously and will give notice before removing something you rely on.',
    body: (
      <>
        <P>
          We may add, change or retire features, and will email the admin before removing anything
          significant. We cannot promise the service will never be interrupted for maintenance or
          reasons outside our control.
        </P>
      </>
    ),
  },
  {
    id: 'termination',
    title: 'Ending your use',
    summary:
      'You can delete your hub whenever you like. We only suspend accounts for serious reasons.',
    body: (
      <>
        <List
          items={[
            'An admin can delete individual members or the entire hub at any time from Manage family.',
            'Deleting the hub removes your family’s content from the live service, and from backups within 30 days.',
            'We may suspend or close a hub that breaks these terms, puts a child at risk, or threatens the security of the service.',
            'Where it is safe and lawful to do so, we will warn you first and give you a chance to export your data.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'liability',
    title: 'Disclaimers and liability',
    summary: 'The app is provided as-is, and our liability is limited to what the law allows.',
    body: (
      <>
        <P>
          Family Hub is provided &quot;as is&quot;. To the extent the law allows, we exclude implied
          warranties and are not liable for indirect loss, lost data beyond our control, or disputes
          within a household.
        </P>
        <P>
          Nothing here limits liability that cannot legally be limited. Where it can be, it is
          capped at the greater of what you paid us in the last 12 months or{' '}
          <Placeholder>[Liability cap]</Placeholder>.
        </P>
      </>
    ),
  },
  {
    id: 'law',
    title: 'Governing law',
    summary: 'These terms follow the law of [Governing law / country].',
    body: (
      <>
        <P>
          Governed by the laws of <Placeholder>[Governing law / country]</Placeholder>, with
          disputes handled by the courts there. Consumers keep their local law rights. Questions:{' '}
          <Placeholder>[Contact email]</Placeholder>.
        </P>
      </>
    ),
  },
];

export function TermsOfServicePage() {
  return (
    <LegalLayout
      title="Terms of Service"
      intro="The ground rules for using Family Hub, what an admin takes responsibility for, and why virtual rewards are play money."
      sections={sections}
    />
  );
}
