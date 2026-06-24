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
} from 'react-native';

import { useAuth } from '../../store/AuthContext';
import { colors, spacing, radius } from '../../config/theme';

// Selectable roles for the register form. `value` matches the backend
// (buyer|seller); `label` is what we show on the chip.
const ROLES = [
  { value: 'buyer', label: 'Buyer' },
  { value: 'seller', label: 'Seller' },
];

export default function LoginScreen({ navigation, route }) {
  const { login, register } = useAuth();

  // `mode` flips between the two forms. true = login, false = register.
  const [isLogin, setIsLogin] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form fields (shared where it makes sense across both modes).
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [role, setRole] = useState('buyer');

  // Toggle between Login and Register, clearing any submitting state.
  function toggleMode() {
    setIsLogin((prev) => !prev);
  }

  // Pull a readable error message out of whatever the API / context threw.
  function describeError(err) {
    if (!err) return 'Something went wrong. Please try again.';
    if (err.message) return err.message;
    return 'Something went wrong. Please try again.';
  }

  async function handleSubmit() {
    if (submitting) return;

    // Lightweight client-side validation before hitting the network.
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
        // Build a plain object matching the backend register contract.
        await register({
          name: name.trim(),
          email: email.trim(),
          password,
          password_confirmation: passwordConfirmation,
          role,
        });
      }
      // On success RootNavigator re-renders to the tabs; nothing to do here.
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
      >
        {/* Orange branded header */}
        <View style={styles.header}>
          <Text style={styles.brand}>Marketplace</Text>
          <Text style={styles.tagline}>
            {isLogin ? 'Welcome back' : 'Create your account'}
          </Text>
        </View>

        <View style={styles.form}>
          {/* Name — register only */}
          {!isLogin && (
            <View style={styles.field}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={colors.muted}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                editable={!submitting}
              />
            </View>
          )}

          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
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
            />
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType={isLogin ? 'go' : 'next'}
              editable={!submitting}
              onSubmitEditing={isLogin ? handleSubmit : undefined}
            />
          </View>

          {/* Confirm password + role chooser — register only */}
          {!isLogin && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Confirm password</Text>
                <TextInput
                  style={styles.input}
                  value={passwordConfirmation}
                  onChangeText={setPasswordConfirmation}
                  placeholder="••••••••"
                  placeholderTextColor={colors.muted}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  editable={!submitting}
                  onSubmitEditing={handleSubmit}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>I want to</Text>
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
                        <Text
                          style={[
                            styles.chipText,
                            selected && styles.chipTextSelected,
                          ]}
                        >
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
                {isLogin ? 'Sign in' : 'Create account'}
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
              {isLogin
                ? "Don't have an account? "
                : 'Already have an account? '}
              <Text style={styles.toggleLink}>
                {isLogin ? 'Register' : 'Sign in'}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  // Orange branded header block.
  header: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  brand: {
    color: colors.textInverse,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tagline: {
    color: colors.textInverse,
    fontSize: 16,
    marginTop: spacing.xs,
    opacity: 0.9,
  },
  form: {
    padding: spacing.xl,
  },
  field: {
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  // Role chips.
  roleRow: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  chipTextSelected: {
    color: colors.accent,
  },
  // Primary button.
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    minHeight: 52,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '700',
  },
  // Mode toggle link.
  toggle: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  toggleText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  toggleLink: {
    color: colors.accent,
    fontWeight: '700',
  },
});
