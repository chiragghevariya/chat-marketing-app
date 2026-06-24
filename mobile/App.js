// Must be the very first import so React Navigation's gesture-based
// transitions (swipe back, etc.) work on native.
import 'react-native-gesture-handler';

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StripeProvider } from '@stripe/stripe-react-native';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from './src/store/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { STRIPE_PUBLISHABLE_KEY } from './src/config/env';

// App entry point.
//
// Provider order (outermost -> innermost):
//   StripeProvider      -> exposes useStripe() (payment sheet) app-wide
//   AuthProvider        -> holds the JWT + current user, drives logged in/out UI
//   NavigationContainer -> React Navigation root
//   RootNavigator       -> picks the auth vs. main stack based on auth state
export default function App() {
  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
      <AuthProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
      {/* Dark icons/text in the OS status bar to suit the light UI. */}
      <StatusBar style="dark" />
    </StripeProvider>
  );
}
