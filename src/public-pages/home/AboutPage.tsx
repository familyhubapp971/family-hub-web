import { Link, useNavigate } from 'react-router-dom';
import { Calendar, CheckSquare, Utensils, Star, ArrowRight } from 'lucide-react';
import { Button, FeatureCard } from '@familyhub/ui';
import { SiteHeader, SiteFooter, MAIN_CONTENT_ID } from '../SiteChrome';

// AboutPage: public /about route (FHS-436). A beta reviewer said it
// wasn't clear WHAT Family Hub is, WHO it's for, and its value. This
// page spells that out in plain language: what it is, who it's built
// for, the main things a family can do, and how the kid experience
// stays safe. Matches the marketing brand (kingdom-bg, neo-brutalist
// cards) used on WelcomePage/PricingPage/PrivacyPage.

const benefits = [
  {
    accentBar: 'border-l-pink-400',
    headerBg: 'bg-yellow-200',
    cardBg: 'bg-yellow-50',
    iconColor: 'text-pink-500',
    Icon: Calendar,
    title: 'A shared calendar',
    body: 'Every activity, every kid, in one view. No more "wait, whose turn is it to do pickup?"',
  },
  {
    accentBar: 'border-l-green-500',
    headerBg: 'bg-lime-200',
    cardBg: 'bg-lime-50',
    iconColor: 'text-green-600',
    Icon: CheckSquare,
    title: 'Tasks and habits that stick',
    body: 'Assign chores, track daily routines, and watch them get done without the nagging.',
  },
  {
    accentBar: 'border-l-orange-400',
    headerBg: 'bg-pink-200',
    cardBg: 'bg-pink-50',
    iconColor: 'text-orange-500',
    Icon: Utensils,
    title: 'Meal planning',
    body: 'Plan the week\'s meals together, so "what\'s for dinner?" stops being a daily crisis.',
  },
  {
    accentBar: 'border-l-blue-500',
    headerBg: 'bg-cyan-200',
    cardBg: 'bg-cyan-50',
    iconColor: 'text-blue-600',
    Icon: Star,
    title: "Kids' rewards and learning",
    body: 'Kids earn stars for habits and lessons (maths, logic, world flags), then save or spend them on rewards you set.',
  },
] as const;

export function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-kingdom-bg font-body text-white">
      {/* FHS-546: shared chrome so About matches the homepage + /legal
          (Legal link in the nav, full legal footer). */}
      <SiteHeader current="about" />

      <main
        id={MAIN_CONTENT_ID}
        className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-4 md:px-6 md:pt-8"
        data-testid="about-page"
      >
        {/* Hero: the plain "what is this" answer, up top. */}
        <section className="text-center">
          <h1 className="mb-3 font-heading text-3xl leading-tight text-yellow-300 md:text-5xl">
            One home for your family&rsquo;s week
          </h1>
          <p className="mx-auto max-w-2xl text-base font-bold text-purple-100 md:text-lg">
            Family Hub is the one shared place where your family plans the week, shares the load,
            and keeps everyone on the same page. Built for parents and kids.
          </p>
        </section>

        {/* Main things you can do: 4 pillars. */}
        <section
          className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2"
          aria-label="What you can do"
        >
          {benefits.map(({ accentBar, headerBg, cardBg, iconColor, Icon, title, body }) => (
            <FeatureCard
              key={title}
              icon={<Icon size={26} />}
              title={title}
              body={body}
              headerBg={headerBg}
              cardBg={cardBg}
              iconColor={iconColor}
              accentBar={accentBar}
            />
          ))}
        </section>

        {/* Who it's for + kid safety: prose sections, matching PrivacyPage's card style. */}
        <section className="mt-10 rounded-xl border-2 border-black bg-white p-6 text-gray-900 shadow-neo-lg md:p-10">
          <div className="space-y-8">
            <div>
              <h2 className="mb-2 font-heading text-xl md:text-2xl">Who it&rsquo;s for</h2>
              <p className="max-w-prose font-body text-base leading-relaxed">
                Family Hub is built for busy parents with school-age kids who want less mental load
                and more time together. Parents run the account and set everything up. Kids get
                their own fun, safe space to see their day, tick off habits, and learn.
              </p>
            </div>

            <div>
              <h2 className="mb-2 font-heading text-xl md:text-2xl">
                The kid experience, and how we keep it safe
              </h2>
              <p className="mb-3 max-w-prose font-body text-base leading-relaxed">
                A child never signs up on their own. A parent creates each kid&rsquo;s profile,
                picks their avatar, and sets a simple PIN so the kid can log in on a shared device.
                Everything a kid does (habits, lessons, rewards) is visible to the parent, who can
                view, edit, or remove it at any time.
              </p>
              <p className="max-w-prose font-body text-base leading-relaxed">
                We keep children&rsquo;s data to the minimum needed to run these features. Read the
                full details in our{' '}
                <Link to="/privacy" className="font-bold underline hover:text-purple-700">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-10 text-center">
          <Button
            onClick={() => navigate('/signup')}
            variant="primary"
            size="lg"
            className="inline-flex items-center gap-2 px-6 py-3 text-base md:text-lg"
          >
            Start free
            <ArrowRight size={18} strokeWidth={3} aria-hidden="true" />
          </Button>
          <p className="mt-4">
            <Link
              to="/pricing"
              className="inline-flex min-h-[44px] items-center px-2 font-bold text-purple-100 underline transition-colors hover:text-yellow-300"
            >
              See pricing
            </Link>
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
