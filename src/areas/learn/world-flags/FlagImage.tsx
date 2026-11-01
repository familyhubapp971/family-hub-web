import { useState } from 'react';
import { flagUrl, type FlagSize } from './shared';
import type { Country } from './countries';

// Real flag image from the flagcdn CDN, with a graceful fallback to the
// unicode emoji when the network image fails to load (offline, blocked CDN,
// or a code flagcdn doesn't serve). Keeps the card usable either way.

export function FlagImage({
  country,
  size = 'w320',
  className = '',
  emojiClassName = '',
}: {
  country: Country;
  size?: FlagSize;
  className?: string;
  emojiClassName?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        role="img"
        aria-label={`Flag of ${country.name}`}
        className={emojiClassName || 'text-7xl leading-none'}
      >
        {country.flag}
      </span>
    );
  }

  return (
    <img
      data-testid="world-flag-image"
      src={flagUrl(country.code, size)}
      alt={`Flag of ${country.name}`}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
