// ---------------------------------------------------------------------------
// ListingDetailScreen
//
// Shows a single listing fetched by id (route.params.listingId):
//   - A paged image carousel with dot indicators.
//   - Title, price, condition + location, and description.
//   - A seller row with avatar, name and a verified badge.
//   - Two fixed action buttons near the bottom:
//       * "Message Seller" -> starts a conversation and opens the Chat screen.
//       * "Buy Now" -> runs the Stripe payment-sheet escrow flow.
//   Both buttons are hidden on the viewer's own listing; "Buy Now" is also
//   hidden when the listing is not active.
// ---------------------------------------------------------------------------

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';

import api from '../config/api';
import { useAuth } from '../store/AuthContext';
import { colors, spacing, radius } from '../config/theme';

// Full device width — used to size each carousel page so paging snaps cleanly.
const SCREEN_WIDTH = Dimensions.get('window').width;

export default function ListingDetailScreen({ navigation, route }) {
  const { listingId } = route.params || {};
  const { user } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Index of the currently visible carousel page (for dot indicators).
  const [activeImage, setActiveImage] = useState(0);
  // Disables action buttons while the Stripe flow is in progress.
  const [processing, setProcessing] = useState(false);

  // ---- Load the listing on mount / when the id changes --------------------
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.listings.get(listingId);
        if (mounted) setListing(data);
      } catch (e) {
        if (mounted) setError('Could not load this listing.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [listingId]);

  // ---- Actions ------------------------------------------------------------

  // Start (or reuse) a conversation with the seller, then open the chat.
  async function handleMessageSeller() {
    try {
      const conv = await api.conversations.start({ listing_id: listing.id });
      navigation.navigate('Chat', {
        conversationId: conv.id,
        title: listing.title,
      });
    } catch (e) {
      Alert.alert('Error', 'Could not start a conversation. Please try again.');
    }
  }

  // Run the Stripe payment-sheet flow, then finalize the escrow order.
  async function handleBuyNow() {
    setProcessing(true);
    try {
      // 1. Create the order on the backend -> { order, client_secret }.
      const { order, client_secret } = await api.orders.create({
        listing_id: listing.id,
      });

      // 2. Initialize the payment sheet with the order's client secret.
      const init = await initPaymentSheet({
        merchantDisplayName: 'Marketplace',
        paymentIntentClientSecret: client_secret,
      });
      if (init.error) {
        Alert.alert('Payment error', init.error.message);
        return;
      }

      // 3. Present the sheet and let the user authorize the card.
      const { error } = await presentPaymentSheet();
      if (error) {
        // The user dismissing the sheet is not a real error — stay silent.
        if (error.code !== 'Canceled') {
          Alert.alert('Payment error', error.message);
        }
        return;
      }

      // 4. Card authorized — finalize the order (manual-capture escrow).
      await api.orders.confirmPayment(order.id);
      Alert.alert('Success', 'Your payment was authorized. The order is now pending.');
    } catch (e) {
      Alert.alert('Error', 'Something went wrong processing your payment.');
    } finally {
      setProcessing(false);
    }
  }

  // Track the visible carousel page from the scroll offset.
  function handleCarouselScroll(e) {
    const x = e.nativeEvent.contentOffset.x;
    setActiveImage(Math.round(x / SCREEN_WIDTH));
  }

  // ---- Loading / error states ---------------------------------------------
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (error || !listing) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error || 'Listing not found.'}</Text>
      </View>
    );
  }

  // ---- Derived display values ---------------------------------------------
  const images = listing.images || [];
  const price = `$${Number(listing.price).toFixed(2)}`;
  const seller = listing.seller || {};

  // Whether this listing belongs to the logged-in user (hides action buttons).
  const isOwnListing = !!(user && seller.id === user.id);
  // Buy Now is only offered for someone else's active listing.
  const canBuy = !isOwnListing && listing.status === 'active';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ---- Image carousel ---- */}
        <View style={styles.carousel}>
          {images.length > 0 ? (
            <>
              <FlatList
                data={images}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => String(item.id)}
                onScroll={handleCarouselScroll}
                scrollEventThrottle={16}
                renderItem={({ item }) => (
                  <Image
                    source={{ uri: item.url }}
                    style={styles.carouselImage}
                    resizeMode="cover"
                  />
                )}
              />

              {/* Dot indicators — only meaningful with more than one image */}
              {images.length > 1 ? (
                <View style={styles.dots}>
                  {images.map((img, i) => (
                    <View
                      key={img.id}
                      style={[
                        styles.dot,
                        i === activeImage && styles.dotActive,
                      ]}
                    />
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            // Placeholder when the listing has no images.
            <View style={styles.placeholder}>
              <Ionicons name="image-outline" size={48} color={colors.muted} />
            </View>
          )}
        </View>

        {/* ---- Body ---- */}
        <View style={styles.body}>
          <Text style={styles.title}>{listing.title}</Text>
          <Text style={styles.price}>{price}</Text>

          {/* Condition + location meta row */}
          <View style={styles.metaRow}>
            {listing.condition ? (
              <View style={styles.metaItem}>
                <Ionicons
                  name="pricetag-outline"
                  size={15}
                  color={colors.textMuted}
                />
                <Text style={styles.metaText}>{listing.condition}</Text>
              </View>
            ) : null}
            {listing.location ? (
              <View style={styles.metaItem}>
                <Ionicons
                  name="location-outline"
                  size={15}
                  color={colors.textMuted}
                />
                <Text style={styles.metaText}>{listing.location}</Text>
              </View>
            ) : null}
          </View>

          {/* Description */}
          {listing.description ? (
            <Text style={styles.description}>{listing.description}</Text>
          ) : null}

          {/* ---- Seller row ---- */}
          <View style={styles.sellerRow}>
            <View style={styles.sellerAvatarWrap}>
              {seller.avatar ? (
                <Image
                  source={{ uri: seller.avatar }}
                  style={styles.sellerAvatar}
                />
              ) : (
                <Ionicons name="person" size={20} color={colors.muted} />
              )}
            </View>
            <View style={styles.sellerInfo}>
              <View style={styles.sellerNameRow}>
                <Text style={styles.sellerName} numberOfLines={1}>
                  {seller.name}
                </Text>
                {seller.is_verified ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={colors.accent}
                    style={styles.verifiedIcon}
                  />
                ) : null}
              </View>
              <Text style={styles.sellerRole}>Seller</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ---- Fixed action buttons ---- */}
      {!isOwnListing ? (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            activeOpacity={0.85}
            onPress={handleMessageSeller}
            disabled={processing}
          >
            <Ionicons
              name="chatbubble-outline"
              size={18}
              color={colors.accent}
            />
            <Text style={styles.secondaryButtonText}>Message Seller</Text>
          </TouchableOpacity>

          {canBuy ? (
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              activeOpacity={0.85}
              onPress={handleBuyNow}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator size="small" color={colors.textInverse} />
              ) : (
                <Text style={styles.primaryButtonText}>Buy Now</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  errorText: {
    color: colors.danger,
    fontSize: 15,
    textAlign: 'center',
  },
  scrollContent: {
    // Leave room so the fixed action bar never covers content.
    paddingBottom: 96,
  },

  // ---- Carousel ----
  carousel: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH, // square hero area
    backgroundColor: colors.skeleton,
  },
  carouselImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    position: 'absolute',
    bottom: spacing.md,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    marginHorizontal: 3,
    backgroundColor: colors.overlay,
  },
  dotActive: {
    backgroundColor: colors.accent,
  },

  // ---- Body ----
  body: {
    padding: spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  price: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.accent,
    marginBottom: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.lg,
    marginBottom: spacing.xs,
  },
  metaText: {
    fontSize: 14,
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    marginBottom: spacing.lg,
  },

  // ---- Seller row ----
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  sellerAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.skeleton,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: spacing.md,
  },
  sellerAvatar: {
    width: '100%',
    height: '100%',
  },
  sellerInfo: {
    flex: 1,
  },
  sellerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },
  verifiedIcon: {
    marginLeft: spacing.xs,
  },
  sellerRole: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },

  // ---- Action bar ----
  actions: {
    flexDirection: 'row',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  button: {
    flex: 1,
    height: 50,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.xs,
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  primaryButton: {
    backgroundColor: colors.accent,
  },
  primaryButtonText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '700',
  },
});
