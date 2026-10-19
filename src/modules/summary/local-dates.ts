// Calendar-day helpers. Intake is grouped by the day in the user's own timezone, not in UTC, so a
// late dinner in Lagos (UTC+1) counts towards that evening, not the next day.

const DAY_MS = 24 * 60 * 60 * 1000;
// No timezone is more than 14 hours from UTC.
const MAX_OFFSET_MS = 14 * 60 * 60 * 1000;

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The calendar date ("YYYY-MM-DD") of an instant in `timeZone`. */
export function localDate(instant: Date, timeZone: string) {
  // The en-CA locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** Every date from `from` to `to`, inclusive. */
export function datesBetween(from: string, to: string) {
  const dates: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += DAY_MS) {
    dates.push(new Date(t).toISOString().slice(0, 10));
  }
  return dates;
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** A UTC window certain to contain every instant on these local dates, in any timezone. */
export function utcWindow(from: string, to: string) {
  return {
    start: new Date(Date.parse(`${from}T00:00:00Z`) - MAX_OFFSET_MS),
    end: new Date(Date.parse(`${to}T00:00:00Z`) + DAY_MS + MAX_OFFSET_MS),
  };
}
