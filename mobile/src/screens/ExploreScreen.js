// ---------------------------------------------------------------------------
// ExploreScreen — Tab 1.
//
// Browse active listings in a 2-column grid with dynamic theme support,
// a premium search bar, attractive category chips, and a sliding filter sheet.
// ---------------------------------------------------------------------------

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import api from '../config/api';
import ListingCard from '../components/ListingCard';
import { useTheme } from '../store/ThemeContext';

const CONDITIONS = [
  { value: 'new', label: '✨ New' },
  { value: 'like_new', label: '💎 Like New' },
  { value: 'used', label: '🔧 Used' },
];

export default function ExploreScreen({ navigation }) {
  const { colors, spacing, radius, isDark } = useTheme();
  const styles = getStyles(colors, spacing, radius, isDark);

  // Top-level categories (chips). `categoryId` null = the "All" chip.
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState(null);

  // Search: `searchText` is the live input; `q` is the committed/applied term.
  const [searchText, setSearchText] = useState('');
  const [q, setQ] = useState('');

  // Applied filters (committed via the modal's Apply button).
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [condition, setCondition] = useState('');

  // Draft filter values edited inside the modal before being applied.
  const [filterVisible, setFilterVisible] = useState(false);
  const [draftMin, setDraftMin] = useState('');
  const [draftMax, setDraftMax] = useState('');
  const [draftCondition, setDraftCondition] = useState('');

  // Listings data + request state.
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Build the listings query, omitting empty values.
  const buildParams = useCallback(() => {
    const params = { status: 'active' };
    if (q) params.q = q;
    if (categoryId) params.category_id = categoryId;
    if (minPrice) params.min_price = minPrice;
    if (maxPrice) params.max_price = maxPrice;
    if (condition) params.condition = condition;
    return params;
  }, [q, categoryId, minPrice, maxPrice, condition]);

  // Fetch listings for the current params.
  const fetchListings = useCallback(
    async (isRefresh) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await api.listings.list(buildParams());
        setListings(res.data || []);
      } catch (e) {
        setListings([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [buildParams]
  );

  // Load top-level categories once on mount.
  useEffect(() => {
    let active = true;
    api.categories
      .list()
      .then((res) => {
        if (active) setCategories(res.data || []);
      })
      .catch(() => {
        if (active) setCategories([]);
      });
    return () => {
      active = false;
    };
  }, []);

  // Refetch whenever any applied filter/search/category changes.
  useEffect(() => {
    fetchListings(false);
  }, [fetchListings]);

  // Commit the search term from the input on submit.
  const onSubmitSearch = () => setQ(searchText.trim());

  // Open the modal seeded with the currently applied filter values.
  const openFilters = () => {
    setDraftMin(minPrice);
    setDraftMax(maxPrice);
    setDraftCondition(condition);
    setFilterVisible(true);
  };

  // Apply the modal's draft values (triggers a refetch via effect).
  const applyFilters = () => {
    setMinPrice(draftMin.trim());
    setMaxPrice(draftMax.trim());
    setCondition(draftCondition);
    setFilterVisible(false);
  };

  // Reset both the draft and applied filters.
  const clearFilters = () => {
    setDraftMin('');
    setDraftMax('');
    setDraftCondition('');
    setMinPrice('');
    setMaxPrice('');
    setCondition('');
    setFilterVisible(false);
  };

  // True when any price/condition filter is active (for the funnel badge).
  const hasActiveFilters = !!(minPrice || maxPrice || condition);

  const renderCategoryChip = (cat, selected, onPress) => {
    const label = cat.name;
    return (
      <TouchableOpacity
        key={cat.id || 'all'}
        style={[styles.catChip, selected && styles.catChipSelected]}
        activeOpacity={0.8}
        onPress={onPress}
      >
        <Text style={[styles.catChipText, selected && styles.catChipTextSelected]}>
          {cat.icon ? `${cat.icon} ` : ''}
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search bar + filter button */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products, brands, models..."
            placeholderTextColor={colors.muted}
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={onSubmitSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
        <TouchableOpacity
          style={[
            styles.filterButton,
            hasActiveFilters && styles.filterButtonActive,
          ]}
          activeOpacity={0.8}
          onPress={openFilters}
        >
          <Ionicons
            name="options"
            size={20}
            color={hasActiveFilters ? colors.textInverse : colors.text}
          />
          {hasActiveFilters && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>

      {/* Category Section */}
      <View style={styles.catSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catContent}
        >
          {renderCategoryChip(
            { id: null, name: 'All' },
            categoryId === null,
            () => setCategoryId(null)
          )}
          {categories.map((cat) =>
            renderCategoryChip(cat, categoryId === cat.id, () =>
              setCategoryId(cat.id)
            )
          )}
        </ScrollView>
      </View>

      {/* Listings grid / loading / empty state */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              style={styles.gridItem}
              onPress={() =>
                navigation.navigate('ListingDetail', { listingId: item.id })
              }
            />
          )}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={
            listings.length === 0 ? styles.emptyContent : styles.listContent
          }
          refreshing={refreshing}
          onRefresh={() => fetchListings(true)}
          ListEmptyComponent={
            <View style={styles.centered}>
              <View style={styles.emptyIconContainer}>
                <Ionicons
                  name="search-outline"
                  size={42}
                  color={colors.textMuted}
                />
              </View>
              <Text style={styles.emptyText}>No listings found</Text>
              <Text style={styles.emptySubText}>
                We couldn't find matches. Try broadening your keywords or filters.
              </Text>
            </View>
          }
        />
      )}

      {/* Filter modal */}
      <Modal
        visible={filterVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setFilterVisible(false)} />
          <View style={styles.modalSheet}>
            {/* Drag handle decorator */}
            <View style={styles.dragHandle} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <TouchableOpacity
                onPress={() => setFilterVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle-outline" size={26} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Price range */}
            <Text style={styles.label}>Price Range</Text>
            <View style={styles.priceRow}>
              <View style={styles.priceInputWrapper}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="Min"
                  placeholderTextColor={colors.muted}
                  keyboardType="numeric"
                  value={draftMin}
                  onChangeText={setDraftMin}
                />
              </View>
              <Text style={styles.priceDash}>to</Text>
              <View style={styles.priceInputWrapper}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="Max"
                  placeholderTextColor={colors.muted}
                  keyboardType="numeric"
                  value={draftMax}
                  onChangeText={setDraftMax}
                />
              </View>
            </View>

            {/* Condition selector */}
            <Text style={styles.label}>Condition</Text>
            <View style={styles.conditionRow}>
              {CONDITIONS.map((c) => {
                const selected = draftCondition === c.value;
                return (
                  <TouchableOpacity
                    key={c.value}
                    style={[styles.filterChip, selected && styles.filterChipSelected]}
                    activeOpacity={0.8}
                    onPress={() =>
                      setDraftCondition(selected ? '' : c.value)
                    }
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selected && styles.filterChipTextSelected,
                      ]}
                    >
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.clearButton]}
                activeOpacity={0.8}
                onPress={clearFilters}
              >
                <Text style={styles.clearButtonText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.applyButton]}
                activeOpacity={0.8}
                onPress={applyFilters}
              >
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors, spacing, radius, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    // Search row
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
    },
    searchBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      height: 46,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      marginLeft: spacing.sm,
      fontSize: 15,
      color: colors.text,
      padding: 0,
      height: '100%',
    },
    filterButton: {
      marginLeft: spacing.sm,
      width: 46,
      height: 46,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      position: 'relative',
    },
    filterButtonActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    filterDot: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#FFEB3B', // visible yellow dot on orange active filter button
    },

    // Category section
    catSection: {
      paddingVertical: spacing.sm,
      backgroundColor: colors.background,
    },
    catContent: {
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      paddingBottom: 2,
    },
    catChip: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm - 2,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginRight: spacing.sm,
    },
    catChipSelected: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accent,
    },
    catChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    catChipTextSelected: {
      color: colors.accent,
    },

    // Grid layout
    columnWrapper: {
      justifyContent: 'space-between',
      paddingHorizontal: spacing.sm,
    },
    gridItem: {
      maxWidth: '48.5%', // prevent card overlap/stretching in 2-column layout
    },
    listContent: {
      paddingBottom: spacing.xl + 20,
    },
    emptyContent: {
      flexGrow: 1,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    emptyIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.isDark ? '#2D2D2D' : '#F0F0F0',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.xs,
    },
    emptySubText: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      paddingHorizontal: spacing.xl,
      lineHeight: 20,
    },

    // Bottom Modal sheet
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg + 8,
      borderTopRightRadius: radius.lg + 8,
      padding: spacing.lg,
      paddingBottom: Platform.OS === 'ios' ? spacing.xxl + 10 : spacing.xl,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 10,
    },
    dragHandle: {
      width: 40,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
    },
    label: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    priceInputWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      height: 48,
      backgroundColor: colors.background,
    },
    currencySymbol: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textMuted,
      marginRight: spacing.xs,
    },
    priceInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      height: '100%',
      padding: 0,
    },
    priceDash: {
      marginHorizontal: spacing.md,
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
    },
    conditionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: spacing.xl,
    },
    filterChip: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.background,
      marginRight: spacing.sm,
      marginBottom: spacing.sm,
    },
    filterChipSelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    filterChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    filterChipTextSelected: {
      color: colors.textInverse,
    },
    modalActions: {
      flexDirection: 'row',
      marginTop: spacing.sm,
    },
    actionButton: {
      flex: 1,
      height: 52,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clearButton: {
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginRight: spacing.sm,
    },
    clearButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textMuted,
    },
    applyButton: {
      backgroundColor: colors.accent,
      marginLeft: spacing.sm,
    },
    applyButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textInverse,
    },
  });
