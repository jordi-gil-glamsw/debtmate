import { Pressable, StyleSheet, View } from 'react-native';

import { colors, touchTarget } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = {
  title: string;
  onCancel: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
};

/**
 * In-content header for form sheets: Cancel · Title · Save (iOS pattern).
 * Drawn in content because Android form sheets don't render native headers.
 */
export function SheetHeader({ title, onCancel, onConfirm, confirmLabel = 'Desa', confirmDisabled }: Props) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onCancel} accessibilityRole="button" style={styles.side} hitSlop={8}>
        <AppText variant="body" color={colors.textMuted}>
          Cancel·la
        </AppText>
      </Pressable>
      <AppText variant="bodyStrong" accessibilityRole="header" numberOfLines={1} style={styles.title}>
        {title}
      </AppText>
      <View style={[styles.side, styles.right]}>
        {onConfirm ? (
          <Pressable
            onPress={onConfirm}
            disabled={confirmDisabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: confirmDisabled }}
            hitSlop={8}>
            <AppText variant="bodyStrong" color={confirmDisabled ? colors.textFaint : colors.accent}>
              {confirmLabel}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: touchTarget + 8 },
  side: { minWidth: 84, minHeight: touchTarget, justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center' },
});
