import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@familyhub/ui';
import { getKidToken, useAuth } from '../lib/auth-context';
import { KidDashboardShell } from '../../areas/kids/KidDashboardShell';
import { GetStarted } from '../../areas/today/GetStarted';
import { TodayTabPanel } from '../../areas/today/TodayTabPanel';
import { MealsTabPanel } from '../../areas/meals/MealsTabPanel';
import { CalendarTabPanel } from '../../areas/calendar/CalendarTabPanel';
import { AssignmentsTabPanel } from '../../areas/assignments/AssignmentsTabPanel';
import { NoticeboardTabPanel } from '../../areas/noticeboard/NoticeboardTabPanel';
import { TasksTabPanel } from '../../areas/tasks/TasksTabPanel';
import { AppHeader } from './AppHeader';
import { TABS, DEFAULT_TAB } from './dashboard-tabs';

// FHS-227 + FHS-261: Parent Dashboard shell. Six tabs gated by the
// `?tab=<id>` URL query so deep-links + browser back-button work.
// Default tab = `home` (TodayTabPanel / FHS-228).
//
// FHS-401: Learning Insights tab removed from dashboard; relocated to
// each child's ChildWorldPage as the 5th tab.
//
// FHS-261 replaced the original header with FamilyHero + ProfilePill
// + per-tab badges. That header now lives in AppHeader (shared with
// AdminPanelPage and any future authenticated page).
//
// FHS-309: badge refresh on dashboard-stale signal lives in AppHeader.
// FHS-318: MealsTabPanel renders unwrapped (no white Card).

function isKnownTab(id: string | null): id is string {
  return id !== null && TABS.some((t) => t.id === id);
}

// FHS-257: the dashboard route is shared by parents (Supabase session)
// and kids (kid JWT). A kid token takes precedence so a child who just
// logged in gets the kid shell, never the parent surface.
export function DashboardPage() {
  const { session } = useAuth();
  const kidToken = getKidToken();
  if (kidToken && !session) return <KidDashboardShell />;
  return <ParentDashboard />;
}

function ParentDashboard() {
  const [params, setParams] = useSearchParams();

  const requested = params.get('tab');
  const activeTab = isKnownTab(requested) ? requested : DEFAULT_TAB;

  const onTabChange = useCallback(
    (tabId: string) => {
      const next = new URLSearchParams(params);
      if (tabId === DEFAULT_TAB) {
        next.delete('tab');
      } else {
        next.set('tab', tabId);
      }
      setParams(next, { replace: false });
    },
    [params, setParams],
  );

  const active = TABS.find((t) => t.id === activeTab)!;

  return (
    // No text-white on the page root: MP relies on default-black body text
    // inside the white cards; headings on the purple set text-white
    // themselves.
    <div className="flex min-h-screen flex-col bg-kingdom-bg font-body text-gray-900">
      <AppHeader activeTab={activeTab} onTabChange={onTabChange} />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-6">
        <section
          id={`panel-${active.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${active.id}`}
          data-testid={`dashboard-panel-${active.id}`}
        >
          {/* MP renders tab content straight on the kingdom-purple
              background (each tab brings its own cards). Rebuilt tabs
              (home, calendar) render that way: wrapping them in a white
              card would hide their white headings. Tabs not yet
              redesigned keep the white card until their own MP rebuild
              lands. */}
          {active.id === 'home' ? (
            <>
              {/* FHS-511: first-run setup guide above the Today content. */}
              <GetStarted />
              <TodayTabPanel />
            </>
          ) : active.id === 'calendar' ? (
            <CalendarTabPanel />
          ) : active.id === 'meals' ? (
            // FHS-318: Meals was redesigned (FHS-304) to render on the purple
            // page with its own white cards + white header text; the leftover
            // white Card wrapper made the header invisible (white-on-white).
            <MealsTabPanel />
          ) : (
            <Card className="bg-white p-6 text-gray-900 md:p-8">
              {active.id === 'assignments' ? (
                <AssignmentsTabPanel />
              ) : active.id === 'noticeboard' ? (
                <NoticeboardTabPanel />
              ) : active.id === 'tasks' ? (
                <TasksTabPanel />
              ) : (
                <PlaceholderPanel
                  label={active.label}
                  ticket={active.ticket}
                  description={active.description}
                />
              )}
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}

function PlaceholderPanel({
  label,
  ticket,
  description,
}: {
  label: string;
  ticket: string;
  description: string;
}) {
  return (
    <>
      <header className="mb-3 flex items-baseline justify-between">
        <h1
          className="font-heading text-2xl text-black md:text-3xl"
          data-testid="dashboard-panel-title"
        >
          {label}
        </h1>
        <span className="font-mono text-xs text-gray-500">{ticket}</span>
      </header>
      <p className="text-sm text-gray-700">{description}</p>
      <p className="mt-4 text-sm font-bold text-gray-600">Coming soon: tracked under {ticket}.</p>
    </>
  );
}
