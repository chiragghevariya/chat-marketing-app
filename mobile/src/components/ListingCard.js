// ---------------------------------------------------------------------------
// ListingCard — a single product card for the 2-column Explore grid.
//
// Renders the primary image (or first available), the price in the brand
// accent color, a single-line title, location info, and a floating condition badge.
// ---------------------------------------------------------------------------

import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../store/ThemeContext';

export default function ListingCard({ listing, onPress, style }) {
  const { colors, spacing, radius, isDark } = useTheme();
  const styles = getStyles(colors, spacing, radius, isDark);

  // Pick the primary image, falling back to the first image if none is flagged.
  const images = listing.images || [];
  const img = images.find((i) => i.is_primary) || images[0];

  // Format price like "$899.99". Guard against null/undefined price values.
  const price = `$${Number(listing.price || 0).toFixed(2)}`;

  // Human-friendly condition label helper
  const getConditionLabel = (cond) => {
    if (!cond) return '';
    const labels = {
      new: '✨ New',
      like_new: '💎 Like New',
      used: '🔧 Used',
    };
    return labels[cond] || cond.replace('_', ' ');
  };

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      activeOpacity={0.9}
      onPress={onPress}
    >
      {/* Image area */}
      <View style={styles.imageWrap}>
        {img && img.url ? (
          <Image
            source={{ uri: img.url }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderWrap}>
            <Ionicons name="image-outline" size={28} color={colors.textMuted} />
          </View>
        )}

        {/* Floating Condition Badge - styled with high contrast dark glassmorphism */}
        {listing.condition ? (
          <View style={styles.floatingBadge}>
            <Text style={styles.floatingBadgeText} allowFontScaling={false}>
              {getConditionLabel(listing.condition)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Text content below the image */}
      <View style={styles.body}>
        <Text style={styles.price} numberOfLines={1}>
          {price}
        </Text>
        <Text style={styles.title} numberOfLines={1}>
          {listing.title}
        </Text>

        {/* Location tag line */}
        {listing.location ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-sharp" size={11} color={colors.textMuted} />
            <Text style={styles.locationText} numberOfLines={1} allowFontScaling={false}>
              {listing.location}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const getStyles = (colors, spacing, radius, isDark) =>
  StyleSheet.create({
    card: {
      flex: 1,
      margin: spacing.xs,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      // Premium shadow / elevation styling
      shadowColor: isDark ? '#000000' : '#000000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.3 : 0.05,
      shadowRadius: 6,
      elevation: 3,
    },
    imageWrap: {
      width: '100%',
      aspectRatio: 1.1,
      backgroundColor: colors.skeleton,
      position: 'relative',
    },
    image: {
      width: '100%',
      height: '100%',
    },
    placeholderWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    floatingBadge: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      // Solid dark-opaque backdrop guarantees readability on ANY image (light or dark)
      backgroundColor: 'rgba(20, 20, 20, 0.85)',
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    floatingBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#FFFFFF', // always white for contrast
      textTransform: 'capitalize',
    },
    body: {
      padding: spacing.md,
    },
    price: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.accent,
      marginBottom: 2,
    },
    title: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 18,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    locationText: {
      fontSize: 10,
      color: colors.textMuted,
      marginLeft: 2,
      flex: 1,
      fontWeight: '600',
    },
  });
