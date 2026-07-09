// ---------------------------------------------------------------------------
// LoginScreen — combined Login / Register auth screen.
// A single text link toggles between the two modes. No navigation is performed
// here: RootNavigator swaps to the main tabs automatically once `user` is set
// in AuthContext.
// ---------------------------------------------------------------------------

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';

const SCREEN_HEIGHT = Dimensions.get('window').height;

const ROLES = [
  { value: 'buyer', label: '🛍️ Buyer' },
  { value: 'seller', label: '💼 Seller' },
];

export default function LoginScreen({ navigation, route }) {
  const { login, register } = useAuth();
  const { colors, spacing, radius, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = getStyles(colors, spacing, radius, isDark, insets);

  const [isLogin, setIsLogin] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [role, setRole] = useState('buyer');
  const [focusedField, setFocusedField] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  function toggleMode() {
    setIsLogin((prev) => !prev);
  }

  function describeError(err) {
    if (!err) return 'Something went wrong. Please try again.';
    if (err.response?.data?.message) {
      return err.response.data.message;
    }
    if (err.response?.data?.errors) {
      const errors = err.response.data.errors;
      const firstField = Object.keys(errors)[0];
      if (firstField && Array.isArray(errors[firstField]) && errors[firstField][0]) {
        return errors[firstField][0];
      }
    }
    if (err.message) return err.message;
    return 'Something went wrong. Please try again.';
  }

  async function handleSubmit() {
    if (submitting) return;

    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Please enter your email and password.');
      return;
    }

    if (!isLogin) {
      if (!name.trim()) {
        Alert.alert('Missing details', 'Please enter your name.');
        return;
      }
      if (password !== passwordConfirmation) {
        Alert.alert('Password mismatch', 'The passwords do not match.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isLogin) {
        await login(email.trim(), password);
      } else {
        await register({
          name: name.trim(),
          email: email.trim(),
          password,
          password_confirmation: passwordConfirmation,
          role,
        });
      }
    } catch (err) {
      Alert.alert(isLogin ? 'Sign in failed' : 'Registration failed', describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Modern styled branded header - fills status bar, contents placed safely */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="basket" size={32} color={colors.textInverse} />
          </View>
          <Text style={styles.brand}>Marketplace</Text>
          <Text style={styles.tagline}>
            {isLogin ? 'Sign in to access your chat & orders' : 'Create an account to get started'}
          </Text>
        </View>

        <View style={styles.form}>
          {/* Name — register only */}
          {!isLogin && (
            <View style={styles.field}>
              <Text style={styles.label}>Full Name</Text>
              <View style={[styles.inputContainer, focusedField === 'name' && styles.inputFocused]}>
                <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  editable={!submitting}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>
          )}

          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>Email Address</Text>
            <View style={[styles.inputContainer, focusedField === 'email' && styles.inputFocused]}>
              <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                editable={!submitting}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputContainer, focusedField === 'password' && styles.inputFocused]}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.muted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType={isLogin ? 'go' : 'next'}
                editable={!submitting}
                onSubmitEditing={isLogin ? handleSubmit : undefined}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm password + role chooser — register only */}
          {!isLogin && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={[styles.inputContainer, focusedField === 'passwordConfirmation' && styles.inputFocused]}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={passwordConfirmation}
                    onChangeText={setPasswordConfirmation}
                    placeholder="••••••••"
                    placeholderTextColor={colors.muted}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="go"
                    editable={!submitting}
                    onSubmitEditing={handleSubmit}
                    onFocus={() => setFocusedField('passwordConfirmation')}
                    onBlur={() => setFocusedField(null)}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Choose Your Role</Text>
                <View style={styles.roleRow}>
                  {ROLES.map((r) => {
                    const selected = role === r.value;
                    return (
                      <TouchableOpacity
                        key={r.value}
                        style={[styles.chip, selected && styles.chipSelected]}
                        onPress={() => setRole(r.value)}
                        disabled={submitting}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </>
          )}

          {/* Primary submit button */}
          <TouchableOpacity
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.buttonText}>
                {isLogin ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Mode toggle link */}
          <TouchableOpacity
            style={styles.toggle}
            onPress={toggleMode}
            disabled={submitting}
            activeOpacity={0.7}
          >
            <Text style={styles.toggleText}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.toggleLink}>
                {isLogin ? 'Register' : 'Sign In'}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors, spacing, radius, isDark, insets) =>
  StyleSheet.create({
    flex: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'flex-start',
    },
    // Modern full-bleed background for status bar, content padded below it
    header: {
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.xl,
      paddingTop: insets.top + spacing.md,
      paddingBottom: spacing.xl + 4,
      alignItems: 'center',
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
    },
    logoContainer: {
      width: 60,
      height: 60,
      borderRadius: radius.md,
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    brand: {
      color: colors.textInverse,
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    tagline: {
      color: colors.textInverse,
      fontSize: 13,
      marginTop: spacing.xs,
      opacity: 0.85,
      textAlign: 'center',
      paddingHorizontal: spacing.lg,
      lineHeight: 18,
    },
    form: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
    },
    field: {
      marginBottom: spacing.md + 2,
    },
    label: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '750',
      marginBottom: spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      height: 48,
    },
    inputIcon: {
      marginRight: spacing.sm,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      height: '100%',
      padding: 0, // remove Android vertical padding issues
    },
    inputFocused: {
      borderColor: colors.accent,
    },
    eyeBtn: {
      padding: spacing.xs,
    },
    // Role chips.
    roleRow: {
      flexDirection: 'row',
      marginTop: spacing.xs,
    },
    chip: {
      flex: 1,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginRight: spacing.sm,
    },
    chipSelected: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accent,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textMuted,
    },
    chipTextSelected: {
      color: colors.accent,
    },
    // Primary button.
    button: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.md,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.2 : 0.25,
      shadowRadius: 6,
      elevation: 3,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: colors.textInverse,
      fontSize: 15,
      fontWeight: '700',
    },
    // Mode toggle link.
    toggle: {
      marginTop: spacing.xl,
      alignItems: 'center',
      paddingBottom: spacing.lg,
    },
    toggleText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '500',
    },
    toggleLink: {
      color: colors.accent,
      fontWeight: '700',
    },
  });
