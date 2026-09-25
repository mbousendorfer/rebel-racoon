// Image Generator — the events campaign ideas draw from: seasons, holidays, world
// days, business rhythms. Dates are month/day (recurring); `sectors` narrows an
// event to the brands it makes sense for ("*" = everyone).

const e = (id, month, day, label, kind, sectors, angle) =>
  Object.freeze({ id, month, day, label, kind, sectors, angle });

export const CALENDAR_EVENTS = Object.freeze([
  e("new-year", 1, 1, "New Year", "holiday", ["*"], "Fresh starts and resolutions"),
  e("valentines", 2, 14, "Valentine's Day", "holiday", ["food", "retail", "lifestyle"], "Share it with someone"),
  e("womens-day", 3, 8, "International Women's Day", "world-day", ["*"], "The women behind the work"),
  e("spring", 3, 20, "First day of spring", "season", ["*"], "Something new is in season"),
  e(
    "q1-close",
    3,
    31,
    "Quarter close",
    "business",
    ["finance", "software", "b2b"],
    "Closing the books without the chaos",
  ),
  e("earth-day", 4, 22, "Earth Day", "world-day", ["*"], "What we do differently for the planet"),
  e("coffee-mothers", 5, 11, "Mother's Day", "holiday", ["food", "retail", "lifestyle"], "A small ritual, gifted"),
  e("summer", 6, 21, "First day of summer", "season", ["*"], "Long days, lighter habits"),
  e("q2-close", 6, 30, "Half-year close", "business", ["finance", "software", "b2b"], "The halfway review"),
  e(
    "q3-close",
    9,
    30,
    "Quarter close",
    "business",
    ["finance", "software", "b2b"],
    "Closing the books without the chaos",
  ),
  e("back-to-work", 9, 1, "Back to work", "season", ["*"], "Routines that make September easier"),
  e("autumn", 9, 22, "First day of autumn", "season", ["*"], "The season's first"),
  e("coffee-day", 10, 1, "International Coffee Day", "world-day", ["food", "coffee"], "The people who grow it"),
  e("mental-health", 10, 10, "World Mental Health Day", "world-day", ["*"], "Taking a real break"),
  e(
    "black-friday",
    11,
    28,
    "Black Friday",
    "retail",
    ["food", "retail", "lifestyle", "coffee"],
    "One offer, done properly",
  ),
  e(
    "budget-season",
    11,
    15,
    "Budget planning season",
    "business",
    ["finance", "software", "b2b"],
    "Next year's plan, in numbers",
  ),
  e("holidays", 12, 20, "End-of-year holidays", "holiday", ["*"], "Thank you for this year"),
  e(
    "year-close",
    12,
    31,
    "Year-end close",
    "business",
    ["finance", "software", "b2b"],
    "A clean close for a fresh year",
  ),
]);

/** The next `count` events on or after `from`, relevant to `sector`. */
export function upcomingEvents(from = new Date(), sector = "*", count = 4) {
  const year = from.getFullYear();
  const dated = [];
  for (const event of CALENDAR_EVENTS) {
    if (!event.sectors.includes("*") && !event.sectors.includes(sector)) continue;
    let date = new Date(year, event.month - 1, event.day);
    if (date < new Date(year, from.getMonth(), from.getDate())) date = new Date(year + 1, event.month - 1, event.day);
    dated.push({ ...event, date });
  }
  return dated.sort((a, b) => a.date - b.date).slice(0, count);
}
