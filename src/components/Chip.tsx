import { Pressable, StyleSheet } from 'react-native';

import { colors, radius, space, touchTarget } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

/** Selectable pill (filters, payment method, quick amounts). */
export function Chip({ label, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.idle,
        pressed && { opacity: 0.75 },
      ]}>
      <AppText variant="captionStrong" color={selected ? colors.bg : colors.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: touchTarget - 4,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    justifyContent: 'center',
    borderWidth: 1,
  },
  idle: { borderColor: colors.border, backgroundColor: 'transparent' },
  selected: { borderColor: colors.text, backgroundColor: colors.text },
});
