// ---------------------------------------------------------------------------
// navigationRef — lets code OUTSIDE the React tree (push-notification tap
// handlers) navigate. It defers a requested navigation until BOTH the navigator
// is ready AND the user is authenticated, so a tap from a terminated / logged-out
// state lands on the right ChatScreen once the session is restored — never on an
// intermediate Explore/Messages screen.
//
// Cold start is racy: session-restore, the container becoming ready, and the
// initial "MainTabs" route settling all happen around the same time, and a
// navigate() dispatched mid-init can be dropped or reset to the initial route.
// So we RETRY until the navigator is ready and then VERIFY the navigation landed,
// re-issuing it if the initial route bounced it back.
// ---------------------------------------------------------------------------

import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

// The pending intent to open once navigation + auth are both ready.
let pendingConversationId = null;
// A single nonce per tap so ChatScreen refetches exactly once when reopened.
let pendingNonce = null;
// Whether the user is authenticated (the logged-in stack — which owns the Chat
// screen — is only mounted then). Kept in sync by RootNavigator.
let isAuthReady = false;

const RETRY_MS = 120;
const MAX_ATTEMPTS = 25; // ~3s of bounded retries

/**
 * Request navigation to a conversation from a notification tap. If we can't
 * navigate yet (navigator not ready or user not logged in), the intent is stored
 * and flushed automatically when both become ready.
 */
export function openConversationFromPush(conversationId) {
  if (!conversationId) return;
  pendingConversationId = String(conversationId);
  pendingNonce = Date.now(); // one refetch trigger per tap
  flushPendingPushNavigation();
}

/** Update auth readiness (called by RootNavigator on login/logout/restore). */
export function setPushAuthReady(value) {
  isAuthReady = !!value;
  if (isAuthReady) flushPendingPushNavigation();
}

/**
 * Navigate now if a conversation is pending and everything is ready. Retries
 * until the navigator is ready, then verifies the navigation actually landed on
 * the Chat screen (cold-start init can reset it) and re-issues if not.
 */
export function flushPendingPushNavigation(attempt = 0) {
  if (!pendingConversationId || !isAuthReady) return;

  // Navigator not mounted/ready yet — retry on the next frames (bounded).
  if (!navigationRef.isReady()) {
    if (attempt < MAX_ATTEMPTS) {
      setTimeout(() => flushPendingPushNavigation(attempt + 1), RETRY_MS);
    }
    return;
  }

  const conversationId = pendingConversationId;
  const nonce = pendingNonce;

  // Navigate straight to the chat thread (no intermediate screens). navigate()
  // (not push) means re-issuing is idempotent — it won't stack duplicate screens.
  navigationRef.navigate('Chat', { conversationId, fromPush: nonce });

  // Verify it landed; if the initial route reset it, retry briefly.
  setTimeout(() => {
    if (!pendingConversationId) return; // already resolved by a concurrent flush
    const current = navigationRef.getCurrentRoute && navigationRef.getCurrentRoute();
    if (current && current.name === 'Chat') {
      pendingConversationId = null;
      pendingNonce = null;
    } else if (attempt < MAX_ATTEMPTS) {
      flushPendingPushNavigation(attempt + 1);
    } else {
      pendingConversationId = null;
      pendingNonce = null;
    }
  }, RETRY_MS);
}
