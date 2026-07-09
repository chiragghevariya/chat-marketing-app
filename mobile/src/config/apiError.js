// ---------------------------------------------------------------------------
// apiError — turn an axios error into a user-friendly, status-aware message.
//
// Screens previously collapsed every failure (network, 401, 422, 500, 502) into
// one generic alert, which made real problems (e.g. a Stripe 502 or an expired
// session) impossible to tell apart. These helpers branch on the HTTP status and
// prefer the backend's own human-readable `message` when it sent one.
// ---------------------------------------------------------------------------

// The HTTP status of a failed request, or null if the server was never reached
// (network error / timeout / DNS failure).
export function getStatus(error) {
  return error && error.response ? error.response.status : null;
}

// True when the failure is an expired/invalid session. Screens use this to skip
// their own alert because the global 401 handler already logs the user out and
// the app redirects to Login.
export function isAuthError(error) {
  return getStatus(error) === 401;
}

// Pull the first field error out of a Laravel 422 body: { errors: { field: [..] } }.
function firstValidationError(data) {
  if (data && data.errors && typeof data.errors === 'object') {
    const firstKey = Object.keys(data.errors)[0];
    const messages = firstKey ? data.errors[firstKey] : null;
    if (Array.isArray(messages) && messages.length) {
      return String(messages[0]);
    }
  }
  return null;
}

// Map an axios error to a message safe to show the user.
//
//   fallback — generic copy used only when nothing more specific is available.
export function getApiErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  // No response object => the request never reached the server.
  if (!error || !error.response) {
    return 'Network error. Check your connection and try again.';
  }

  const { status, data } = error.response;

  // The backend's own friendly message, when present (our controllers return
  // things like "This seller cannot accept payments yet.").
  const backendMessage =
    data && typeof data.message === 'string' && data.message.trim()
      ? data.message.trim()
      : null;

  switch (status) {
    case 401:
      return 'Your session has expired. Please log in again.';
    case 403:
      return backendMessage || 'You do not have permission to do that.';
    case 404:
      return backendMessage || 'Not found.';
    case 422:
      // Prefer the top-level message, then the first field validation error.
      return backendMessage || firstValidationError(data) || 'Please check your input and try again.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 502:
    case 503:
    case 504:
      // Our controllers deliberately return 502 for upstream (Stripe) failures
      // with a curated message — surface it.
      return backendMessage || 'The service is temporarily unavailable. Please try again shortly.';
    case 500:
      // A raw 500 may leak an exception string (esp. with APP_DEBUG=true), so
      // never surface its body — show a safe generic message.
      return 'The server had a problem. Please try again shortly.';
    default:
      return backendMessage || fallback;
  }
}
