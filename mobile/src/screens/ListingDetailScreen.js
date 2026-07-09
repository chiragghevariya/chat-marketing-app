// ---------------------------------------------------------------------------
// ListingDetailScreen
//
// Shows a single listing fetched by id (route.params.listingId):
//   - A paged image carousel with dot indicators + floating favorite button.
//   - Title, price, condition + location, and description.
//   - A seller row with avatar, name and a verified badge.
//   - Two action buttons near the bottom: "Message Seller" and "Buy Now".
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
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo';

import api from '../config/api';
import { getApiErrorMessage, isAuthError } from '../config/apiError';
import { useAuth } from '../store/AuthContext';
import { useTheme } from '../store/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function ListingDetailScreen({ navigation, route }) {
  const { listingId } = route.params || {};
  const { user } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { colors, spacing, radius, isDark } = useTheme();
  const styles = getStyles(colors, spacing, radius, isDark);

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false); // Visual local toggle
  const [previewVisible, setPreviewVisible] = useState(false); // Modal visibility

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.listings.get(listingId);
        if (mounted) setListing(data && data.data ? data.data : data);
      } catch (e) {
        if (mounted && !isAuthError(e)) {
          setError(getApiErrorMessage(e, 'Could not load this listing.'));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [listingId]);

  async function handleMessageSeller() {
    try {
      const res = await api.conversations.start({ listing_id: listing.id });
      const conv = res && res.data ? res.data : res;
      navigation.navigate('Chat', {
        conversationId: conv.id,
        title: listing.title,
      });
    } catch (e) {
      if (isAuthError(e)) return;
      Alert.alert('Error', getApiErrorMessage(e, 'Could not start a conversation. Please try again.'));
    }
  }

  async function handleBuyNow() {
    if (isExpoGo) {
      Alert.alert(
        'Payments unavailable in Expo Go',
        'Card checkout uses Stripe’s native module, which Expo Go can’t load. Run a development build (expo run:android / run:ios) to test Buy Now.'
      );
      return;
    }

    setProcessing(true);
    try {
      const { order, client_secret } = await api.orders.create({
        listing_id: listing.id,
      });

      const init = await initPaymentSheet({
        merchantDisplayName: 'Marketplace',
        paymentIntentClientSecret: client_secret,
        returnURL: 'marketplace://stripe-redirect',
      });
      if (init.error) {
        Alert.alert('Payment error', init.error.message);
        return;
      }

      const { error } = await presentPaymentSheet();
      if (error) {
        if (error.code !== 'Canceled') {
          Alert.alert('Payment error', error.message);
        }
        return;
      }

      await api.orders.confirmPayment(order.id);
      Alert.alert('Success', 'Your payment was authorized. The order is now pending.');
    } catch (e) {
      if (isAuthError(e)) return;
      Alert.alert('Payment error', getApiErrorMessage(e, 'Something went wrong processing your payment.'));
    } finally {
      setProcessing(false);
    }
  }

  function handleCarouselScroll(e) {
    const x = e.nativeEvent.contentOffset.x;
    setActiveImage(Math.round(x / SCREEN_WIDTH));
  }

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
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} style={{ marginBottom: spacing.sm }} />
        <Text style={styles.errorText}>{error || 'Listing not found.'}</Text>
      </View>
    );
  }

  const images = listing.images || [];
  const price = `$${Number(listing.price).toFixed(2)}`;
  const seller = listing.seller || {};
  const isOwnListing = !!(user && seller.id === user.id);
  const canBuy = !isOwnListing && listing.status === 'active';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ---- Image carousel ---- */}
        <View style={styles.carouselContainer}>
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
                  <TouchableOpacity
                    activeOpacity={0.95}
                    onPress={() => setPreviewVisible(true)}
                  >
                    <Image
                      source={{ uri: item.url }}
                      style={styles.carouselImage}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                )}
              />



              {/* Dot indicators */}
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
            <View style={styles.placeholder}>
              <Ionicons name="image-outline" size={64} color={colors.muted} />
              <Text style={{ color: colors.textMuted, marginTop: spacing.sm, fontSize: 13, fontWeight: '500' }}>
                No image available
              </Text>
            </View>
          )}
        </View>

        {/* ---- Body ---- */}
        <View style={styles.body}>
          {/* Price & Status Banner */}
          <View style={styles.pricingRow}>
            <Text style={styles.price}>{price}</Text>
            <View style={[styles.statusBadge, listing.status === 'active' ? styles.statusActive : styles.statusSold]}>
              <Text style={styles.statusBadgeText}>
                {listing.status === 'active' ? 'Available' : 'Sold'}
              </Text>
            </View>
          </View>

          <Text style={styles.title}>{listing.title}</Text>

          {/* Condition + location meta row */}
          <View style={styles.metaRow}>
            {listing.condition ? (
              <View style={styles.badgeItem}>
                <Ionicons name="ribbon" size={14} color={colors.accent} />
                <Text style={styles.badgeText}>
                  {listing.condition.replace('_', ' ')}
                </Text>
              </View>
            ) : null}
            {listing.location ? (
              <View style={styles.badgeItem}>
                <Ionicons name="location" size={14} color={colors.accent} />
                <Text style={styles.badgeText}>{listing.location}</Text>
              </View>
            ) : null}
          </View>

          {/* Section Divider */}
          <View style={styles.sectionDivider} />

          {/* Description Section */}
          <Text style={styles.sectionTitle}>Description</Text>
          {listing.description ? (
            <Text style={styles.description}>{listing.description}</Text>
          ) : (
            <Text style={[styles.description, { fontStyle: 'italic', color: colors.textMuted }]}>
              No description provided.
            </Text>
          )}

          {/* Section Divider */}
          <View style={styles.sectionDivider} />

          {/* ---- Seller info card ---- */}
          <Text style={styles.sectionTitle}>Meet the Seller</Text>
          <View style={styles.sellerCard}>
            <View style={styles.sellerAvatarWrap}>
              {seller.avatar ? (
                <Image
                  source={{ uri: seller.avatar }}
                  style={styles.sellerAvatar}
                />
              ) : (
                <View style={styles.sellerAvatarFallback}>
                  <Text style={styles.sellerInitial}>
                    {(seller.name || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.sellerInfo}>
              <View style={styles.sellerNameRow}>
                <Text style={styles.sellerName} numberOfLines={1}>
                  {seller.name || 'User'}
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
              <Text style={styles.sellerRole}>Member since 2026</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ---- Fixed action buttons at bottom ---- */}
      {!isOwnListing ? (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            activeOpacity={0.85}
            onPress={handleMessageSeller}
            disabled={processing}
          >
            <Ionicons name="chatbubble-ellipses" size={20} color={colors.accent} />
            <Text style={styles.secondaryButtonText}>
              Message
            </Text>
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
                <Text style={styles.primaryButtonText}>
                  Buy Now
                </Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {/* ---- Full Screen Image Preview Modal ---- */}
      {images.length > 0 && (
        <Modal
          visible={previewVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setPreviewVisible(false)}
        >
          <View style={styles.previewModalContainer}>
            {/* Close button at top right */}
            <TouchableOpacity
              style={styles.previewCloseBtn}
              onPress={() => setPreviewVisible(false)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>

            <FlatList
              data={images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => String(item.id)}
              initialScrollIndex={activeImage}
              getItemLayout={(data, index) => ({
                length: SCREEN_WIDTH,
                offset: SCREEN_WIDTH * index,
                index,
              })}
              onScroll={handleCarouselScroll}
              scrollEventThrottle={16}
              renderItem={({ item }) => (
                <ScrollView
                  maximumZoomScale={4}
                  minimumZoomScale={1}
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.previewImageContainer}
                >
                  <Image
                    source={{ uri: item.url }}
                    style={styles.previewImage}
                    resizeMode="contain"
                  />
                </ScrollView>
              )}
            />

            {/* Preview bottom pagination count indicator */}
            <View style={styles.previewPagination}>
              <Text style={styles.previewPaginationText}>
                {activeImage + 1} / {images.length}
              </Text>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const getStyles = (colors, spacing, radius, isDark) =>
  StyleSheet.create({
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
      fontWeight: '600',
      textAlign: 'center',
    },
    scrollContent: {
      paddingBottom: Platform.OS === 'ios' ? 120 : 96,
    },

    // Carousel Image
    carouselContainer: {
      width: SCREEN_WIDTH,
      height: SCREEN_WIDTH * 0.95,
      backgroundColor: colors.surface,
      position: 'relative',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    carouselImage: {
      width: SCREEN_WIDTH,
      height: SCREEN_WIDTH * 0.95,
    },
    placeholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    floatingHeader: {
      position: 'absolute',
      top: spacing.md,
      right: spacing.md,
      zIndex: 10,
    },
    floatingActionBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: isDark ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.92)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 4,
      elevation: 3,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
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
      width: 6,
      height: 6,
      borderRadius: 3,
      marginHorizontal: 3,
      backgroundColor: 'rgba(255, 255, 255, 0.4)',
    },
    dotActive: {
      width: 14,
      backgroundColor: colors.accent,
    },

    // Details Body
    body: {
      padding: spacing.lg,
    },
    pricingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    price: {
      fontSize: 28,
      fontWeight: '950',
      color: colors.accent,
    },
    statusBadge: {
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 3,
      borderRadius: radius.sm,
    },
    statusActive: {
      backgroundColor: isDark ? 'rgba(76, 175, 80, 0.15)' : 'rgba(46, 125, 50, 0.1)',
    },
    statusSold: {
      backgroundColor: isDark ? 'rgba(244, 67, 54, 0.15)' : 'rgba(198, 40, 40, 0.1)',
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      color: colors.accent,
    },
    title: {
      fontSize: 21,
      fontWeight: '800',
      color: colors.text,
      marginBottom: spacing.md,
      lineHeight: 28,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: spacing.sm,
    },
    badgeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#2C1D15' : colors.accentSoft,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm - 2,
      borderRadius: radius.pill,
      marginRight: spacing.sm,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: isDark ? colors.border : 'transparent',
    },
    badgeText: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: '750',
      textTransform: 'capitalize',
      marginLeft: 4,
    },
    sectionDivider: {
      height: 1,
      backgroundColor: colors.divider,
      marginVertical: spacing.lg,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
      marginBottom: spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    description: {
      fontSize: 15,
      lineHeight: 24,
      color: colors.textMuted,
    },

    // Seller Box
    sellerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginTop: spacing.xs,
    },
    sellerAvatarWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.skeleton,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      marginRight: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sellerAvatar: {
      width: '100%',
      height: '100%',
    },
    sellerAvatarFallback: {
      flex: 1,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accentSoft,
    },
    sellerInitial: {
      color: colors.accent,
      fontSize: 18,
      fontWeight: '700',
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
      fontWeight: '700',
      color: colors.text,
      flexShrink: 1,
    },
    verifiedIcon: {
      marginLeft: spacing.xs,
    },
    sellerRole: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
      fontWeight: '500',
    },

    // Fixed Bottom Action Bar
    actions: {
      flexDirection: 'row',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm + 2,
      paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.md,
      borderTopWidth: 1.5,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 8,
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
      fontWeight: '700',
      marginLeft: spacing.sm,
    },
    primaryButton: {
      backgroundColor: colors.accent,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 3,
    },
    primaryButtonText: {
      color: colors.textInverse,
      fontSize: 15,
      fontWeight: '700',
    },

    // Image Preview Modal
    previewModalContainer: {
      flex: 1,
      backgroundColor: '#000000',
      justifyContent: 'center',
    },
    previewCloseBtn: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 60 : 30,
      right: spacing.lg,
      zIndex: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    previewImageContainer: {
      width: SCREEN_WIDTH,
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    previewImage: {
      width: SCREEN_WIDTH,
      height: '100%',
    },
    previewPagination: {
      position: 'absolute',
      bottom: Platform.OS === 'ios' ? 50 : 30,
      alignSelf: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm - 2,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    previewPaginationText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
    },
  });
