import { useMemo } from 'react';
import { SearchableSelect } from './SearchableSelect';

// FHS-38: IANA timezone picker. Wraps SearchableSelect with the IANA
// list from `Intl.supportedValuesOf('timeZone')` (Node 18+/all evergreen
// browsers) and a small fallback for older runtimes that lack the API.

export interface TimezonePickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Override the IANA list (tests). */
  zones?: readonly string[];
  className?: string;
  testId?: string;
  /** `id` for the trigger button, pair with a sibling `<label htmlFor>`. */
  id?: string;
}

// Browser-detected timezone: used as the wizard's default before the
// user has picked one. Falls back to UTC for runtimes without Intl.
export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

// Static fallback for browsers that lack supportedValuesOf. Keeps the
// picker usable on stale Safari / WebView builds without crashing the
// wizard. Limited to common zones; the full list arrives once the
// runtime supports the modern API.
const FALLBACK_ZONES = [
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'America/Toronto',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Istanbul',
  'Africa/Lagos',
  'Africa/Johannesburg',
  'Africa/Cairo',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

function loadZones(): readonly string[] {
  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf?.('timeZone');
    if (supported && supported.length > 0) return supported;
  } catch {
    // fall through
  }
  return FALLBACK_ZONES;
}

export function TimezonePicker({
  value,
  onChange,
  zones,
  className,
  testId,
  id,
}: TimezonePickerProps) {
  const options = useMemo(() => {
    const list = zones ?? loadZones();
    const opts = list.map((zone) => ({ value: zone, label: zone }));
    // Defensive: if the current `value` (typically a browser-detected
    // IANA zone) isn't in the list, happens on older runtimes that
    // fall through to the static list, prepend it so the trigger
    // shows the right label and the user can re-select if they edit.
    if (value && !opts.some((o) => o.value === value)) {
      opts.unshift({ value, label: value });
    }
    return opts;
  }, [zones, value]);

  return (
    <SearchableSelect
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Pick a timezone"
      searchPlaceholder="Search zones (e.g. dubai)…"
      {...(className ? { className } : {})}
      {...(testId ? { testId } : {})}
      {...(id ? { id } : {})}
      ariaLabel="Timezone"
    />
  );
}
