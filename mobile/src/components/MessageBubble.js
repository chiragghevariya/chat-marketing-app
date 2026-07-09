// ---------------------------------------------------------------------------
// MessageBubble — a single chat message bubble.
//
// Renders a text or image message aligned to the right (mine) or left (other),
// with a small muted timestamp underneath.
// ---------------------------------------------------------------------------

import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';

import { useTheme } from '../store/ThemeContext';
import { formatTime } from '../config/datetime';

const MAX_BUBBLE_WIDTH = Dimensions.get('window').width * 0.78;

export default function MessageBubble({ message, isMine }) {
  if (!message) return null;

  const { colors, spacing, radius } = useTheme();
  const styles = getStyles(colors, spacing, radius, isMine);

  const isImage = message.type === 'image';
  const timeLabel = formatTime(message.created_at);

  return (
    <View style={[styles.row, { alignItems: isMine ? 'flex-end' : 'flex-start' }]}>
      <View
        style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleOther,
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
          <Text style={[styles.text, isMine ? styles.textMine : styles.textOther]}>
            {message.content}
          </Text>
        )}
      </View>

      {timeLabel ? <Text style={styles.time}>{timeLabel}</Text> : null}
    </View>
  );
}

const getStyles = (colors, spacing, radius, isMine) =>
  StyleSheet.create({
    row: {
      width: '100%',
      marginVertical: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    bubble: {
      maxWidth: MAX_BUBBLE_WIDTH,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    bubbleMine: {
      backgroundColor: colors.accent,
      borderBottomRightRadius: radius.sm - 2, // chat bubble tail style
    },
    bubbleOther: {
      backgroundColor: colors.isDark ? colors.border : colors.accentSoft,
      borderBottomLeftRadius: radius.sm - 2,
    },
    bubbleImage: {
      padding: spacing.xs,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    text: {
      fontSize: 15,
      lineHeight: 21,
    },
    textMine: {
      color: colors.textInverse,
      fontWeight: '500',
    },
    textOther: {
      color: colors.text,
      fontWeight: '500',
    },
    image: {
      width: 220,
      height: 220,
      borderRadius: radius.md,
    },
    time: {
      marginTop: 3,
      fontSize: 10,
      color: colors.textMuted,
      marginHorizontal: spacing.xs,
      fontWeight: '500',
    },
  });
