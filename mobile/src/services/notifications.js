// ---------------------------------------------------------------------------
// notifications — reusable push-notification service (token lifecycle).
//
// Handles: notification permission, generating the FCM token, and syncing it
// with Laravel. Uses the React Native Firebase MODULAR API (getMessaging/getToken)
// — the namespaced messaging() API is deprecated and prints a warning.
//
// Foreground display, background handling, and tap navigation live elsewhere
// (usePushNotifications hook + pushBackground service) so this file stays focused
// on the token lifecycle.
// ---------------------------------------------------------------------------

import { Platform, PermissionsAndroid } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import messagingModule, {
  getMessaging,
  getToken,
  requestPermission,
} from '@react-native-firebase/messaging';

import api from '../config/api';

// Modular Messaging instance — avoids the deprecated namespaced messaging() call.
const messaging = getMessaging(getApp());
// AuthorizationStatus is a static enum on the module (property access only — no
// namespaced invocation, so no deprecation warning).
const AuthorizationStatus = messagingModule.AuthorizationStatus;

/**
 * Ask the OS for permission to post notifications.
 *   - Android 13+ (API 33): runtime POST_NOTIFICATIONS prompt.
 *   - Android < 13: no runtime permission required.
 *   - iOS: the FCM/APNs permission prompt.
 */
export async function requestNotificationPermission() {
  if (Platform.OS === 'android') {
    if (Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  }

  const status = await requestPermission(messaging);
  return (
    status === AuthorizationStatus.AUTHORIZED ||
    status === AuthorizationStatus.PROVISIONAL
  );
}

/**
 * Generate the FCM registration token and log it for testing.
 */
export async function getFcmToken() {
  try {
    const token = await getToken(messaging);
    console.log('[FCM] Registration token:', token);
    return token;
  } catch (e) {
    console.log('[FCM] Failed to generate token:', e?.message || e);
    return null;
  }
}

/**
 * Send the token to Laravel (POST /device-tokens), retrying gracefully on
 * transient network/server failures. 4xx (auth/validation) stops immediately.
 */
async function saveTokenToBackend(token, { retries = 3, delayMs = 2000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await api.deviceTokens.register({ token, platform: Platform.OS });
      console.log('[FCM] Token registered with backend');
      return true;
    } catch (e) {
      const status = e?.response?.status;
      if (status && status !== 429 && status < 500) {
        console.log('[FCM] Token registration rejected by server:', status);
        return false;
      }
      console.log(`[FCM] Token registration failed (attempt ${attempt}/${retries})`);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  return false;
}

/**
 * Call AFTER the user logs in: request permission, generate the FCM token, and
 * send it to Laravel (with graceful retries).
 */
export async function registerForPushNotifications() {
  try {
    const granted = await requestNotificationPermission();
    console.log('[FCM] Notification permission granted:', granted);
    const token = await getFcmToken();
    if (token) {
      await saveTokenToBackend(token);
    }
    return token;
  } catch (e) {
    console.log('[FCM] registerForPushNotifications error:', e?.message || e);
    return null;
  }
}

/**
 * Remove this device's token from Laravel (DELETE /device-tokens). Call on
 * logout BEFORE the JWT is invalidated. Best-effort — never throws.
 */
export async function unregisterPushNotifications() {
  try {
    const token = await getToken(messaging);
    if (token) {
      await api.deviceTokens.remove({ token });
      console.log('[FCM] Token removed from backend');
    }
  } catch (e) {
    console.log('[FCM] Failed to remove token from backend:', e?.message || e);
  }
}
