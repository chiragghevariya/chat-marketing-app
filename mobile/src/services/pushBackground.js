// ---------------------------------------------------------------------------
// pushBackground — registers the FCM background message handler and the Notifee
// background-event handler at MODULE scope (imported once at the very top of
// App.js). These must be set outside the React component tree so they exist when
// Android spins up a headless JS task for a background/terminated message.
//
// Our backend sends messages WITH a `notification` block, so the OS displays them
// automatically while the app is backgrounded/terminated — the background handler
// therefore has no display work to do; registering it only satisfies React Native
// Firebase (which otherwise warns "No background message handler has been set").
// ---------------------------------------------------------------------------

import { getApp } from '@react-native-firebase/app';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';

import { openConversationFromPush } from './navigationRef';

const messaging = getMessaging(getApp());

// Required by RNFirebase even when the OS handles display. Fail-safe.
setBackgroundMessageHandler(messaging, async () => {
  // No-op: the OS renders the notification from the FCM `notification` payload.
});

// Handle a tap on a (foreground-shown) Notifee notification that happens while
// the app is in the background. Navigation is deferred until the app is ready.
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS) {
    const data = detail.notification?.data;
    if (data?.type === 'chat') {
      openConversationFromPush(data.conversation_id);
    }
  }
});
