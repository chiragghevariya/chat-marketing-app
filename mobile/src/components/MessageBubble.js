// ---------------------------------------------------------------------------
// MessageBubble — a single chat message bubble.
//
// Renders a text or image message aligned to the right (mine) or left (other),
// with a small muted timestamp underneath. The chat text lives in
// `message.content` (the backend has no `body` field) and there is no
// `is_mine` flag, so the parent passes `isMine` after comparing
// message.sender.id to the current user id.
// ---------------------------------------------------------------------------

import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';

import { colors, spacing, radius } from '../config/theme';

// Bubbles never grow wider than ~78% of the screen.
const MAX_BUBBLE_WIDTH = Dimensions.get('window').width * 0.78;

/**
 * Format an ISO timestamp into HH:MM (24h). Defensive: returns '' when the
 * value is missing or cannot be parsed so we never crash on bad data.
 */
function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  // Invalid dates produce NaN for getTime().
  if (isNaN(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export default function MessageBubble({ message, isMine }) {
  // Guard against a null/undefined message.
  if (!message) return null;

  const isImage = message.type === 'image';
  const timeLabel = formatTime(message.created_at);

  return (
    <View
      style={[
        styles.row,
        { alignItems: isMine ? 'flex-end' : 'flex-start' },
      ]}
    >
      <View
        style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleOther,
          // Image bubbles keep tight padding so the image fills the corners.
          isImage && styles.bubbleImage,
        ]}
      >
        {isImage ? (
          <Image
            source={{ uri: message.content }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <Text
            style={[styles.text, isMine ? styles.textMine : styles.textOther]}
          >
            {message.content}
          </Text>
        )}
      </View>

      {/* Muted HH:MM timestamp under the bubble. */}
      {timeLabel ? <Text style={styles.time}>{timeLabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  bubble: {
    maxWidth: MAX_BUBBLE_WIDTH,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },
  bubbleMine: {
    backgroundColor: colors.accent,
    // Slightly squared corner on the "tail" side for a chat-like look.
    borderBottomRightRadius: radius.sm,
  },
  bubbleOther: {
    backgroundColor: colors.accentSoft,
    borderBottomLeftRadius: radius.sm,
  },
  bubbleImage: {
    padding: spacing.xs,
    overflow: 'hidden',
  },
  text: {
    fontSize: 15,
    lineHeight: 20,
  },
  textMine: {
    color: colors.textInverse,
  },
  textOther: {
    color: colors.text,
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: radius.md,
  },
  time: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textMuted,
  },
});
