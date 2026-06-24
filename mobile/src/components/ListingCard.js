// ---------------------------------------------------------------------------
// ListingCard — a single product card for the 2-column Explore grid.
//
// Renders the primary image (or first available), the price in the brand
// accent color, and a single-line title. Designed with flex:1 + small margins
// so exactly two cards fit per row.
// ---------------------------------------------------------------------------

import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';

import { colors, spacing, radius } from '../config/theme';

export default function ListingCard({ listing, onPress, style }) {
  // Pick the primary image, falling back to the first image if none is flagged.
  const images = listing.images || [];
  const img = images.find((i) => i.is_primary) || images[0];

  // Format price like "$899.99". Guard against null/undefined price values.
  const price = `$${Number(listing.price).toFixed(2)}`;

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      {/* Image area — neutral placeholder background shows through when missing */}
      <View style={styles.imageWrap}>
        {img && img.url ? (
          <Image
            source={{ uri: img.url }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : null}
      </View>

      {/* Text content below the image */}
      <View style={styles.body}>
        <Text style={styles.price}>{price}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {listing.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1, // square image keeps the grid tidy
    backgroundColor: colors.skeleton, // neutral placeholder when no image
  },
  image: {
    width: '100%',
    height: '100%',
  },
  body: {
    padding: spacing.sm,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 13,
    color: colors.text,
  },
});
