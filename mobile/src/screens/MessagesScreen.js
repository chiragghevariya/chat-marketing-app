// ---------------------------------------------------------------------------
// MessagesScreen (Tab 2)
//
// Lists the logged-in user's conversations. Each row shows the OTHER party's
// avatar, the listing title, and a preview of the last message, plus an unread
// badge when there are unread messages. Tapping a row opens the Chat screen.
//
// Backend contract notes:
// - api.conversations.list() returns paginated { data, links, meta }; rows live
//   in res.data.
// - There is NO other_party field: compute it by comparing buyer.id / seller.id
//   against the logged-in user id.
// - last_message may be null; show a placeholder in that case.
// ---------------------------------------------------------------------------

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import api from '../config/api';
import { useAuth } from '../store/AuthContext';
import { colors, spacing, radius } from '../config/theme';

export default function MessagesScreen({ navigation }) {
  const { user } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true); // first load spinner
  const [refreshing, setRefreshing] = useState(false); // pull-to-refresh

  // Fetch the conversation list. `isRefresh` distinguishes pull-to-refresh
  // (keep current list visible) from the initial load (show the spinner).
  const loadConversations = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await api.conversations.list();
      // Paginated payload: rows are in res.data.
      setConversations(Array.isArray(res && res.data) ? res.data : []);
    } catch (e) {
      // On error keep the screen usable; surface an empty list rather than crash.
      setConversations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refresh whenever the tab gains focus so new/updated threads appear.
  useFocusEffect(
    useCallback(() => {
      loadConversations(false);
    }, [loadConversations])
  );

  // Resolve the "other party" of a conversation relative to the current user.
  const getOtherParty = useCallback(
    (conversation) => {
      const meId = user && user.id;
      if (conversation.buyer && conversation.buyer.id === meId) {
        return conversation.seller;
      }
      return conversation.buyer;
    },
    [user]
  );

  const renderItem = useCallback(
    ({ item }) => {
      const other = getOtherParty(item) || {};
      const unread = item.unread_count > 0;
      const preview = item.last_message
        ? item.last_message.content
        : 'No messages yet';

      return (
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate('Chat', {
              conversationId: item.id,
              title: item.listing && item.listing.title,
            })
          }
        >
          {/* Other-party avatar with a first-letter fallback circle. */}
          {other.avatar ? (
            <Image source={{ uri: other.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>
                {other.name ? other.name.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
          )}

          {/* Listing title + last message preview. */}
          <View style={styles.rowBody}>
            <Text style={styles.title} numberOfLines={1}>
              {(item.listing && item.listing.title) || 'Listing'}
            </Text>
            <Text style={styles.preview} numberOfLines={1}>
              {preview}
            </Text>
          </View>

          {/* Right-aligned unread badge (orange pill). */}
          {unread ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unread_count}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      );
    },
    [getOtherParty, navigation]
  );

  // First-load spinner.
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <FlatList
      data={conversations}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      contentContainerStyle={
        conversations.length === 0 ? styles.emptyContainer : styles.listContent
      }
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadConversations(true)}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyText}>No conversations yet</Text>
        </View>
      }
    />
  );
}

const AVATAR_SIZE = 52;

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  // Empty list still needs to fill the screen so the empty state centers.
  emptyContainer: {
    flexGrow: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    backgroundColor: colors.background,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  separator: {
    height: 1,
    backgroundColor: colors.divider,
    marginLeft: spacing.lg + AVATAR_SIZE + spacing.md,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.skeleton,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  avatarFallbackText: {
    color: colors.accent,
    fontSize: 20,
    fontWeight: '700',
  },
  rowBody: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  preview: {
    color: colors.textMuted,
    fontSize: 14,
  },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.textInverse,
    fontSize: 12,
    fontWeight: '700',
  },
});
