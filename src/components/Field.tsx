import type { ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, radius, space, touchTarget } from '@/theme/tokens';

import { AppText } from './AppText';

/** Grouped form container (iOS inset-grouped list look). */
export function FieldGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

type FieldProps = TextInputProps & { label: string; last?: boolean };

export function TextField({ label, last, style, ...input }: FieldProps) {
  return (
    <View style={[styles.row, !last && styles.divider]}>
      <AppText variant="body" color={colors.textMuted} style={styles.label}>
        {label}
      </AppText>
      <TextInput
        {...input}
        accessibilityLabel={label}
        placeholderTextColor={colors.textFaint}
        style={[styles.input, style]}
      />
    </View>
  );
}

export function FieldRow({ label, children, last }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.divider]}>
      <AppText variant="body" color={colors.textMuted} style={styles.label}>
        {label}
      </AppText>
      <View style={styles.rowContent}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: touchTarget + 8 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  label: { width: 92 },
  input: { flex: 1, color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 15, paddingVertical: 12 },
  rowContent: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingVertical: space.sm },
});
