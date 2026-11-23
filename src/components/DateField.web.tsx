import { colors, fonts, radius } from '@/theme/tokens';

import type { DateFieldProps } from './DateField';

/** Web: the browser's own date input, styled to match the dark theme. */
export function DateField({ value, onChange, minimum, maximum, accessibilityLabel }: DateFieldProps) {
  return (
    <input
      type="date"
      value={value}
      min={minimum}
      max={maximum}
      aria-label={accessibilityLabel}
      onChange={(e) => {
        if (e.target.value) onChange(e.target.value);
      }}
      style={{
        colorScheme: 'dark',
        background: colors.surfaceMuted,
        color: colors.text,
        border: 'none',
        borderRadius: radius.sm,
        padding: '6px 12px',
        fontFamily: fonts.bodySemiBold,
        fontSize: 15,
      }}
    />
  );
}
