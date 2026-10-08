/**
 * Login screen — modern minimalist.
 * Centered brand mark, generous whitespace, single accent.
 */
import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInputInstance,
} from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { Button, Card, Input } from '../../components';
import { colors, spacing, typography } from '../../theme';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const login = useAuthStore(s => s.login);
  const passwordRef = useRef<TextInputInstance | null>(null);

  const handleLogin = async () => {
    if (submitting) {
      return;
    }
    if (!username.trim() || !password) {
      setFormError('Username dan password wajib diisi.');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Login gagal. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled">
        {/* Brand */}
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>K</Text>
          </View>
          <Text style={styles.appName}>Kasir POS</Text>
          <Text style={styles.tagline}>Kelola toko dengan tenang</Text>
        </View>

        {/* Form */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Selamat datang kembali</Text>
          <Text style={styles.cardSubtitle}>Masuk untuk melanjutkan ke kasir</Text>

          <Input
            label="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            editable={!submitting}
            testID="login-username"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={handleLogin}
            editable={!submitting}
            error={formError ?? undefined}
            testID="login-password"
          />

          <Button
            title="Masuk"
            onPress={handleLogin}
            loading={submitting}
            size="lg"
            style={styles.submit}
            testID="login-submit"
          />
        </Card>

        <Text style={styles.footer}>v1.0 · Tugas Kuliah 001</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.huge,
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logoText: {
    ...typography.display,
    color: colors.white,
    fontSize: 36,
  },
  appName: {
    ...typography.title,
    color: colors.text,
  },
  tagline: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  card: {
    padding: spacing.xxl,
  },
  cardTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  submit: {
    marginTop: spacing.md,
  },
  footer: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xxxl,
  },
});
