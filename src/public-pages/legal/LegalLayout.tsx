import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { SiteFooter, SiteHeader, MAIN_CONTENT_ID } from '../SiteChrome';

// LegalLayout: shared shell for every /legal/* page (FHS-509). Ported
// forensically from the Magic Patterns design
// (7f19f840-c796-4eaa-90fc-934fb4ef587d, components/LegalLayout.tsx):
// same title card, pill nav between the four legal pages, sticky
// "On this page" table of contents, and numbered sections with a
// highlighted plain-English summary above the legal detail. The
// "[Legal entity name]", "[Effective date]" etc. placeholders are the
// founder's placeholder copy pending legal review: kept verbatim.

export type LegalSection = {
  id: string;
  title: string;
  /** One line of plain English shown above the detail. */
  summary: string;
  body: ReactNode;
};

export const LEGAL_PAGES = [
  { to: '/legal/privacy', label: 'Privacy Policy' },
  { to: '/legal/children', label: 'Children & Parents' },
  { to: '/legal/terms', label: 'Terms of Service' },
  { to: '/legal/cookies', label: 'Cookies & Storage' },
];

export function LegalLayout({
  title,
  intro,
  updated = '[Effective date]',
  sections,
}: {
  title: string;
  intro: string;
  updated?: string;
  sections: LegalSection[];
}) {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-screen flex-col bg-kingdom-bg font-body text-white">
      <SiteHeader current="legal" />

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <Link
          to="/legal"
          className="mb-3 inline-flex min-h-[44px] items-center gap-2 text-sm font-bold text-purple-200 hover:text-yellow-300"
        >
          <ArrowLeft size={16} strokeWidth={3} /> Legal
        </Link>

        {/* title block */}
        <div className="rounded-xl border-2 border-black bg-white p-5 text-black shadow-neo-sm sm:p-6">
          <h1 className="font-heading text-3xl text-black sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm font-bold text-gray-600">{intro}</p>
          <p className="mt-3 text-xs font-bold uppercase tracking-widest text-gray-400">
            Last updated {updated}
          </p>

          <nav className="mt-4 flex flex-wrap gap-2" aria-label="Legal pages">
            {LEGAL_PAGES.map((page) => (
              <Link
                key={page.to}
                to={page.to}
                className={`flex min-h-[44px] items-center rounded-full border-2 border-black px-3.5 text-sm font-bold transition-transform motion-safe:hover:-translate-y-0.5 ${
                  pathname === page.to
                    ? 'bg-kingdom-bg text-white shadow-neo-xs'
                    : 'bg-white text-black hover:bg-gray-50'
                }`}
              >
                {page.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
          {/* table of contents */}
          <aside className="w-full self-start lg:sticky lg:top-6">
            <div className="overflow-hidden rounded-xl border-2 border-black bg-white text-black shadow-neo-sm">
              <p className="border-b-2 border-black bg-yellow-300 px-4 py-2 font-heading text-sm uppercase tracking-widest text-black">
                On this page
              </p>
              <ol className="p-1.5">
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById(section.id)
                          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }
                      className="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm font-bold text-gray-600 hover:bg-gray-100 hover:text-black"
                    >
                      <span className="text-gray-400">{index + 1}.</span>
                      {section.title}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </aside>

          {/* body */}
          <main id={MAIN_CONTENT_ID} className="min-w-0">
            <div className="divide-y-2 divide-dashed divide-gray-200 rounded-xl border-2 border-black bg-white text-black shadow-neo-sm">
              {sections.map((section, index) => (
                <section key={section.id} id={section.id} className="scroll-mt-6 p-5 sm:p-6">
                  <h2 className="font-heading text-xl text-black sm:text-2xl">
                    <span className="mr-2 text-gray-300">{index + 1}.</span>
                    {section.title}
                  </h2>

                  <p
                    data-testid="legal-section-summary"
                    className="mt-2 rounded-r-lg border-l-4 border-kingdom-bg bg-purple-50 px-3 py-2 text-sm font-bold text-kingdom-bg"
                  >
                    {section.summary}
                  </p>

                  <div className="legal-body mt-3 space-y-3 text-sm leading-relaxed text-gray-800">
                    {section.body}
                  </div>
                </section>
              ))}
            </div>

            <p className="mt-4 text-xs font-bold text-purple-300">
              Plain English, not legal advice. [Legal entity name] should have it reviewed before
              launch.
            </p>
          </main>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

/* Small helpers so the page files stay readable. */

export function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="pt-1 font-heading text-base text-black">{children}</h3>;
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-1.5 pl-1">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2.5">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-black" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border-2 border-black bg-yellow-100 px-3 py-2 text-sm font-bold">
      {children}
    </div>
  );
}

export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <span className="whitespace-nowrap rounded-md border-2 border-black bg-pink-100 px-1.5 py-0.5 text-[13px] font-bold">
      {children}
    </span>
  );
}
