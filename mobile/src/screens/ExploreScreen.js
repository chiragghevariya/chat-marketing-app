// ---------------------------------------------------------------------------
// ExploreScreen — Tab 1.
//
// Browse active listings in a 2-column grid with:
//   - a search bar (sets the `q` query param),
//   - horizontal category chips (top-level categories + an "All" chip),
//   - a filter modal (min/max price + condition), and
//   - pull-to-refresh, a loading spinner and an empty state.
//
// Listings are fetched from GET /listings with the assembled params; empty
// values are omitted so the backend applies its defaults.
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import api from '../config/api';
import ListingCard from '../components/ListingCard';
import { colors, spacing, radius } from '../config/theme';

// Condition options offered in the filter modal (value -> label).
const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'used', label: 'Used' },
];

export default function ExploreScreen({ navigation }) {
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

  // Fetch listings for the current params. `isRefresh` drives the pull-to-refresh
  // spinner instead of the full-screen loader.
  const fetchListings = useCallback(
    async (isRefresh) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await api.listings.list(buildParams());
        setListings(res.data || []);
      } catch (e) {
        // On failure, show the empty state rather than stale data.
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

  // Render a single category chip; `selected` styles it with the accent bg.
  const renderChip = (key, label, selected, onPress) => (
    <TouchableOpacity
      key={key}
      style={[styles.chip, selected && styles.chipSelected]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search bar + filter button */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search listings"
            placeholderTextColor={colors.muted}
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={onSubmitSearch}
            returnKeyType="search"
          />
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          activeOpacity={0.8}
          onPress={openFilters}
        >
          <Ionicons
            name="funnel"
            size={20}
            color={hasActiveFilters ? colors.accent : colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Category chips */}
      <View style={styles.chipsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContent}
        >
          {/* "All" chip clears the selected category */}
          {renderChip('all', 'All', categoryId === null, () =>
            setCategoryId(null)
          )}
          {categories.map((cat) =>
            renderChip(cat.id, cat.name, categoryId === cat.id, () =>
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
              onPress={() =>
                navigation.navigate('ListingDetail', { listingId: item.id })
              }
            />
          )}
          contentContainerStyle={
            listings.length === 0 ? styles.emptyContent : styles.listContent
          }
          refreshing={refreshing}
          onRefresh={() => fetchListings(true)}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons
                name="search-outline"
                size={48}
                color={colors.muted}
              />
              <Text style={styles.emptyText}>No listings found</Text>
              <Text style={styles.emptySubText}>
                Try adjusting your search or filters
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
          <View style={styles.modalSheet}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <TouchableOpacity
                onPress={() => setFilterVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Price range */}
            <Text style={styles.label}>Price Range</Text>
            <View style={styles.priceRow}>
              <TextInput
                style={[styles.input, styles.priceInput]}
                placeholder="Min"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                value={draftMin}
                onChangeText={setDraftMin}
              />
              <Text style={styles.priceDash}>-</Text>
              <TextInput
                style={[styles.input, styles.priceInput]}
                placeholder="Max"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                value={draftMax}
                onChangeText={setDraftMax}
              />
            </View>

            {/* Condition selector */}
            <Text style={styles.label}>Condition</Text>
            <View style={styles.conditionRow}>
              {CONDITIONS.map((c) => {
                const selected = draftCondition === c.value;
                return (
                  <TouchableOpacity
                    key={c.value}
                    style={[styles.chip, selected && styles.chipSelected]}
                    activeOpacity={0.8}
                    // Tapping a selected chip toggles it back off.
                    onPress={() =>
                      setDraftCondition(selected ? '' : c.value)
                    }
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selected && styles.chipTextSelected,
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
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.applyButton]}
                activeOpacity={0.8}
                onPress={applyFilters}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
    paddingBottom: spacing.sm,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.divider,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    height: 42,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: 15,
    color: colors.text,
    padding: 0, // remove default vertical padding on Android
  },
  filterButton: {
    marginLeft: spacing.sm,
    width: 42,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Category chips
  chipsWrap: {
    paddingBottom: spacing.sm,
  },
  chipsContent: {
    paddingHorizontal: spacing.lg,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: 13,
    color: colors.text,
  },
  chipTextSelected: {
    color: colors.textInverse,
    fontWeight: '600',
  },

  // List
  listContent: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.lg,
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
  emptyText: {
    marginTop: spacing.md,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  emptySubText: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.textMuted,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    fontSize: 15,
    color: colors.text,
  },
  priceInput: {
    flex: 1,
  },
  priceDash: {
    marginHorizontal: spacing.sm,
    color: colors.textMuted,
  },
  conditionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
  },
  clearButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
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
