// ---------------------------------------------------------------------------
// SellScreen (Tab 3 — Sell)
//
// Lets a seller create a new listing: title, price, description, a category
// chosen from horizontal chips, a condition chip, and up to 8 photos picked
// from the device library. On submit the form is sent to the backend as a
// multipart upload (the api layer builds the FormData; S3 happens server-side).
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

import api from '../config/api';
import { useAuth } from '../store/AuthContext';
import { colors, spacing, radius } from '../config/theme';

// Maximum number of photos the backend accepts per listing.
const MAX_IMAGES = 8;

// Condition options shown as selectable chips.
const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'used', label: 'Used' },
];

export default function SellScreen({ navigation, route }) {
  const { user } = useAuth();

  // ---- Form state ---------------------------------------------------------
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [condition, setCondition] = useState('used');
  const [images, setImages] = useState([]); // array of ImagePicker assets

  // ---- Async/UI state -----------------------------------------------------
  const [categories, setCategories] = useState([]); // top-level category tree
  const [submitting, setSubmitting] = useState(false);

  // ---- Load top-level categories on mount ---------------------------------
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await api.categories.list();
        // res.data is a tree; the top-level entries are used for chips.
        if (mounted) setCategories(res.data || []);
      } catch (e) {
        // Non-fatal: the user can still type a listing; category is required
        // for submit, so surface a gentle hint instead of blocking the screen.
        if (mounted) setCategories([]);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // ---- Image picking ------------------------------------------------------
  async function handleAddPhotos() {
    // Ask for library permission before opening the picker.
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
      selectionLimit: MAX_IMAGES,
      quality: 0.7,
    });

    if (result.canceled || !result.assets) return;

    // Merge with any existing selection, capping the total at MAX_IMAGES.
    setImages((prev) => [...prev, ...result.assets].slice(0, MAX_IMAGES));
  }

  // Remove a single selected photo by index.
  function removeImage(index) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  // ---- Reset the form after a successful create ---------------------------
  function resetForm() {
    setTitle('');
    setPrice('');
    setDescription('');
    setCategoryId(null);
    setCondition('used');
    setImages([]);
  }

  // ---- Submit -------------------------------------------------------------
  async function handleSubmit() {
    // Validate the required fields before hitting the network.
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
      // The api layer builds the multipart FormData (images + scalars).
      await api.listings.create({
        title: title.trim(),
        price: price.trim(),
        description: description.trim(),
        category_id: categoryId,
        condition,
        status: 'active',
        images, // ImagePicker assets: { uri, fileName, mimeType, ... }
      });

      Alert.alert('Listing published', 'Your listing is now live.');
      resetForm();
    } catch (e) {
      // Surface the backend message when available (e.g. role/validation).
      const msg =
        (e.response && e.response.data && e.response.data.message) ||
        'Could not publish your listing. Please try again.';
      Alert.alert('Something went wrong', msg);
    } finally {
      setSubmitting(false);
    }
  }

  // Buyers can attempt to submit; the backend enforces seller-only publishing.
  const isBuyer = user && user.role === 'buyer';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>Create a listing</Text>

        {isBuyer ? (
          <View style={styles.note}>
            <Text style={styles.noteText}>
              Only sellers can publish listings. You can fill this in, but
              publishing may be rejected.
            </Text>
          </View>
        ) : null}

        {/* Title */}
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="What are you selling?"
          placeholderTextColor={colors.muted}
        />

        {/* Price */}
        <Text style={styles.label}>Price</Text>
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          placeholder="0.00"
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
        />

        {/* Description */}
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe your item..."
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Category chips (top-level categories) */}
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
              >
                <Text
                  style={[styles.chipText, selected && styles.chipTextSelected]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
          {categories.length === 0 ? (
            <Text style={styles.emptyHint}>No categories available.</Text>
          ) : null}
        </ScrollView>

        {/* Condition chips */}
        <Text style={styles.label}>Condition</Text>
        <View style={styles.chipRow}>
          {CONDITIONS.map((c) => {
            const selected = condition === c.value;
            return (
              <TouchableOpacity
                key={c.value}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => setCondition(c.value)}
              >
                <Text
                  style={[styles.chipText, selected && styles.chipTextSelected]}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Photos */}
        <Text style={styles.label}>Photos ({images.length}/{MAX_IMAGES})</Text>
        <TouchableOpacity
          style={styles.addPhotosBtn}
          onPress={handleAddPhotos}
          disabled={images.length >= MAX_IMAGES}
        >
          <Text style={styles.addPhotosText}>
            {images.length >= MAX_IMAGES ? 'Maximum photos added' : 'Add photos'}
          </Text>
        </TouchableOpacity>

        {images.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbRow}
          >
            {images.map((img, index) => (
              <View key={img.uri || index} style={styles.thumbWrap}>
                <Image source={{ uri: img.uri }} style={styles.thumb} />
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeImage(index)}
                >
                  <Text style={styles.removeBtnText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={styles.submitText}>Publish listing</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
  },

  // Buyer note
  note: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  noteText: {
    color: colors.accentDark,
    fontSize: 13,
  },

  // Labels + inputs
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  multiline: {
    minHeight: 100,
    paddingTop: spacing.sm,
  },

  // Chips (category + condition)
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: 14,
    color: colors.text,
  },
  chipTextSelected: {
    color: colors.textInverse,
    fontWeight: '600',
  },
  emptyHint: {
    color: colors.textMuted,
    fontSize: 13,
    paddingVertical: spacing.sm,
  },

  // Photos
  addPhotosBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
  },
  addPhotosText: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 15,
  },
  thumbRow: {
    paddingVertical: spacing.md,
  },
  thumbWrap: {
    marginRight: spacing.sm,
    position: 'relative',
  },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    backgroundColor: colors.skeleton,
  },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    color: colors.textInverse,
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '700',
  },

  // Submit
  submitBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
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
