// ---------------------------------------------------------------------------
// ProfileScreen — Tab 4 (Profile).
//
// Shows the logged-in user header, profile dashboard statistics, active listings,
// order history, a Stripe Connect onboarding widget, and a theme selector.
// Redesigned with dynamic theme support, premium dashboard rows, and clean borders.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';

import api from '../config/api';
import { getApiErrorMessage, isAuthError } from '../config/apiError';
import { useAuth } from '../store/AuthContext';
import { useTheme } from '../store/ThemeContext';

function statusColor(status, colors) {
  if (status === 'completed' || status === 'paid') return colors.success;
  if (status === 'pending_payment' || status === 'shipped') return colors.warning;
  return colors.muted;
}

function statusLabel(status) {
  if (!status) return '';
  const spaced = status.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function ProfileScreen({ navigation, route }) {
  const { user, logout, refreshUser } = useAuth();
  const { colors, spacing, radius, themeMode, setThemeMode, isDark } = useTheme();
  const styles = getStyles(colors, spacing, radius, isDark);

  const [listings, setListings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // ---- Data loading ----
  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [listingsRes, ordersRes] = await Promise.all([
        api.listings.list({ per_page: 50, status: 'active' }),
        api.orders.list(),
      ]);

      const mine = (listingsRes.data || []).filter(
        (l) => l.seller && l.seller.id === user.id
      );
      setListings(mine);
      setOrders(ordersRes.data || []);
    } catch (e) {
      if (isAuthError(e)) return;
      Alert.alert('Could not load profile', getApiErrorMessage(e, 'Please try again.'));
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      await loadData();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadData(), refreshUser().catch(() => {})]);
    } finally {
      setRefreshing(false);
    }
  }, [loadData, refreshUser]);

  const handleStripeConnect = useCallback(async () => {
    setConnecting(true);
    try {
      const res = await api.sellerStripe.connect();
      if (res && res.onboarding_url) {
        await WebBrowser.openBrowserAsync(res.onboarding_url);
      }
      await refreshUser().catch(() => {});
    } catch (e) {
      if (isAuthError(e)) return;
      Alert.alert('Stripe setup failed', getApiErrorMessage(e, 'Please try again later.'));
    } finally {
      setConnecting(false);
    }
  }, [refreshUser]);

  const handleLogout = useCallback(() => {
    Alert.alert('Log Out', 'Are you sure you want to sign out of your account?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  }, [logout]);

  function renderAvatar() {
    if (user && user.avatar) {
      return (
        <View style={styles.avatarOutline}>
          <Image source={{ uri: user.avatar }} style={styles.avatar} />
        </View>
      );
    }
    const initial = user && user.name ? user.name.charAt(0).toUpperCase() : '?';
    return (
      <View style={styles.avatarOutline}>
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
      </View>
    );
  }

  function renderStripeCard() {
    const connected = user && user.stripe_account_id;
    const verified = user && user.is_verified;

    if (connected && verified) {
      return (
        <View style={[styles.card, styles.cardSuccess]}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="shield-checkmark" size={22} color={colors.success} />
            <Text style={[styles.cardTitle, { marginLeft: spacing.sm, color: colors.success }]}>
              Merchant Setup Active
            </Text>
          </View>
          <Text style={[styles.stripeStatus, { color: colors.text }]}>
            Your Stripe account is fully configured. Payouts and charges are active.
          </Text>
        </View>
      );
    }

    if (connected && !verified) {
      return (
        <View style={[styles.card, styles.cardWarning]}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="alert-circle" size={22} color={colors.warning} />
            <Text style={[styles.cardTitle, { marginLeft: spacing.sm, color: colors.warning }]}>
              Action Required
            </Text>
          </View>
          <Text style={styles.cardSubtitle}>
            Stripe onboarding is incomplete. Provide additional details to receive buyer funds.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            disabled={connecting}
            onPress={handleStripeConnect}
          >
            {connecting ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.primaryButtonText}>Finish Setup</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="wallet-outline" size={22} color={colors.accent} />
          <Text style={[styles.cardTitle, { marginLeft: spacing.sm, color: colors.text }]}>
            Payout Accounts
          </Text>
        </View>
        <Text style={styles.cardSubtitle}>
          Connect a verified Stripe Express merchant account to publish listings, process orders, and withdraw earnings.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.85}
          disabled={connecting}
          onPress={handleStripeConnect}
        >
          {connecting ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={styles.primaryButtonText}>Set up payments</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
    >
      {/* Header Profile card */}
      <View style={styles.header}>
        {renderAvatar()}
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {user ? user.name : ''}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {user ? user.email : ''}
          </Text>
          {user && user.role ? (
            <View style={styles.roleChip}>
              <Text style={styles.roleChipText} allowFontScaling={false}>
                {user.role}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Dashboard Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{listings.length}</Text>
          <Text style={styles.statLabel}>Active listings</Text>
        </View>
        <View style={styles.dividerVertical} />
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{orders.length}</Text>
          <Text style={styles.statLabel}>Orders</Text>
        </View>
      </View>

      {/* Stripe Connect card */}
      {user && (user.role === 'seller' || user.role === 'admin') ? renderStripeCard() : null}

      {/* Theme Settings Selector */}
      <Text style={styles.sectionTitle}>App Preferences</Text>
      <View style={styles.preferenceCard}>
        <Text style={styles.preferenceLabel}>Visual Theme Mode</Text>
        <View style={styles.themeToggleRow}>
          {[
            { id: 'light', label: '☀️ Light' },
            { id: 'dark', label: '🌙 Dark' },
            { id: 'system', label: '💻 System' },
          ].map((mode) => {
            const selected = themeMode === mode.id;
            return (
              <TouchableOpacity
                key={mode.id}
                style={[styles.themeChip, selected && styles.themeChipSelected]}
                onPress={() => setThemeMode(mode.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.themeChipText, selected && styles.themeChipTextSelected]}>
                  {mode.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* My listings */}
      <Text style={styles.sectionTitle}>My listings</Text>
      {listings.length === 0 ? (
        <Text style={styles.emptyText}>You haven't listed any products yet.</Text>
      ) : (
        <View style={styles.listGroup}>
          {listings.map((l, index) => (
            <View
              key={l.id}
              style={[
                styles.listRow,
                index === listings.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <Ionicons
                name="pricetag"
                size={16}
                color={colors.accent}
                style={styles.rowIcon}
              />
              <Text style={styles.listRowTitle} numberOfLines={1}>
                {l.title}
              </Text>
              <Text style={styles.listRowPrice}>{formatMoney(l.price)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* My orders */}
      <Text style={styles.sectionTitle}>My orders</Text>
      {orders.length === 0 ? (
        <Text style={styles.emptyText}>No purchases or sales logs found.</Text>
      ) : (
        <View style={styles.listGroup}>
          {orders.map((o, index) => (
            <View
              key={o.id}
              style={[
                styles.orderRow,
                index === orders.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={styles.orderRowMain}>
                <Ionicons
                  name="basket"
                  size={18}
                  color={colors.textMuted}
                  style={styles.rowIcon}
                />
                <View style={styles.orderTitleWrap}>
                  <Text style={styles.listRowTitle} numberOfLines={1}>
                    {o.listing ? o.listing.title : 'Listing'}
                  </Text>
                  <Text style={styles.listRowPrice}>{formatMoney(o.amount)}</Text>
                </View>
                <View
                  style={[
                    styles.statusChip,
                    { backgroundColor: statusColor(o.status, colors) },
                  ]}
                >
                  <Text style={styles.statusChipText} allowFontScaling={false}>
                    {statusLabel(o.status)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutButton}
        activeOpacity={0.8}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={18} color={colors.danger} style={{ marginRight: spacing.sm }} />
        <Text style={styles.logoutButtonText}>
          Log out
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const getStyles = (colors, spacing, radius, isDark) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: spacing.lg,
      paddingBottom: Platform.OS === 'ios' ? spacing.xxl + 40 : spacing.xxl + 20,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },

    // Header profile layout
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    avatarOutline: {
      borderWidth: 2,
      borderColor: colors.accent,
      padding: 3,
      borderRadius: 99,
      backgroundColor: colors.surface,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.skeleton,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accentSoft,
    },
    avatarInitial: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.accent,
    },
    headerText: {
      flex: 1,
      marginLeft: spacing.md + 2,
    },
    name: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
    },
    email: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 1,
      fontWeight: '500',
    },
    roleChip: {
      alignSelf: 'flex-start',
      backgroundColor: colors.isDark ? '#2C1D15' : colors.accentSoft,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      marginTop: spacing.xs,
      borderWidth: isDark ? 1 : 0,
      borderColor: colors.border,
    },
    roleChipText: {
      fontSize: 9,
      fontWeight: '800',
      color: colors.accent,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    // Dashboard stats
    statsRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingVertical: spacing.md,
      marginBottom: spacing.lg,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 4,
      elevation: 2,
    },
    statBox: {
      flex: 1,
      alignItems: 'center',
    },
    statVal: {
      fontSize: 18,
      fontWeight: '850',
      color: colors.text,
    },
    statLabel: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
      marginTop: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.2,
    },
    dividerVertical: {
      width: 1.5,
      height: '70%',
      backgroundColor: colors.divider,
    },

    // Dynamic preferences card
    preferenceCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.xs,
    },
    preferenceLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    themeToggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    themeChip: {
      flex: 1,
      height: 38,
      borderRadius: radius.sm,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.background,
      marginHorizontal: 3,
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeChipSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
    },
    themeChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
    },
    themeChipTextSelected: {
      color: colors.accent,
    },

    // Sections
    sectionTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textMuted,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    emptyText: {
      fontSize: 13,
      color: colors.textMuted,
      paddingVertical: spacing.lg,
      textAlign: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      fontWeight: '500',
    },

    // Connected card
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing.xs,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 4,
      elevation: 2,
    },
    cardSuccess: {
      borderColor: colors.success,
      backgroundColor: isDark ? 'rgba(76, 175, 80, 0.05)' : 'rgba(76, 175, 80, 0.02)',
    },
    cardWarning: {
      borderColor: colors.warning,
      backgroundColor: isDark ? 'rgba(255, 152, 0, 0.05)' : 'rgba(255, 152, 0, 0.02)',
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '800',
    },
    cardSubtitle: {
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: spacing.md,
      lineHeight: 18,
      fontWeight: '500',
    },
    stripeStatus: {
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },

    // List grids
    listGroup: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.02,
      shadowRadius: 4,
      elevation: 1,
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md - 2,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    rowIcon: {
      marginRight: spacing.sm,
    },
    listRowTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '650',
      color: colors.text,
      marginRight: spacing.sm,
    },
    listRowPrice: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.accent,
    },

    // Orders
    orderRow: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md - 2,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    orderRowMain: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    orderTitleWrap: {
      flex: 1,
      marginRight: spacing.sm,
    },
    statusChip: {
      alignSelf: 'center',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    statusChipText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#FFFFFF',
    },

    // Buttons
    primaryButton: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textInverse,
    },
    logoutButton: {
      marginTop: spacing.xxl,
      borderWidth: 1.5,
      borderColor: colors.danger,
      borderRadius: radius.md,
      height: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    logoutButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.danger,
    },
  });
