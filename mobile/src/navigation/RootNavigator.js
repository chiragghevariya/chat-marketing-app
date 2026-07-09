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

import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../store/AuthContext';
import { useTheme } from '../store/ThemeContext';
import { useChat } from '../store/ChatContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { setPushAuthReady } from '../services/navigationRef';

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
  const { colors, isDark } = useTheme();
  const { unreadCount } = useChat();
  const { user } = useAuth();

  const headerStyle = {
    headerTintColor: colors.accent,
    headerStyle: { 
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      shadowOpacity: 0,
      elevation: 0,
    },
    headerTitleStyle: { color: colors.text, fontWeight: '700' },
  };

  return (
    <Tab.Navigator
      sceneContainerStyle={{ backgroundColor: colors.background }}
      screenOptions={({ route }) => ({
        ...headerStyle,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 90 : 66,
          paddingBottom: Platform.OS === 'ios' ? 30 : 12,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.2 : 0.05,
          shadowRadius: 10,
          elevation: 10,
        },
        tabBarIcon: ({ color, size, focused }) => {
          // Use the outline variant when the tab is inactive.
          const base = TAB_ICONS[route.name] || 'ellipse';
          const name = focused ? base : `${base}-outline`;
          return <Ionicons name={name} size={size + 2} color={color} />;
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 2,
        },
        tabBarAllowFontScaling: false,
      })}
    >
      <Tab.Screen name="Explore" component={ExploreScreen} options={{ title: 'Explore' }} />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          title: 'Messages',
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
        }}
      />
      {user && user.role !== 'buyer' && (
        <Tab.Screen name="Sell" component={SellScreen} options={{ title: 'Sell' }} />
      )}
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Root navigator with the auth gate.
// ---------------------------------------------------------------------------
export default function RootNavigator() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();

  // Set up foreground display + notification tap handling once (hooks must run
  // before the early returns below).
  usePushNotifications();

  // Keep the push router's auth-readiness in sync so a deferred notification tap
  // (from a terminated/logged-out state) navigates to Chat only once logged in.
  useEffect(() => {
    setPushAuthReady(!!user);
  }, [user]);

  const headerStyle = {
    headerTintColor: colors.accent,
    headerStyle: { 
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      shadowOpacity: 0,
      elevation: 0,
    },
    headerTitleStyle: { color: colors.text, fontWeight: '700' },
  };

  // Restoring the session / logging in.
  if (loading) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
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
  },
});
