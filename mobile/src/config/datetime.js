// ---------------------------------------------------------------------------
// datetime — shared date/time display helpers.
//
// Single source of truth for how message times are shown across the app so the
// ChatScreen bubbles and the Messages inbox stay consistent. Display only —
// nothing here changes how timestamps are stored on the backend (always UTC ISO).
// ---------------------------------------------------------------------------

/**
 * Format a timestamp as a 12-hour clock time with an AM/PM suffix, in the user's
 * LOCAL device timezone (e.g. "10:51 AM", "12:05 AM", "12:30 PM").
 *
 * `new Date(value)` parses the UTC ISO string from the API and `getHours()` /
 * `getMinutes()` return values in the device's local timezone automatically.
 *
 * @param {string|number|Date} value  an ISO date string / timestamp
 * @returns {string}                   e.g. "10:51 AM" (empty string if invalid)
 */
export function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';

  let hours = date.getHours(); // local timezone
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  if (hours === 0) hours = 12; // midnight/noon -> 12

  return `${hours}:${minutes} ${period}`;
}
