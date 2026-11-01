// FHS-670: per-screen feedback. Each signed-in parent screen asks the
// homepage survey's questions about itself, and lists its own features so a
// parent can say which part they mean. Feature names are the labels the
// screen actually shows, so the export reads in the parent's words.

export interface ScreenFeedbackConfig {
  /** Stored on every answer; the export sorts and groups on it. */
  key: string;
  /** Slots into the questions: "How easy is {area} to use?" */
  area: string;
  features: string[];
  wishExample: string;
  /** The screen has its own bar fixed to the bottom, so the button sits above it. */
  raised?: boolean;
}

const SCREENS: Record<string, ScreenFeedbackConfig> = {
  home: {
    key: 'home',
    area: 'the Family Dashboard',
    features: ["Today's Snapshot", 'Family Goals', 'Recent Activity', 'Getting started guide'],
    wishExample: 'A morning summary of the day for the whole family…',
  },
  calendar: {
    key: 'calendar',
    area: 'the Calendar',
    features: [
      'School and home calendars',
      'Filter by member',
      'Add activity',
      'Sync to your calendar',
    ],
    wishExample: 'A reminder the evening before each activity…',
  },
  meals: {
    key: 'meals',
    area: 'Weekly Meals',
    features: ['Add meal', 'Add snack', 'Repeats weekly', 'Filter meals'],
    wishExample: "A shopping list built from the week's meals…",
  },
  assignments: {
    key: 'assignments',
    area: 'Assignments',
    features: ['Add assignment', 'Filter by member'],
    wishExample: "A place to keep the teacher's worksheet with the assignment…",
  },
  noticeboard: {
    key: 'noticeboard',
    area: 'the Noticeboard',
    features: ['Post a note', 'Pin to top'],
    wishExample: 'Adding a photo to a note…',
  },
  tasks: {
    key: 'tasks',
    area: 'My Tasks',
    features: ['Add task', 'Task list'],
    wishExample: 'Tasks that repeat every week…',
  },
  members: {
    key: 'members',
    area: 'Manage family',
    features: [
      'Grown-ups',
      'Kids',
      'Waiting to join',
      'Invite an adult',
      'Add a child',
      'Kid PINs',
    ],
    wishExample: 'Inviting grandparents to see the calendar only…',
  },
  money: {
    key: 'money',
    area: 'Kids money',
    features: ['What they have', 'Cash out', 'Move to savings', 'Invest and grow', 'Week by week'],
    wishExample: 'A savings goal with a picture of what they are saving for…',
  },
  'family-settings': {
    key: 'family-settings',
    area: 'Family settings',
    features: ['Your family hub', 'Money shown as', 'Download our data', 'Delete our family hub'],
    wishExample: 'Choosing which day the week starts on…',
  },
  'reward-settings': {
    key: 'reward-settings',
    area: 'Reward settings',
    features: [
      'What a sticker is worth',
      'Different amount per child',
      'Bigger habits pay more',
      'Missed days',
    ],
    wishExample: 'Rewards that are not money, like screen time…',
    raised: true,
  },
  admin: {
    key: 'admin',
    area: 'the Admin Panel',
    features: [],
    wishExample: 'One place to see every setting at once…',
  },
  'child-world': {
    key: 'child-world',
    area: "your child's World",
    features: ['Habits', 'Stickers', 'Add a habit', 'Habit Leaderboard', 'Weekly Trend'],
    wishExample: 'A bonus sticker for a long streak…',
  },
  'child-meals': {
    key: 'child-meals',
    area: "your child's Meals",
    features: [],
    wishExample: 'Letting my child pick one dinner a week…',
  },
  'child-calendar': {
    key: 'child-calendar',
    area: "your child's Calendar",
    features: [],
    wishExample: 'A picture view for children who cannot read yet…',
  },
  'child-journal': {
    key: 'child-journal',
    area: 'the Journal',
    features: ['What happened today', 'Previous and next day'],
    wishExample: 'A prompt to help my child start writing…',
  },
  'child-insights': {
    key: 'child-insights',
    area: 'Learning Insights',
    features: ['Learning activity', 'Parent tips'],
    wishExample: 'A weekly email of what my child learned…',
  },
};

const GENERAL: ScreenFeedbackConfig = {
  key: 'other',
  area: 'this screen',
  features: [],
  wishExample: 'Something that would make this screen more useful…',
};

/** The screen a parent is on, from the URL. Child World passes its tab key instead. */
export function screenFeedbackFor(pathname: string, search: string): ScreenFeedbackConfig {
  const rest = pathname.replace(/^\/t\/[^/]+\//, '').split('/')[0] ?? '';
  if (rest === 'dashboard') {
    const tab = new URLSearchParams(search).get('tab') ?? 'home';
    return SCREENS[tab] ?? SCREENS.home!;
  }
  return SCREENS[rest] ?? GENERAL;
}

export function screenFeedbackByKey(key: string): ScreenFeedbackConfig {
  return SCREENS[key] ?? GENERAL;
}

// One ID per browser tab, kept until the tab closes, so every answer a parent
// gives in one visit can be grouped in the export.
// Private browsing can block sessionStorage; the in-memory copy still keeps
// one ID until the page reloads.
const VISIT_KEY = 'fh-feedback-visit';
let memoryVisitId: string | null = null;

export function getVisitId(): string {
  try {
    const existing = sessionStorage.getItem(VISIT_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    sessionStorage.setItem(VISIT_KEY, fresh);
    return fresh;
  } catch {
    memoryVisitId ??= crypto.randomUUID();
    return memoryVisitId;
  }
}
