import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/tokens';

import { AppText } from './AppText';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <View
      style={[styles.box, { width: size, height: size, borderRadius: size * 0.3 }]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      <AppText variant={size >= 48 ? 'bodyStrong' : 'captionStrong'}>{initials(name)}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
});
