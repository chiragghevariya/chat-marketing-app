// ---------------------------------------------------------------------------
// Pusher Channels real-time hooks (raw pusher-js, NOT laravel-echo).
//
// These hooks open a Pusher connection, subscribe to a private channel, and
// invoke a handler whenever the bound event fires. They are intentionally small
// and reusable so screens can wire up live updates with a single line.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from 'react';
// pusher-js's React Native build exports the class as a NAMED export
// (`module.exports.Pusher = ...`), while its web/node builds export it as the
// default. A plain `import Pusher from 'pusher-js'` therefore yields an object
// (not the class) on React Native, and `new Pusher()` throws "constructor is
// not callable" under Hermes. Resolve the class defensively so it works on
// every platform.
import * as PusherModule from 'pusher-js';

const Pusher = PusherModule.Pusher || PusherModule.default || PusherModule;

import { PUSHER_KEY, PUSHER_CLUSTER, BROADCASTING_AUTH_URL } from '../config/env';
import { useAuth } from '../store/AuthContext';

/**
 * Subscribe to a Pusher channel and bind a single event to a handler.
 *
 * @param {string} channelName  e.g. "private-conversation.42"
 * @param {string} eventName    e.g. "message.sent" (NO leading dot for raw pusher-js)
 * @param {Function} handler    called with the event payload
 */
export function usePusher(channelName, eventName, handler) {
  const { token } = useAuth();

  // Keep the latest handler in a ref so that re-renders (which create a new
  // handler function each time) do NOT force us to tear down and re-subscribe.
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    // Guard: nothing to do without a token or a channel to join.
    // Private channels require auth, so a missing token means we cannot connect.
    if (!token || !channelName) {
      return undefined;
    }

    // Create a fresh Pusher client configured for private-channel auth against
    // the Laravel /broadcasting/auth endpoint, sending the JWT as a Bearer token.
    const pusher = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      channelAuthorization: {
        endpoint: BROADCASTING_AUTH_URL,
        transport: 'ajax',
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/json',
        },
      },
    });

    // Subscribe to the channel and bind the event. We call through the ref so
    // the most recent handler is always used without re-subscribing.
    const channel = pusher.subscribe(channelName);
    const eventCallback = (payload) => {
      if (handlerRef.current) {
        handlerRef.current(payload);
      }
    };
    channel.bind(eventName, eventCallback);

    // Cleanup: unbind the event, leave the channel, and close the connection.
    return () => {
      channel.unbind(eventName, eventCallback);
      pusher.unsubscribe(channelName);
      pusher.disconnect();
    };
  }, [channelName, eventName, token]);
}

/**
 * Thin convenience wrapper for a conversation's message stream.
 *
 * @param {number|string} conversationId  the conversation to listen on
 * @param {Function} onMessage            called with each incoming Message
 */
export function useConversationChannel(conversationId, onMessage) {
  // Only build a channel name when we actually have a conversation id; passing a
  // falsy channelName makes usePusher a no-op (see its guard above).
  usePusher(
    conversationId ? 'private-conversation.' + conversationId : null,
    'message.sent',
    onMessage,
  );
}
