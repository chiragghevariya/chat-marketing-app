// ---------------------------------------------------------------------------
// RootNavigator
// Top-level navigation + auth gate for the marketplace app.
//
// - While auth state is loading, show a centered spinner.
// - When logged OUT, render a Stack containing only the Login screen.
// - When logged IN, render a Stack with the bottom Tabs (MainTabs) plus the
//   detail/chat screens that are pushed on top of the tabs.
//
// NOTE: App.js owns the <NavigationContainer>, so we do NOT include it here.
// ---------------------------------------------------------------------------

import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../store/AuthContext';
import { colors } from '../config/theme';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import ExploreScreen from '../screens/ExploreScreen';
import MessagesScreen from '../screens/MessagesScreen';
import SellScreen from '../screens/SellScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ListingDetailScreen from '../screens/ListingDetailScreen';
import ChatScreen from '../screens/ChatScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// ---------------------------------------------------------------------------
// Shared header styling — accent-tinted headers used by the logged-in stack
// and the bottom tabs.
// ---------------------------------------------------------------------------
const headerStyle = {
  headerTintColor: colors.accent,
  headerStyle: { backgroundColor: colors.background },
  headerTitleStyle: { color: colors.text },
};

// Map each tab to its Ionicons name.
const TAB_ICONS = {
  Explore: 'compass',
  Messages: 'chatbubbles',
  Sell: 'add-circle',
  Profile: 'person',
};

// ---------------------------------------------------------------------------
// Bottom tabs: Explore, Messages, Sell, Profile (exact names/order).
// ---------------------------------------------------------------------------
function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...headerStyle,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ color, size, focused }) => {
          // Use the outline variant when the tab is inactive.
          const base = TAB_ICONS[route.name] || 'ellipse';
          const name = focused ? base : `${base}-outline`;
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Explore" component={ExploreScreen} options={{ title: 'Explore' }} />
      <Tab.Screen name="Messages" component={MessagesScreen} options={{ title: 'Messages' }} />
      <Tab.Screen name="Sell" component={SellScreen} options={{ title: 'Sell' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Root navigator with the auth gate.
// ---------------------------------------------------------------------------
export default function RootNavigator() {
  const { user, loading } = useAuth();

  // Restoring the session / logging in.
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // Logged out — only the Login screen is reachable.
  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    );
  }

  // Logged in — tabs plus the screens pushed on top of them.
  return (
    <Stack.Navigator screenOptions={headerStyle}>
      <Stack.Screen
        name="MainTabs"
        component={Tabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ListingDetail"
        component={ListingDetailScreen}
        options={{ title: 'Details' }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        // Chat title comes from the navigation params (the listing title).
        options={({ route }) => ({ title: (route.params && route.params.title) || 'Chat' })}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
