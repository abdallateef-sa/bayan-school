/**
 * Simple Timezone Utilities
 * Generate full-day time slots in user's timezone with UTC and Cairo time.
 */

const CAIRO_TZ = "Africa/Cairo";

/**
 * Generate 24-hour time slots for user
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} userTimezone - User timezone
 * @returns {Array<{userTime: string, cairoTime: string, utcTime: string}>}
 */
export function getWorkingSlotsForUser(date, userTimezone) {
  const slots = [];
  const [y, m, d] = date.split("-").map((v) => parseInt(v, 10));

  for (let hour = 0; hour <= 23; hour++) {
    for (let minute = 0; minute <= 30; minute += 30) {
      const local = new Date(y, (m || 1) - 1, d || 1, hour, minute, 0, 0);
      const utcTime = local.toISOString();

      const userTime = new Intl.DateTimeFormat("en-GB", {
        timeZone:
          userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(local);

      const cairoTime = new Intl.DateTimeFormat("en-GB", {
        timeZone: CAIRO_TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(local);

      slots.push({ userTime, cairoTime, utcTime });
    }
  }
  return slots;
}

/**
 * Convert UTC time to user timezone
 * @param {string} utcTime - UTC time in ISO format
 * @param {string} userTimezone - User timezone
 * @returns {string} Time in HH:mm format
 */
export function convertUTCToUserTime(utcTime, userTimezone) {
  try {
    const utcDate = new Date(utcTime);
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: userTimezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(utcDate);
  } catch {
    return "00:00";
  }
}

export { CAIRO_TZ as CAIRO_WORKING_HOURS };
