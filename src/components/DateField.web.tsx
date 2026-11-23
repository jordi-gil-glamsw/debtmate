import { useRef } from 'react';

import { formatFieldDate } from '@/domain/dates';
import { colors, fonts, radius } from '@/theme/tokens';

import type { DateFieldProps } from './DateField';

type PickerInput = HTMLInputElement & { showPicker?: () => void };

/**
 * Web: a button with our own label ("Avui", "23 nov."), backed by a hidden native date input.
 * The browser formats <input type="date"> with its UI language (often MM/dd/yyyy), not the
 * user's regional settings, so we never show its text; we only use its calendar popup.
 */
export function DateField({ value, onChange, minimum, maximum, accessibilityLabel }: DateFieldProps) {
  const input = useRef<PickerInput>(null);

  const open = () => {
    const el = input.current;
    if (!el) return;
    try {
      if (el.showPicker) el.showPicker();
      else el.focus();
    } catch {
      el.focus(); // showPicker can throw outside a user gesture or in cross-origin frames
    }
  };

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={open}
        aria-label={`${accessibilityLabel}: ${formatFieldDate(value)}`}
        style={{
          background: colors.surfaceMuted,
          color: colors.text,
          border: 'none',
          borderRadius: radius.sm,
          padding: '6px 12px',
          fontFamily: fonts.bodySemiBold,
          fontSize: 15,
          cursor: 'pointer',
        }}>
        {formatFieldDate(value)}
      </button>
      <input
        ref={input}
        type="date"
        value={value}
        min={minimum}
        max={maximum}
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
        // Visually hidden but laid out under the button, so the popup opens next to it.
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: '100%',
          height: 1,
          opacity: 0,
          border: 'none',
          padding: 0,
          pointerEvents: 'none',
          colorScheme: 'dark',
        }}
      />
    </span>
  );
}
