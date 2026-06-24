// ---------------------------------------------------------------------------
// ChatScreen — a single conversation's real-time message thread.
//
// Loads the message history, marks the conversation read, then renders an
// inverted FlatList of MessageBubble rows. New messages arrive two ways:
//   1. Pusher (private-conversation.<id>, event "message.sent") for the OTHER
//      party. The backend broadcasts toOthers, so the sender never gets an echo.
//   2. The POST response when WE send — we append our own message manually.
// Both paths funnel through addMessage(), which de-dupes by message id.
//
// LIST ORIENTATION CHOICE: we use an inverted FlatList fed a NEWEST-FIRST array.
// Inverted lists automatically pin to the bottom and reveal new items at the
// bottom without any manual scrollToEnd ref juggling, and they keep the latest
// messages mounted, which is exactly what a chat UI wants. Because the list is
// inverted, the data array is kept newest-first (the API already returns it
// that way), and we simply prepend new messages.
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

import api from '../config/api';
import { useAuth } from '../store/AuthContext';
import { useConversationChannel } from '../hooks/usePusher';
import MessageBubble from '../components/MessageBubble';
import { colors, spacing, radius } from '../config/theme';

export default function ChatScreen({ navigation, route }) {
  // Route params: which conversation to show + the title for the header.
  const { conversationId, title } = route.params || {};

  const { user } = useAuth();

  // Messages are stored NEWEST-FIRST to match the inverted FlatList (see header).
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  // ---- Header title -------------------------------------------------------
  // Set the navigation header to the listing title passed in route params.
  useLayoutEffect(() => {
    navigation.setOptions({ title: title || 'Chat' });
  }, [navigation, title]);

  // ---- Add a message with id-based de-duplication --------------------------
  // Both the Pusher handler and our own send path call this. We guard against
  // duplicates by id: a fast network could deliver our POST response while a
  // (theoretical) echo or refetch also adds the same row. New messages go to
  // the FRONT because the array is newest-first (inverted list).
  const addMessage = useCallback((msg) => {
    if (!msg || msg.id == null) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) {
        return prev; // already present — ignore the duplicate
      }
      return [msg, ...prev];
    });
  }, []);

  // ---- Initial load -------------------------------------------------------
  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!conversationId) {
        setLoading(false);
        return;
      }
      try {
        // messages() returns a paginated object, NEWEST FIRST. Our inverted
        // list also wants newest-first, so we keep res.data as-is.
        const res = await api.conversations.messages(conversationId);
        if (mounted) {
          setMessages(Array.isArray(res && res.data) ? res.data : []);
        }
        // Mark the thread read once history is loaded. Best-effort: a failure
        // here should not block the user from chatting.
        await api.conversations.markRead(conversationId).catch(() => {});
      } catch (e) {
        // Leave the list empty on failure; the empty state will render.
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [conversationId]);

  // ---- Real-time subscription ---------------------------------------------
  // Subscribe to private-conversation.<id> and bind "message.sent". The handler
  // receives a Message payload from the OTHER party (backend broadcasts
  // toOthers, so our own messages never echo back here). addMessage de-dupes.
  useConversationChannel(conversationId, addMessage);

  // ---- Send a message -----------------------------------------------------
  const handleSend = useCallback(async () => {
    const text = draft.trim();
    // Never send empty / whitespace-only messages.
    if (!text || sending) return;

    setSending(true);
    setDraft(''); // clear the input immediately for a responsive feel
    try {
      // sendMessage(id, content) -> the created Message. Because the backend
      // broadcasts toOthers, WE must append our own message from this response.
      const m = await api.conversations.sendMessage(conversationId, text);
      addMessage(m);
    } catch (e) {
      // Restore the draft so the user can retry without retyping.
      setDraft(text);
    } finally {
      setSending(false);
    }
  }, [draft, sending, conversationId, addMessage]);

  // ---- Render a single bubble ---------------------------------------------
  const renderItem = useCallback(
    ({ item }) => {
      // No is_mine flag from the backend: compare sender id to the current user.
      const isMine =
        !!user && !!item.sender && item.sender.id === user.id;
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
      // Offset accounts for the navigation header height on iOS.
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          // Inverted: newest-first data renders bottom-up and auto-pins to the
          // latest message, so no scroll ref / scrollToEnd is needed.
          inverted
          data={messages}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                No messages yet. Say hello!
              </Text>
            </View>
          }
        />
      )}

      {/* Composer: text input + accent Send button. */}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message"
          placeholderTextColor={colors.textMuted}
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
          <Text style={styles.sendLabel}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  empty: {
    // Inverted list flips children, so flip the empty state back upright.
    transform: [{ scaleY: -1 }],
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxl,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.divider,
    borderRadius: radius.lg,
    fontSize: 15,
    color: colors.text,
  },
  sendButton: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.lg,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendLabel: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '600',
  },
});
