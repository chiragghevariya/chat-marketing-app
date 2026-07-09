// ---------------------------------------------------------------------------
// usePushNotifications — foreground display + notification tap handling.
//
// Mounted ONCE (in RootNavigator). Sets up, with proper cleanup so no duplicate
// listeners are created:
//   - Foreground display: FCM does NOT show notifications while the app is open,
//     so onMessage() re-displays each chat push locally via Notifee.
//   - Tap handling for every app state:
//       * foreground  -> Notifee onForegroundEvent (tap on the local notification)
//       * background  -> messaging onNotificationOpenedApp (tap on the OS notification)
//       * terminated  -> messaging getInitialNotification (cold-start tap)
//   Each tap reads conversation_id from the FCM data payload and routes to Chat.
// ---------------------------------------------------------------------------

import { useEffect } from 'react';
import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
} from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';

import api from '../config/api';
import { openConversationFromPush } from '../services/navigationRef';
import { getActiveConversation, emitNewMessage } from '../services/realtime';

const CHANNEL_ID = 'chat-messages';

// Route a notification's data payload to the correct chat (deferred if needed).
function handlePushData(data) {
  if (data && data.type === 'chat' && data.conversation_id) {
    openConversationFromPush(data.conversation_id);
  }
}

export function usePushNotifications() {
  useEffect(() => {
    const messaging = getMessaging(getApp());
    let mounted = true;

    // Ensure the Android channel exists before we display anything.
    notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Chat messages',
      importance: AndroidImportance.HIGH,
    });

    // --- Foreground: display the push locally (OS suppresses it otherwise) ---
    const unsubscribeOnMessage = onMessage(messaging, async (remoteMessage) => {
      const notification = remoteMessage?.notification;
      const data = remoteMessage?.data || {};

      // Is this message for the conversation the user is currently viewing?
      const isActiveConversation =
        data.conversation_id &&
        String(data.conversation_id) === getActiveConversation();

      // If viewing it, mark it read BEFORE the Messages list refreshes so its
      // unread count is correct (ChatScreen appends the message live via Pusher).
      if (isActiveConversation) {
        await api.conversations.markRead(data.conversation_id).catch(() => {});
      }

      // Let the Messages list update live (preview / unread / order / timestamp).
      emitNewMessage(data);

      // Suppress the banner ONLY for the active conversation. Every other
      // conversation still shows a notification as normal.
      if (isActiveConversation) {
        return;
      }

      await notifee.displayNotification({
        title: notification?.title ?? 'New message',
        body: notification?.body ?? '',
        data,
        android: {
          channelId: CHANNEL_ID,
          smallIcon: 'ic_launcher',
          pressAction: { id: 'default' }, // makes the notification tappable
        },
      });
    });

    // --- Tap on the foreground (Notifee) notification ---
    const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) {
        handlePushData(detail.notification?.data);
      }
    });

    // --- Tap on an OS notification while the app is in the background ---
    const unsubscribeOpened = onNotificationOpenedApp(messaging, (remoteMessage) => {
      handlePushData(remoteMessage?.data);
    });

    // --- Cold start (terminated): app opened by tapping a notification ---
    // FCM-displayed notification (background/terminated OS notification).
    getInitialNotification(messaging).then((remoteMessage) => {
      if (mounted && remoteMessage) {
        handlePushData(remoteMessage.data);
      }
    });
    // Notifee-displayed notification (shown while foreground) that was tapped
    // after the app was killed — messaging.getInitialNotification() returns null
    // for these, so read Notifee's initial notification too.
    notifee.getInitialNotification().then((initial) => {
      if (mounted && initial?.notification?.data) {
        handlePushData(initial.notification.data);
      }
    });

    return () => {
      mounted = false;
      unsubscribeOnMessage();
      unsubscribeNotifee();
      unsubscribeOpened();
    };
  }, []);
}
