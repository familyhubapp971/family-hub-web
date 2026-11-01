import { useState } from 'react';
import { Globe, BookOpen, Trophy } from 'lucide-react';
import { WorldFlagsExplore } from './WorldFlagsExplore';
import { WorldFlagsPath } from './WorldFlagsPath';
import { WorldFlagsCertificates } from './WorldFlagsCertificates';

// World Flags subject: three sub-tabs:
//  • Explore: free-browse flashcards (flag image → name → facts + map).
//  • Learn: structured path: study 5-country sets, then a quiz.
//  • Certificates: per-continent certs + 60-second timed quizzes.

type SubTab = 'explore' | 'learn' | 'certificates';

// FHS-397: legacy parity: a compact right-aligned pill row, per-tab gradient
// active state, icon-only trophy. Order matches the legacy (Learn, Explore, Awards).
const SUB_TABS: {
  id: SubTab;
  label: string;
  icon: React.ReactNode;
  /** active-state gradient + text colour, per the legacy. */
  activeClass: string;
  /** Awards is icon-only in the legacy. */
  iconOnly?: boolean;
}[] = [
  {
    id: 'learn',
    label: 'Learn',
    icon: <BookOpen size={16} aria-hidden="true" />,
    activeClass: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-black',
  },
  {
    id: 'explore',
    label: 'Explore',
    icon: <Globe size={16} aria-hidden="true" />,
    activeClass: 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-black',
  },
  {
    id: 'certificates',
    label: 'Awards',
    icon: <Trophy size={16} aria-hidden="true" />,
    activeClass: 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black border-black',
    iconOnly: true,
  },
];

// Exactly one of memberId / kidToken is supplied (never both).
type WorldFlagsProps =
  | { memberId: string; kidToken?: undefined }
  | { kidToken: string; memberId?: undefined };

export function WorldFlags({ memberId, kidToken }: WorldFlagsProps) {
  const [tab, setTab] = useState<SubTab>('learn');

  const subProps = kidToken ? { kidToken } : { memberId: memberId! };

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-tab switcher: compact right-aligned pill row (legacy parity, FHS-397) */}
      <div
        role="tablist"
        aria-label="World Flags modes"
        className="flex items-center justify-end gap-2"
      >
        {SUB_TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              aria-label={t.iconOnly ? t.label : undefined}
              data-testid={`world-subtab-${t.id}`}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex min-h-[44px] items-center gap-1.5 rounded-full border-2 px-3 py-2 text-xs font-black transition-all motion-safe:hover:-translate-y-0.5 ${
                active ? `${t.activeClass} shadow-neo-xs` : 'border-gray-200 bg-white text-gray-400'
              }`}
            >
              {t.icon}
              {!t.iconOnly && <span>{t.label}</span>}
            </button>
          );
        })}
      </div>

      {tab === 'explore' && <WorldFlagsExplore {...subProps} />}
      {tab === 'learn' && <WorldFlagsPath {...subProps} />}
      {tab === 'certificates' && <WorldFlagsCertificates {...subProps} />}
    </div>
  );
}
