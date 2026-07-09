// ---------------------------------------------------------------------------
// ChatScreen — a single conversation's real-time message thread.
//
// Loads the message history, marks the conversation read, then renders an
// inverted FlatList of MessageBubble rows.
// Redesigned with dynamic theme support, modern composer input, and better keyboard adjustments.
// ---------------------------------------------------------------------------

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import api from '../config/api';
import { useAuth } from '../store/AuthContext';
import { useConversationChannel } from '../hooks/usePusher';
import { setActiveConversation } from '../services/realtime';
import MessageBubble from '../components/MessageBubble';
import { useTheme } from '../store/ThemeContext';
import { useChat } from '../store/ChatContext';

export default function ChatScreen({ navigation, route }) {
  // `fromPush` is a per-tap nonce set by the notification router; it changes when
  // the screen is (re)opened from a push so the fetch effect below reloads the
  // latest messages even if this Chat screen instance is reused.
  const { conversationId, title, fromPush } = route.params || {};
  const { user } = useAuth();
  const { colors, spacing, radius, isDark } = useTheme();
  const { markLocalAsRead } = useChat();
  const insets = useSafeAreaInsets();
  const styles = getStyles(colors, spacing, radius, isDark, insets);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ 
      title: title || 'Chat',
    });
  }, [navigation, title]);

  const addMessage = useCallback((msg) => {
    if (!msg || msg.id == null) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) {
        return prev;
      }
      return [msg, ...prev];
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!conversationId) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.conversations.messages(conversationId);
        if (mounted) {
          setMessages(Array.isArray(res && res.data) ? res.data : []);
        }
        await api.conversations.markRead(conversationId).catch(() => {});
        markLocalAsRead(conversationId);
      } catch (e) {
        // Safe fallback
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // `fromPush` re-runs this when reopened from a notification so the newest
    // message is fetched immediately (and the conversation is marked read).
  }, [conversationId, fromPush]);

  // Realtime append of incoming messages while viewing (Pusher message.sent).
  useConversationChannel(conversationId, addMessage);

  // Mark this as the active conversation while the screen is focused so incoming
  // pushes for it are suppressed (and marked read) instead of showing a banner.
  useFocusEffect(
    useCallback(() => {
      setActiveConversation(conversationId);
      return () => setActiveConversation(null);
    }, [conversationId])
  );

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    setDraft('');
    try {
      const m = await api.conversations.sendMessage(conversationId, text);
      addMessage(m);
    } catch (e) {
      setDraft(text);
    } finally {
      setSending(false);
    }
  }, [draft, sending, conversationId, addMessage]);

  const renderItem = useCallback(
    ({ item }) => {
      const isMine = !!user && !!item.sender && item.sender.id === user.id;
      return <MessageBubble message={item} isMine={isMine} />;
    },
    [user],
  );

  const keyExtractor = useCallback((item) => String(item.id), []);
  const canSend = draft.trim().length > 0 && !sending;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.chatIconWrapper}>
            <Ionicons name="chatbubble-ellipses-outline" size={32} color={colors.textMuted} />
          </View>
          <Text style={styles.emptyText}>
            No messages yet.
          </Text>
          <Text style={styles.emptySubText}>
            Send a friendly greeting to start your conversation!
          </Text>
        </View>
      ) : (
        <FlatList
          inverted
          data={messages}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Composer box */}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message..."
          placeholderTextColor={colors.muted}
          multiline
          editable={!sending}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <Ionicons name="send" size={16} color={colors.textInverse} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors, spacing, radius, isDark, insets) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      paddingVertical: spacing.md,
      flexGrow: 1,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    chatIconWrapper: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: isDark ? '#2D2D2D' : '#F0F0F0',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    emptyText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    emptySubText: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: Platform.OS === 'ios' ? insets.bottom + spacing.sm : spacing.md,
      borderTopWidth: 1.5,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    input: {
      flex: 1,
      maxHeight: 120,
      minHeight: 44,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: isDark ? colors.background : colors.divider,
      borderRadius: radius.md,
      fontSize: 15,
      color: colors.text,
      borderWidth: isDark ? 1.5 : 0,
      borderColor: colors.border,
    },
    sendButton: {
      marginLeft: spacing.sm,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 2,
    },
    sendButtonDisabled: {
      opacity: 0.45,
      shadowOpacity: 0,
      elevation: 0,
    },
  });
