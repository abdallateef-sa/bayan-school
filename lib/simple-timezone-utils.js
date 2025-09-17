/**
 * Simple Timezone Utilities
 * Get timezone from database and display times accordingly
 */

// School working hours in Cairo (constant)
const CAIRO_WORKING_HOURS = {
  start: "08:00", // 8:00 AM
  end: "19:30", // 7:30 PM
  timezone: "Africa/Cairo",
};

/**
 * Convert Cairo time to user timezone
 * @param {string} cairoTime - Time in HH:mm format (e.g., "08:00")
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} userTimezone - User timezone from database (e.g., "Asia/Riyadh")
 * @returns {string} Time in user timezone (HH:mm format)
 */
export function convertCairoTimeToUserTime(cairoTime, date, userTimezone) {
  try {
    // Parse date and time components (YYYY-MM-DD and HH:mm)
    const [year, month, day] = date.split("-").map((v) => parseInt(v, 10));
    const [hour, minute] = cairoTime.split(":").map((v) => parseInt(v, 10));

    // Cairo offset in hours (2 or 3)
    const cairoOffset = getCairoTimezoneOffset(date);

    // Build a UTC timestamp that represents the given local Cairo time.
    // Date.UTC treats the provided components as UTC, so subtract the Cairo offset
    // to get the correct UTC moment for that Cairo local time.
    const utcMs =
      Date.UTC(year, month - 1, day, hour, minute, 0) -
      cairoOffset * 60 * 60 * 1000;
    const utcDate = new Date(utcMs);

    // Format the UTC moment into the user's timezone
    const userTime = new Intl.DateTimeFormat("en-US", {
      timeZone: userTimezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(utcDate);

    return userTime;
  } catch (error) {
    console.error("Error converting time:", error);
    return cairoTime; // Fallback to original time
  }
}

/**
 * Get Cairo timezone offset (handle DST manually)
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {number} Offset in hours (+2 or +3)
 */
function getCairoTimezoneOffset(date) {
  const targetDate = new Date(date);
  const month = targetDate.getMonth() + 1; // 1-12

  // Egypt DST: roughly April to October (simplified)
  if (month >= 4 && month <= 10) {
    return 3; // UTC+3 (Summer time)
  } else {
    return 2; // UTC+2 (Winter time)
  }
}

/**
 * Generate working hours slots for user
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} userTimezone - User timezone from database
 * @returns {Array<string>} Array of time slots in user timezone
 */
export function getWorkingSlotsForUser(date, userTimezone) {
  const slots = [];

  // Generate 30-minute slots from 08:00 to 19:30 Cairo time
  const startHour = 8;
  const endHour = 19;
  const endMinute = 30;

  for (let hour = startHour; hour <= endHour; hour++) {
    const maxMinute = hour === endHour ? endMinute : 30;

    for (let minute = 0; minute <= maxMinute; minute += 30) {
      const cairoTime = `${hour.toString().padStart(2, "0")}:${minute
        .toString()
        .padStart(2, "0")}`;
      const userTime = convertCairoTimeToUserTime(
        cairoTime,
        date,
        userTimezone
      );

      slots.push({
        cairoTime,
        userTime,
        utcTime: convertToUTC(cairoTime, date),
      });
    }
  }

  return slots;
}

/**
 * Convert Cairo time to UTC for database storage
 * @param {string} cairoTime - Time in HH:mm format
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {string} UTC datetime in ISO format
 */
export function convertToUTC(cairoTime, date) {
  try {
    const cairoOffset = getCairoTimezoneOffset(date);
    const [year, month, day] = date.split("-").map((v) => parseInt(v, 10));
    const [hour, minute] = cairoTime.split(":").map((v) => parseInt(v, 10));

    const utcMs =
      Date.UTC(year, month - 1, day, hour, minute, 0) -
      cairoOffset * 60 * 60 * 1000;
    const utcDate = new Date(utcMs);
    return utcDate.toISOString();
  } catch (error) {
    console.error("Error converting to UTC:", error);
    return `${date}T${cairoTime}:00.000Z`;
  }
}

/**
 * Convert UTC time back to user timezone for display
 * @param {string} utcTime - UTC time in ISO format
 * @param {string} userTimezone - User timezone from database
 * @returns {string} Time in user timezone (HH:mm format)
 */
export function convertUTCToUserTime(utcTime, userTimezone) {
  try {
    const utcDate = new Date(utcTime);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: userTimezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(utcDate);
  } catch (error) {
    console.error("Error converting UTC to user time:", error);
    return "00:00";
  }
}

/**
 * Get user timezone from database (to be used in components)
 * @param {string} userId - User ID
 * @returns {Promise<string>} User timezone
 */
export async function getUserTimezoneFromDB(userId) {
  try {
    // This should call your actual API
    const response = await fetch(`/api/users/${userId}/timezone`);
    const data = await response.json();

    if (data.success && data.timezone) {
      return data.timezone;
    }

    // Fallback to browser timezone
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.error("Error fetching user timezone:", error);
    // Fallback to browser timezone
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
}

export { CAIRO_WORKING_HOURS };
