// ---------------------------------------------------------------------------
// SellScreen (Tab 3 — Sell)
//
// Lets a seller create a new listing: title, price (with prefix $), description,
// a category chosen from chips, a condition chip, and up to 8 photos picked
// from the device library. Redesigned with dynamic theme support, premium
// image grid, and clean input borders.
// ---------------------------------------------------------------------------

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import api from '../config/api';
import { useAuth } from '../store/AuthContext';
import { useTheme } from '../store/ThemeContext';

const MAX_IMAGES = 8;

const CONDITIONS = [
  { value: 'new', label: '✨ New' },
  { value: 'like_new', label: '💎 Like New' },
  { value: 'used', label: '🔧 Used' },
];

export default function SellScreen({ navigation, route }) {
  const { user } = useAuth();
  const { colors, spacing, radius, isDark } = useTheme();
  const styles = getStyles(colors, spacing, radius, isDark);

  // ---- Form state ----
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [condition, setCondition] = useState('used');
  const [images, setImages] = useState([]); // array of ImagePicker assets
  const [focusedField, setFocusedField] = useState(null);

  // ---- Async/UI state ----
  const [categories, setCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // ---- Load categories ----
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.categories.list();
        if (mounted) setCategories(res.data || []);
      } catch (e) {
        if (mounted) setCategories([]);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // ---- Image picking ----
  async function handleAddPhotos() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission needed',
        'Please allow photo library access to add listing photos.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
      quality: 0.7,
    });

    if (result.canceled || !result.assets) return;

    setImages((prev) => [...prev, ...result.assets].slice(0, MAX_IMAGES));
  }

  function removeImage(index) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  function resetForm() {
    setTitle('');
    setPrice('');
    setDescription('');
    setCategoryId(null);
    setCondition('used');
    setImages([]);
  }

  // ---- Submit ----
  async function handleSubmit() {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please enter a title for your listing.');
      return;
    }
    if (!price.trim()) {
      Alert.alert('Missing price', 'Please enter a price.');
      return;
    }
    if (!categoryId) {
      Alert.alert('Missing category', 'Please choose a category.');
      return;
    }

    setSubmitting(true);
    try {
      await api.listings.create({
        title: title.trim(),
        price: price.trim(),
        description: description.trim(),
        category_id: categoryId,
        condition,
        status: 'active',
        images,
      });

      Alert.alert('Listing published', 'Your listing is now live.');
      resetForm();
      navigation.navigate('Explore');
    } catch (e) {
      const msg =
        (e.response && e.response.data && e.response.data.message) ||
        'Could not publish your listing. Please try again.';
      Alert.alert('Something went wrong', msg);
    } finally {
      setSubmitting(false);
    }
  }

  const isBuyer = user && user.role === 'buyer';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Create a listing</Text>

        {isBuyer ? (
          <View style={styles.note}>
            <Ionicons name="information-circle" size={20} color={colors.accentDark} style={{ marginRight: spacing.sm }} />
            <Text style={styles.noteText}>
              Only sellers can publish listings. You can fill this in, but publishing may be rejected.
            </Text>
          </View>
        ) : null}

        {/* Photos Upload Section */}
        <Text style={styles.label}>Photos ({images.length}/{MAX_IMAGES})</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photoScroll}
        >
          {/* Add photo tile */}
          <TouchableOpacity
            style={[
              styles.photoTile,
              styles.addPhotoTile,
              images.length >= MAX_IMAGES && styles.addPhotoTileDisabled,
            ]}
            onPress={handleAddPhotos}
            disabled={images.length >= MAX_IMAGES || submitting}
            activeOpacity={0.8}
          >
            <Ionicons
              name="camera"
              size={24}
              color={images.length >= MAX_IMAGES ? colors.muted : colors.accent}
            />
            <Text
              style={[
                styles.addPhotoLabel,
                images.length >= MAX_IMAGES && styles.addPhotoLabelDisabled,
              ]}
              allowFontScaling={false}
            >
              Add Photo
            </Text>
          </TouchableOpacity>

          {/* List of picked images */}
          {images.map((img, index) => (
            <View key={img.uri || index} style={styles.photoTile}>
              <Image source={{ uri: img.uri }} style={styles.tileImage} />
              {index === 0 && (
                <View style={styles.coverBadge}>
                  <Text style={styles.coverBadgeText}>COVER</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.deleteBadge}
                activeOpacity={0.8}
                onPress={() => removeImage(index)}
                disabled={submitting}
              >
                <Ionicons name="close" size={14} color={colors.textInverse} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        {/* Title */}
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={[styles.input, focusedField === 'title' && styles.inputFocused]}
          value={title}
          onChangeText={setTitle}
          placeholder="What are you selling?"
          placeholderTextColor={colors.muted}
          onFocus={() => setFocusedField('title')}
          onBlur={() => setFocusedField(null)}
          editable={!submitting}
        />

        {/* Price Input with Fixed Currency Prefix */}
        <Text style={styles.label}>Price</Text>
        <View style={[styles.inputContainer, focusedField === 'price' && styles.inputFocused]}>
          <Text style={styles.pricePrefix}>$</Text>
          <TextInput
            style={styles.priceInput}
            value={price}
            onChangeText={setPrice}
            placeholder="0.00"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            onFocus={() => setFocusedField('price')}
            onBlur={() => setFocusedField(null)}
            editable={!submitting}
          />
        </View>

        {/* Description */}
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[
            styles.input,
            styles.multiline,
            focusedField === 'description' && styles.inputFocused,
          ]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe your item in detail (e.g. size, brand, model, wear and tear)..."
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          onFocus={() => setFocusedField('description')}
          onBlur={() => setFocusedField(null)}
          editable={!submitting}
        />

        {/* Category selector chips */}
        <Text style={styles.label}>Category</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {categories.map((cat) => {
            const selected = categoryId === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => setCategoryId(cat.id)}
                disabled={submitting}
              >
                <Text
                  style={[styles.chipText, selected && styles.chipTextSelected]}
                  numberOfLines={1}
                  allowFontScaling={false}
                >
                  {cat.icon ? `${cat.icon} ` : ''}
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
          {categories.length === 0 ? (
            <Text style={styles.emptyHint}>No categories available.</Text>
          ) : null}
        </ScrollView>

        {/* Condition selector chips */}
        <Text style={styles.label}>Condition</Text>
        <View style={styles.chipRow}>
          {CONDITIONS.map((c) => {
            const selected = condition === c.value;
            return (
              <TouchableOpacity
                key={c.value}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => setCondition(c.value)}
                disabled={submitting}
              >
                <Text
                  style={[styles.chipText, selected && styles.chipTextSelected]}
                  numberOfLines={1}
                  allowFontScaling={false}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={styles.submitText}>
              Publish Listing
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors, spacing, radius, isDark) =>
  StyleSheet.create({
    flex: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: spacing.lg,
      paddingBottom: Platform.OS === 'ios' ? spacing.xxl + 40 : spacing.xxl + 20,
    },
    heading: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
      marginBottom: spacing.md,
    },

    // Buyer warning note
    note: {
      backgroundColor: colors.isDark ? '#2C1D15' : colors.accentSoft,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.isDark ? colors.border : 'transparent',
    },
    noteText: {
      color: colors.accentDark,
      fontSize: 13,
      fontWeight: '600',
      flex: 1,
      lineHeight: 18,
    },

    // Labels + inputs
    label: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.xs,
      marginTop: spacing.lg,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    input: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md - 2,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    inputFocused: {
      borderColor: colors.accent,
    },
    multiline: {
      minHeight: 120,
      paddingTop: spacing.md - 2,
    },

    // Price input
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      height: 50,
    },
    pricePrefix: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      marginRight: spacing.xs,
    },
    priceInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      height: '100%',
      padding: 0,
    },

    // Category & Condition chips
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingVertical: spacing.xs,
    },
    chip: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm - 2,
      marginRight: spacing.sm,
      marginBottom: spacing.sm,
      backgroundColor: colors.surface,
    },
    chipSelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    chipTextSelected: {
      color: colors.textInverse,
    },
    emptyHint: {
      color: colors.textMuted,
      fontSize: 13,
      paddingVertical: spacing.sm,
    },

    // Photos Picker Grid
    photoScroll: {
      paddingVertical: spacing.xs,
      alignItems: 'center',
    },
    photoTile: {
      width: 90,
      height: 90,
      borderRadius: radius.md,
      marginRight: spacing.sm,
      position: 'relative',
      backgroundColor: colors.skeleton,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addPhotoTile: {
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addPhotoTileDisabled: {
      borderColor: colors.border,
      backgroundColor: colors.skeleton,
    },
    addPhotoLabel: {
      color: colors.accent,
      fontSize: 11,
      fontWeight: '700',
      marginTop: spacing.xs,
    },
    addPhotoLabelDisabled: {
      color: colors.textMuted,
    },
    tileImage: {
      width: '100%',
      height: '100%',
      borderRadius: radius.md - 1,
    },
    coverBadge: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.accent,
      paddingVertical: 2,
      alignItems: 'center',
      borderBottomLeftRadius: radius.md - 2,
      borderBottomRightRadius: radius.md - 2,
    },
    coverBadgeText: {
      fontSize: 8,
      fontWeight: '800',
      color: colors.textInverse,
      letterSpacing: 0.5,
    },
    deleteBadge: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 2,
      elevation: 3,
    },

    // Submit
    submitBtn: {
      marginTop: spacing.xl,
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.2 : 0.3,
      shadowRadius: 6,
      elevation: 4,
    },
    submitBtnDisabled: {
      opacity: 0.6,
    },
    submitText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: '700',
    },
  });
