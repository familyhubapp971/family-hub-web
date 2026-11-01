import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SiteFooter, SiteHeader, MAIN_CONTENT_ID } from '../SiteChrome';

// LegalIndexPage: /legal (FHS-509). Forensic port of the Magic
// Patterns design (7f19f840-c796-4eaa-90fc-934fb4ef587d,
// pages/legal/LegalIndex.tsx): four cards linking to the Privacy,
// Children & Parents, Terms and Cookies pages. Copy (blurbs,
// [placeholder] markers) is verbatim.

const PAGES = [
  {
    to: '/legal/privacy',
    title: 'Privacy Policy',
    blurb: 'What we collect, why, who else sees it, how long we keep it and your rights.',
    accent: 'bg-purple-300',
  },
  {
    to: '/legal/children',
    title: 'Children & Parents',
    blurb: 'A plain guide to your child’s data and every control you have over it.',
    accent: 'bg-yellow-300',
  },
  {
    to: '/legal/terms',
    title: 'Terms of Service',
    blurb: 'The rules of use, what an admin is responsible for, and why rewards are play money.',
    accent: 'bg-cyan-300',
  },
  {
    to: '/legal/cookies',
    title: 'Cookies & Storage',
    blurb: 'What sits in your browser. Sign-in only, with no advertising trackers.',
    accent: 'bg-pink-300',
  },
];

export function LegalIndexPage() {
  return (
    <div className="flex min-h-screen flex-col bg-kingdom-bg font-body text-white">
      <SiteHeader current="legal" />

      <main id={MAIN_CONTENT_ID} className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="font-heading text-3xl sm:text-4xl">Legal</h1>
        <p className="mt-3 max-w-xl font-bold leading-relaxed text-purple-200">
          Short, honest documents written for parents rather than lawyers. Last updated [Effective
          date].
        </p>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {PAGES.map((page) => (
            <Link
              key={page.to}
              to={page.to}
              className="flex flex-col rounded-xl border-2 border-black bg-white p-5 text-black shadow-neo-sm transition-transform motion-safe:hover:-translate-y-1"
            >
              <span className={`mb-4 h-3 w-12 rounded-full border-2 border-black ${page.accent}`} />
              <h2 className="font-heading text-2xl leading-tight">{page.title}</h2>
              <p className="mt-2 flex-1 text-sm font-bold text-gray-500">{page.blurb}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold">
                Read <ArrowRight size={16} strokeWidth={3} />
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-10 text-sm font-bold leading-relaxed text-purple-300">
          Family Hub is operated by [Legal entity name]. General questions go to [Contact email];
          privacy requests go to [Privacy contact].
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
