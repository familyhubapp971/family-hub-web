import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card } from '@familyhub/ui';
import { signOutAll } from '../lib/auth-context';

// FHS-718: shown instead of a family page when the address is not one of the
// signed-in person's families. A family that does not exist and a family that
// is not theirs get exactly the same screen, so it never tells anyone whether
// a family is there.

interface FamilyNotFoundProps {
  /**
   * The person's family codes, first family first. An empty list means they
   * have no family yet. Null means we could not tell, so the button goes to
   * the step after sign-in, which works that out itself.
   */
  myFamilies: string[] | null;
}

export function FamilyNotFound({ myFamilies }: FamilyNotFoundProps) {
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const [signingOut, setSigningOut] = useState(false);
  const hasNoFamily = myFamilies !== null && myFamilies.length === 0;
  const home = myFamilies?.[0];
  // The same places sign-in sends people: their first family's home, or the
  // create-a-family step when they have none.
  const destination = home ? `/t/${home}/dashboard` : '/dashboard';

  // Screen readers start on the heading, so the news is read out first.
  useEffect(() => {
    heading.current?.focus();
  }, []);

  function switchAccount() {
    setSigningOut(true);
    void signOutAll().finally(() => navigate('/login', { replace: true }));
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-kingdom-bg px-4 py-10"
      data-testid="family-not-found"
    >
      <Card className="w-full max-w-md border-4 border-black bg-white p-6 text-center shadow-neo-lg sm:p-8">
        <h1
          ref={heading}
          tabIndex={-1}
          className="mb-2 font-display text-2xl text-kingdom-bg focus:outline-none sm:text-3xl"
        >
          We can&rsquo;t find that family.
        </h1>
        <p className="mb-6 font-body text-base text-gray-700">The link may be old or mistyped.</p>
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          className="min-h-[44px]"
          onClick={() => navigate(destination, { replace: true })}
          testId="family-not-found-go"
        >
          {hasNoFamily ? 'Create your family' : 'Go to my family'}
        </Button>
        {/* Signed in as the wrong person: sign out and start again. */}
        <button
          type="button"
          onClick={switchAccount}
          disabled={signingOut}
          data-testid="family-not-found-switch"
          className="mt-3 inline-flex min-h-[44px] items-center font-body text-sm font-bold text-purple-600 underline decoration-2 underline-offset-2 hover:text-purple-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-pastel-cyan disabled:opacity-60"
        >
          Use a different account
        </button>
      </Card>
    </main>
  );
}
