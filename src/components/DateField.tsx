import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { formatFieldDate, parseISODate, toISODate } from '@/domain/dates';
import { colors, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';

export type DateFieldProps = {
  /** ISO date (YYYY-MM-DD). */
  value: string;
  onChange: (iso: string) => void;
  minimum?: string;
  maximum?: string;
  accessibilityLabel: string;
};

/**
 * Native date picker: SwiftUI's compact picker on iOS (tap → calendar popover),
 * a button that opens the Material calendar dialog on Android.
 */
export function DateField({ value, onChange, minimum, maximum, accessibilityLabel }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const common = {
    value: parseISODate(value),
    mode: 'date' as const,
    minimumDate: minimum ? parseISODate(minimum) : undefined,
    maximumDate: maximum ? parseISODate(maximum) : undefined,
    accentColor: colors.accent,
    themeVariant: 'dark' as const,
    // No `locale`: the native picker follows the device's regional format.
  };

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.ios} accessibilityLabel={accessibilityLabel}>
        <DateTimePicker {...common} display="compact" onValueChange={(_e, date) => onChange(toISODate(date))} />
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel}: ${formatFieldDate(value)}`}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}>
        <AppText variant="bodyStrong">{formatFieldDate(value)}</AppText>
      </Pressable>
      {open ? (
        <DateTimePicker
          {...common}
          presentation="dialog"
          positiveButton={{ label: 'D’acord' }}
          negativeButton={{ label: 'Cancel·la' }}
          onChange={(event, date) => {
            setOpen(false);
            if (event.type === 'set' && date) onChange(toISODate(date));
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  ios: { alignItems: 'flex-start' },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
});
