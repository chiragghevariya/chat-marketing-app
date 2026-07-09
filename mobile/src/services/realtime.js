// ---------------------------------------------------------------------------
// realtime — small shared state/signals for the chat + notification flow.
//
//   1. Active conversation: which conversation the user is currently viewing.
//      Used to (a) suppress the FCM banner for that conversation, and (b) mark it
//      read. Set/cleared by ChatScreen on focus/blur.
//
//   2. New-message bus: FCM's foreground onMessage handler fires reliably for
//      every incoming message; it broadcasts here so the Messages list can update
//      live without a manual refresh. (ChatScreen itself updates via Pusher.)
// ---------------------------------------------------------------------------

// --- Active conversation ---------------------------------------------------
let activeConversationId = null;

export function setActiveConversation(id) {
  activeConversationId = id != null ? String(id) : null;
}

export function getActiveConversation() {
  return activeConversationId;
}

// --- New-message bus -------------------------------------------------------
const listeners = new Set();

/** Subscribe to incoming-message signals. Returns an unsubscribe function. */
export function onNewMessage(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Notify all subscribers that a new message arrived (payload = FCM data). */
export function emitNewMessage(data) {
  listeners.forEach((cb) => {
    try {
      cb(data);
    } catch (e) {
      // A misbehaving listener must never break notification handling.
    }
  });
}
