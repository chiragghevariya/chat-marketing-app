// ---------------------------------------------------------------------------
// ProfileScreen — Tab 4 (Profile).
//
// Shows the logged-in user header (avatar, name, email, role chip), their
// active listings, their orders, a Stripe Connect onboarding card, and a
// logout button. Supports pull-to-refresh which reloads listings + orders and
// re-fetches the current user (so Stripe status updates after onboarding).
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
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import api from '../config/api';
import { useAuth } from '../store/AuthContext';
import { colors, spacing, radius } from '../config/theme';

// Map an order status to a chip background color.
// success (green) for the "money is good" states, warning (yellow) for the
// in-progress states, and a neutral grey for anything else (e.g. refunded).
function statusColor(status) {
  if (status === 'completed' || status === 'paid') return colors.success;
  if (status === 'pending_payment' || status === 'shipped') return colors.warning;
  return colors.muted;
}

// Human-friendly label for an order status (e.g. "pending_payment" -> "Pending payment").
function statusLabel(status) {
  if (!status) return '';
  const spaced = status.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Format a numeric price/amount like "$899.99". Guards against null values.
function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function ProfileScreen({ navigation, route }) {
  const { user, logout, refreshUser } = useAuth();

  const [listings, setListings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true); // initial data load
  const [refreshing, setRefreshing] = useState(false); // pull-to-refresh
  const [connecting, setConnecting] = useState(false); // Stripe onboarding in-flight

  // ---- Data loading -------------------------------------------------------

  // Load this user's listings + orders. The backend has NO per-seller listing
  // endpoint, so we fetch active listings and filter to the current user
  // client-side by comparing seller.id to user.id.
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
      // Non-fatal: leave whatever data we already had and surface a hint.
      Alert.alert('Could not load profile', 'Please try again.');
    }
  }, [user]);

  // Initial load when the screen mounts (and whenever the user identity changes).
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

  // Pull-to-refresh: reload listings + orders AND re-fetch the current user so
  // Stripe status (stripe_account_id / is_verified) reflects any recent changes.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadData(), refreshUser().catch(() => {})]);
    } finally {
      setRefreshing(false);
    }
  }, [loadData, refreshUser]);

  // ---- Stripe Connect -----------------------------------------------------

  // Kick off (or resume) Stripe Connect onboarding. We request a fresh
  // onboarding URL, open it in the in-app browser, then refresh the user when
  // the browser closes so the UI reflects the new connect/verified state.
  const handleStripeConnect = useCallback(async () => {
    setConnecting(true);
    try {
      const res = await api.sellerStripe.connect();
      if (res && res.onboarding_url) {
        await WebBrowser.openBrowserAsync(res.onboarding_url);
      }
      // After onboarding, the user object may now have stripe_account_id set
      // and/or is_verified true.
      await refreshUser().catch(() => {});
    } catch (e) {
      Alert.alert('Stripe setup failed', 'Please try again later.');
    } finally {
      setConnecting(false);
    }
  }, [refreshUser]);

  // ---- Logout -------------------------------------------------------------

  const handleLogout = useCallback(() => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => logout() },
    ]);
  }, [logout]);

  // ---- Render helpers -----------------------------------------------------

  // Avatar: show the user's image, or a circle with their first initial.
  function renderAvatar() {
    if (user && user.avatar) {
      return <Image source={{ uri: user.avatar }} style={styles.avatar} />;
    }
    const initial =
      user && user.name ? user.name.charAt(0).toUpperCase() : '?';
    return (
      <View style={[styles.avatar, styles.avatarFallback]}>
        <Text style={styles.avatarInitial}>{initial}</Text>
      </View>
    );
  }

  // The Stripe Connect card has three states driven entirely by the user object.
  function renderStripeCard() {
    const connected = user && user.stripe_account_id;
    const verified = user && user.is_verified;

    // Connected AND verified -> charges enabled.
    if (connected && verified) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payments</Text>
          <Text style={[styles.stripeStatus, { color: colors.success }]}>
            Payments enabled
          </Text>
        </View>
      );
    }

    // Connected but NOT verified -> finish onboarding.
    if (connected && !verified) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payments</Text>
          <Text style={styles.cardSubtitle}>
            Your Stripe account needs a few more details before you can get paid.
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
              <Text style={styles.primaryButtonText}>Finish Stripe setup</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    // Not connected at all -> set up payments.
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Payments</Text>
        <Text style={styles.cardSubtitle}>
          Connect a Stripe account to start selling and receive payouts.
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

  // ---- Loading gate -------------------------------------------------------

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // ---- Main render --------------------------------------------------------

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
    >
      {/* Header: avatar + identity + role chip */}
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
              <Text style={styles.roleChipText}>{user.role}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Stripe Connect card */}
      {renderStripeCard()}

      {/* My listings */}
      <Text style={styles.sectionTitle}>My listings</Text>
      {listings.length === 0 ? (
        <Text style={styles.emptyText}>You have no active listings yet.</Text>
      ) : (
        <View style={styles.listGroup}>
          {listings.map((l) => (
            <View key={l.id} style={styles.listRow}>
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
        <Text style={styles.emptyText}>You have no orders yet.</Text>
      ) : (
        <View style={styles.listGroup}>
          {orders.map((o) => (
            <View key={o.id} style={styles.orderRow}>
              <View style={styles.orderRowMain}>
                <Text style={styles.listRowTitle} numberOfLines={1}>
                  {o.listing ? o.listing.title : 'Listing'}
                </Text>
                <Text style={styles.listRowPrice}>{formatMoney(o.amount)}</Text>
              </View>
              <View
                style={[
                  styles.statusChip,
                  { backgroundColor: statusColor(o.status) },
                ]}
              >
                <Text style={styles.statusChipText}>
                  {statusLabel(o.status)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutButton}
        activeOpacity={0.85}
        onPress={handleLogout}
      >
        <Text style={styles.logoutButtonText}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.skeleton,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  avatarInitial: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.accent,
  },
  headerText: {
    flex: 1,
    marginLeft: spacing.lg,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  email: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  roleChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: spacing.sm,
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
    textTransform: 'capitalize',
  },

  // Section titles + empty states
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    paddingVertical: spacing.sm,
  },

  // Cards (Stripe)
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  stripeStatus: {
    fontSize: 15,
    fontWeight: '600',
  },

  // List groups (listings + orders share the bordered container look)
  listGroup: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  listRowTitle: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    marginRight: spacing.sm,
  },
  listRowPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },

  // Order rows have a title/price line plus a status chip line
  orderRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  orderRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusChip: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: spacing.sm,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textInverse,
  },

  // Buttons
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textInverse,
  },
  logoutButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textInverse,
  },
});
