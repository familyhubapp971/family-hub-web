import { useMemo } from 'react';
import { SearchableSelect } from './SearchableSelect';
import { isSupportedCurrency } from '@familyhub/shared';

// FHS-39: Currency picker. 30 curated currencies (ISO 4217 code +
// symbol + name). Default inferred from navigator.language via the
// Intl.NumberFormat parts API.

export interface CurrencyPickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  testId?: string;
  /** `id` for the trigger button, pair with a sibling `<label htmlFor>`. */
  id?: string;
}

interface CurrencyEntry {
  code: string;
  symbol: string;
  name: string;
}

/**
 * FHS-515: decimal places for an ISO-4217 currency (JPY→0, USD→2, KWD→3);
 * 2 on any bad/unknown code. Node + browsers ship full ICU, so this is
 * reliable in tests too.
 */
// FHS-636: re-exported from the shared money module so the app and the api
// answer "can we show this currency?" with the same function, not two copies.
export { currencyDecimals } from '@familyhub/shared';

// Curated list: covers the ticket's named examples (GBP, USD, EUR, NGN,
// AED) plus the rest of the top-30 by global GDP. Order keeps frequent
// pickers near the top before alphabetical fall-through.
const ALL_CURRENCIES: readonly CurrencyEntry[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
];

// FHS-515: the sticker economy hardcodes 2-decimal money math (centi-unit
// storage, ÷100 display, quarter-unit stepper). A 0-decimal (JPY, KRW) or
// 3-decimal (KWD) currency would show wrong figures and a wrong stepper, so
// until full multi-decimal support lands we only OFFER 2-decimal currencies:
// no family can end up on a currency the money math can't render correctly.
const CURRENCIES: readonly CurrencyEntry[] = ALL_CURRENCIES.filter((c) =>
  isSupportedCurrency(c.code),
);

/**
 * Best-effort currency detection from the browser's locale. Uses
 * `Intl.Locale(locale).maximize().region` to get a 2-letter region
 * code (e.g. `zh` → `zh-Hans-CN` → `CN`) and looks it up in the
 * REGION_TO_CURRENCY map below. Falls back to USD on any failure.
 *
 * Returns one of CURRENCIES[].code so the caller can hand it straight
 * to onChange without an extra lookup.
 */
export function detectBrowserCurrency(): string {
  const knownCodes = new Set(CURRENCIES.map((c) => c.code));

  // FHS-570: the timezone comes first because it says where the family
  // LIVES, and where you live decides what you spend. Language only says
  // what your browser is set to: an English-speaking family in Dubai
  // reports en-GB or en-US and used to be handed pounds or dollars while
  // the very same screen showed their timezone as Asia/Dubai.
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    const region = TIMEZONE_TO_REGION[tz];
    const fromZone = region ? REGION_TO_CURRENCY[region] : undefined;
    if (fromZone && knownCodes.has(fromZone)) return fromZone;
  } catch {
    // fall through to the language guess
  }

  try {
    const locale = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
    const region = new Intl.Locale(locale).maximize().region ?? '';
    const fromRegion = REGION_TO_CURRENCY[region];
    if (fromRegion && knownCodes.has(fromRegion)) return fromRegion;
  } catch {
    // fall through
  }
  return 'USD';
}

// Timezone→region for every region in REGION_TO_CURRENCY below. Only the
// zones a real family is plausibly in: this is a preselection, and the
// picker is one tap away, so an unlisted zone simply falls through to the
// language guess rather than pretending to know.
const TIMEZONE_TO_REGION: Record<string, string> = {
  // Gulf + wider Middle East
  'Asia/Dubai': 'AE',
  'Asia/Riyadh': 'SA',
  'Asia/Qatar': 'AE',
  'Asia/Bahrain': 'AE',
  'Asia/Kuwait': 'SA',
  'Asia/Muscat': 'AE',
  'Asia/Istanbul': 'TR',
  'Europe/Istanbul': 'TR',
  // South + South-East Asia
  'Asia/Karachi': 'PK',
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'Asia/Colombo': 'IN',
  'Asia/Dhaka': 'IN',
  'Asia/Jakarta': 'ID',
  'Asia/Kuala_Lumpur': 'MY',
  'Asia/Bangkok': 'TH',
  'Asia/Singapore': 'SG',
  'Asia/Hong_Kong': 'HK',
  'Asia/Seoul': 'KR',
  'Asia/Tokyo': 'JP',
  'Asia/Shanghai': 'CN',
  // Africa
  'Africa/Lagos': 'NG',
  'Africa/Accra': 'GH',
  'Africa/Nairobi': 'KE',
  'Africa/Cairo': 'EG',
  'Africa/Johannesburg': 'ZA',
  // Europe
  'Europe/London': 'GB',
  'Europe/Dublin': 'IE',
  'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE',
  'Europe/Madrid': 'ES',
  'Europe/Rome': 'IT',
  'Europe/Amsterdam': 'NL',
  'Europe/Brussels': 'BE',
  'Europe/Vienna': 'AT',
  'Europe/Lisbon': 'PT',
  'Europe/Athens': 'GR',
  'Europe/Helsinki': 'FI',
  'Europe/Zurich': 'CH',
  'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO',
  'Europe/Copenhagen': 'DK',
  // Americas + Oceania
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Phoenix': 'US',
  'America/Los_Angeles': 'US',
  'America/Anchorage': 'US',
  'Pacific/Honolulu': 'US',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'America/Edmonton': 'CA',
  'America/Winnipeg': 'CA',
  'America/Halifax': 'CA',
  'America/Mexico_City': 'MX',
  'America/Sao_Paulo': 'BR',
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Australia/Brisbane': 'AU',
  'Australia/Perth': 'AU',
  'Australia/Adelaide': 'AU',
  'Pacific/Auckland': 'NZ',
};

// Region→default-currency map for the curated set. Keep aligned with
// CURRENCIES, anything not here defaults to USD.
const REGION_TO_CURRENCY: Record<string, string> = {
  US: 'USD',
  GB: 'GBP',
  AE: 'AED',
  NG: 'NGN',
  CA: 'CAD',
  AU: 'AUD',
  JP: 'JPY',
  CN: 'CNY',
  IN: 'INR',
  PK: 'PKR',
  SA: 'SAR',
  ZA: 'ZAR',
  EG: 'EGP',
  KE: 'KES',
  GH: 'GHS',
  CH: 'CHF',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  NZ: 'NZD',
  SG: 'SGD',
  HK: 'HKD',
  KR: 'KRW',
  BR: 'BRL',
  MX: 'MXN',
  TR: 'TRY',
  ID: 'IDR',
  MY: 'MYR',
  TH: 'THB',
  // Eurozone members all map to EUR.
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  NL: 'EUR',
  IE: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  PT: 'EUR',
  GR: 'EUR',
  FI: 'EUR',
};

export function CurrencyPicker({ value, onChange, className, testId, id }: CurrencyPickerProps) {
  const options = useMemo(
    () =>
      CURRENCIES.map((c) => ({
        value: c.code,
        label: `${c.code} ${c.symbol}`,
        secondary: c.name,
      })),
    [],
  );

  return (
    <SearchableSelect
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Pick a currency"
      searchPlaceholder="Search code, symbol, or name…"
      {...(className ? { className } : {})}
      {...(testId ? { testId } : {})}
      {...(id ? { id } : {})}
      ariaLabel="Currency"
    />
  );
}
