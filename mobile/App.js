// Must be the very first import so React Navigation's gesture-based
// transitions (swipe back, etc.) work on native.
import 'react-native-gesture-handler';

// Registers the FCM background message handler + Notifee background-event handler
// at module scope (must run before the app renders / for headless background tasks).
import './src/services/pushBackground';

import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';

import { AuthProvider } from './src/store/AuthContext';
import { ThemeProvider, useTheme } from './src/store/ThemeContext';
import { ChatProvider } from './src/store/ChatContext';
import RootNavigator from './src/navigation/RootNavigator';
import { STRIPE_PUBLISHABLE_KEY } from './src/config/env';
import { navigationRef, flushPendingPushNavigation } from './src/services/navigationRef';

// Stripe is a NATIVE module and is NOT bundled in Expo Go. Mounting
// <StripeProvider> there tries to reach the (missing) native SDK and red-screens
// the whole app. So when running in Expo Go we skip StripeProvider — the app
// boots normally and only the "Buy Now" payment sheet is unavailable. In a real
// dev/standalone build (appOwnership !== 'expo') StripeProvider is used as usual.
const isExpoGo = Constants.appOwnership === 'expo';
const StripeProvider = isExpoGo
  ? null
  : require('@stripe/stripe-react-native').StripeProvider;

function AppContent() {
  const { statusBarStyle, colors, isDark } = useTheme();

  const navTheme = {
    ...DefaultTheme,
    dark: isDark,
    colors: {
      ...DefaultTheme.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };

  const tree = (
    <AuthProvider>
      <ChatProvider>
        <NavigationContainer
          ref={navigationRef}
          theme={navTheme}
          onReady={flushPendingPushNavigation}
        >
          <RootNavigator />
        </NavigationContainer>
      </ChatProvider>
    </AuthProvider>
  );

  return (
    <>
      {isExpoGo ? (
        tree
      ) : (
        <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
          {tree}
        </StripeProvider>
      )}
      <StatusBar style={statusBarStyle} />
    </>
  );
}

// App entry point.
export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
