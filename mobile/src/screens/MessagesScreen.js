// ---------------------------------------------------------------------------
// MessagesScreen (Tab 2)
//
// Lists the logged-in user's conversations. Each row shows the OTHER party's
// avatar, their name, a badge with the listing title, the last message preview,
// and the timestamp of the last message, plus an unread count badge.
// Redesigned with dynamic theme support, premium border styles, and modern lists.
// ---------------------------------------------------------------------------

import React, { useState, useCallback, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../store/AuthContext';
import { useTheme } from '../store/ThemeContext';
import { useChat } from '../store/ChatContext';

function formatLastMessageTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffMs = today - messageDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    return `${hours}:${minutes} ${ampm}`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  } else {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }
}

export default function MessagesScreen({ navigation }) {
  const { user } = useAuth();
  const { colors, spacing, radius, isDark } = useTheme();
  const { conversations, loading, refreshConversations } = useChat();
  const styles = getStyles(colors, spacing, radius, isDark);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshConversations(false);
    setRefreshing(false);
  }, [refreshConversations]);

  useFocusEffect(
    useCallback(() => {
      refreshConversations(false);
    }, [refreshConversations])
  );

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

      const otherName = other.name || 'User';
      const listingTitle = (item.listing && item.listing.title) || 'Listing';
      const timeLabel = formatLastMessageTime(
        item.last_message_at || (item.last_message && item.last_message.created_at)
      );

      return (
        <TouchableOpacity
          style={[styles.row, unread && styles.rowUnread]}
          activeOpacity={0.8}
          onPress={() =>
            navigation.navigate('Chat', {
              conversationId: item.id,
              title: listingTitle,
            })
          }
        >
          {/* Avatar with fallback character */}
          <View style={styles.avatarContainer}>
            {other.avatar ? (
              <Image source={{ uri: other.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarFallbackText}>
                  {otherName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {unread && <View style={styles.unreadStatusIndicator} />}
          </View>

          {/* Core metadata text */}
          <View style={styles.rowBody}>
            <View style={styles.rowHeader}>
              <Text style={[styles.nameText, unread && styles.nameTextUnread]} numberOfLines={1}>
                {otherName}
              </Text>
              {timeLabel ? <Text style={[styles.timeText, unread && styles.timeTextUnread]}>{timeLabel}</Text> : null}
            </View>

            {/* Listing details tag */}
            <View style={styles.listingBadge}>
              <Ionicons name="pricetag" size={10} color={colors.accent} />
              <Text style={styles.listingBadgeText} numberOfLines={1} allowFontScaling={false}>
                {listingTitle}
              </Text>
            </View>

            {/* Message preview snippet */}
            <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
              {preview}
            </Text>
          </View>

          {/* Right aligned count badge */}
          {unread ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unread_count}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      );
    },
    [getOtherParty, navigation, colors]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
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
          onRefresh={onRefresh}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <View style={styles.emptyIconContainer}>
            <Ionicons
              name="chatbubbles-outline"
              size={40}
              color={colors.textMuted}
            />
          </View>
          <Text style={styles.emptyText}>No conversations yet</Text>
          <Text style={styles.emptySubText}>
            Direct messages regarding listings you are buying or selling will appear here.
          </Text>
        </View>
      }
    />
  );
}

const AVATAR_SIZE = 54;

const getStyles = (colors, spacing, radius, isDark) =>
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    emptyContainer: {
      flexGrow: 1,
      backgroundColor: colors.background,
    },
    list: {
      flex: 1,
      backgroundColor: colors.background,
    },
    listContent: {
      backgroundColor: colors.background,
      paddingVertical: spacing.xs,
    },
    emptyIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: isDark ? '#2D2D2D' : '#F0F0F0',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    emptyText: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    emptySubText: {
      color: colors.textMuted,
      fontSize: 14,
      marginTop: spacing.xs,
      textAlign: 'center',
      paddingHorizontal: spacing.xxl,
      lineHeight: 20,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md + 2,
      backgroundColor: colors.surface,
    },
    rowUnread: {
      backgroundColor: isDark ? 'rgba(230, 81, 0, 0.05)' : 'rgba(230, 81, 0, 0.02)',
    },
    separator: {
      height: 1,
      backgroundColor: colors.divider,
      marginLeft: spacing.lg + AVATAR_SIZE + spacing.md,
    },
    avatarContainer: {
      position: 'relative',
    },
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      backgroundColor: colors.skeleton,
      borderWidth: 1,
      borderColor: colors.border,
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
    unreadStatusIndicator: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 13,
      height: 13,
      borderRadius: 6.5,
      backgroundColor: colors.accent,
      borderWidth: 2,
      borderColor: colors.surface,
    },
    rowBody: {
      flex: 1,
      marginLeft: spacing.md,
      marginRight: spacing.sm,
    },
    rowHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 3,
    },
    nameText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
      flex: 1,
      marginRight: spacing.sm,
    },
    nameTextUnread: {
      fontWeight: '800',
    },
    timeText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '500',
    },
    timeTextUnread: {
      color: colors.accent,
      fontWeight: '700',
    },
    listingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.isDark ? '#2C1D15' : colors.accentSoft,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radius.sm,
      marginBottom: spacing.xs,
    },
    listingBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.accent,
      marginLeft: 3,
      maxWidth: 160,
      textTransform: 'uppercase',
    },
    preview: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '500',
    },
    previewUnread: {
      color: colors.text,
      fontWeight: '800',
    },
    badge: {
      minWidth: 20,
      height: 20,
      paddingHorizontal: 6,
      borderRadius: 10,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: spacing.xs,
    },
    badgeText: {
      color: colors.textInverse,
      fontSize: 11,
      fontWeight: '800',
    },
  });
