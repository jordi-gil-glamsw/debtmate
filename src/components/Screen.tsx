import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, space } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = {
  children: ReactNode;
  /** Large title shown at the top (tab screens). */
  title?: string;
  /** Element rendered at the right of the title row. */
  titleAccessory?: ReactNode;
  /** Respect the top safe area (Dynamic Island / status bar). False when a native header is shown. */
  topInset?: boolean;
};

/** Scrollable screen with safe-area aware padding and a max content width for tablets/web. */
export function Screen({ children, title, titleAccessory, topInset = true }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.scroll}
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        { paddingTop: (topInset ? insets.top : 0) + space.lg, paddingBottom: insets.bottom + 96 },
      ]}>
      <View style={styles.inner}>
        {title ? (
          <View style={styles.titleRow}>
            <AppText variant="largeTitle" accessibilityRole="header">
              {title}
            </AppText>
            {titleAccessory}
          </View>
        ) : null}
        {children}
      </View>
    </ScrollView>
  );
}

export function SectionHeader({ title, accessory }: { title: string; accessory?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      {accessory}
    </View>
  );
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <AppText variant="heading">{title}</AppText>
      <AppText variant="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>
        {message}
      </AppText>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.xl, alignItems: 'center' },
  inner: { width: '100%', maxWidth: 720, gap: space.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: space.sm },
  empty: {
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xxxl,
    paddingHorizontal: space.xl,
    backgroundColor: colors.surface,
    borderRadius: 20,
  },
});
