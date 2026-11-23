import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, radius, space, touchTarget } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  disabled?: boolean;
  /** Stacked icon over label (used for the big action tiles). */
  stacked?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.accent, fg: colors.onAccent },
  secondary: { bg: colors.surface, fg: colors.text, border: colors.borderStrong },
  ghost: { bg: 'transparent', fg: colors.accent },
  danger: { bg: 'transparent', fg: colors.danger, border: colors.border },
};

export function Button({ label, onPress, variant = 'primary', icon, disabled, stacked, style, accessibilityHint }: Props) {
  const p = palette[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        stacked && styles.stacked,
        { backgroundColor: p.bg, borderColor: p.border ?? 'transparent', opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        style,
      ]}>
      <View style={[styles.content, stacked && styles.contentStacked]}>
        {icon ? <Icon name={icon} size={18} color={p.fg} /> : null}
        <AppText variant="bodyStrong" color={p.fg} style={styles.label} numberOfLines={1}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget + 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
  },
  stacked: { minHeight: 72 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  contentStacked: { flexDirection: 'column', gap: 6 },
  label: { fontFamily: fonts.bodySemiBold },
});
