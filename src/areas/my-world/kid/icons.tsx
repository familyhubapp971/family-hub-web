// FHS-631: the name-to-icon map moved to design-system so the money sheets can
// reach it too. Re-exported here so every existing kid-page import keeps
// working, and so there is only ever one copy of the mapping.
export { habitIcon, HABIT_ICON_NAMES } from '@familyhub/ui';

// "JUN 8 to JUN 14": the week banner range. Start is the week's Monday; the
// range spans Mon..Sun (start + 6 days). Uppercased to match the banner style.
export function weekRangeLabel(startDate: string): string {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  return `${fmt(start)} to ${fmt(end)}`;
}
