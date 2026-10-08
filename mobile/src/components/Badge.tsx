import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

type Tone = 'neutral' | 'accent' | 'danger' | 'warning' | 'info';

interface Props {
  label: string;
  tone?: Tone;
  style?: ViewStyle;
}

const toneColors: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: colors.slate[100], fg: colors.textSecondary },
  accent: { bg: colors.primarySoft, fg: colors.primaryDark },
  danger: { bg: colors.danger[50], fg: colors.danger[600] },
  warning: { bg: colors.warning[50], fg: colors.warning[600] },
  info: { bg: colors.info[50], fg: colors.info[600] },
};

/** Small status chip. */
export default function Badge({ label, tone = 'neutral', style }: Props) {
  const c = toneColors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }, style]}>
      <Text style={[styles.label, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
  },
  label: {
    ...typography.tiny,
  },
});
