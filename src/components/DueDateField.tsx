import { useState } from 'react';

import { addDays, todayISO } from '@/domain/dates';

import { Chip } from './Chip';
import { DateField } from './DateField';

const PRESETS = [
  { label: '1 setmana', days: 7 },
  { label: '2 setmanes', days: 14 },
  { label: '1 mes', days: 30 },
];

type Props = {
  /** ISO date, or undefined for "no due date". */
  value: string | undefined;
  onChange: (iso: string | undefined) => void;
  /** Earliest allowed due date (the debt's own date). */
  minimum?: string;
};

/** "Sense límit" · quick presets counted from today · "Una altra…" with a date picker. */
export function DueDateField({ value, onChange, minimum }: Props) {
  const today = todayISO();
  const matchesPreset = (v: string | undefined) => PRESETS.some((p) => addDays(today, p.days) === v);
  const [custom, setCustom] = useState(value !== undefined && !matchesPreset(value));

  return (
    <>
      <Chip
        label="Sense límit"
        selected={!custom && value === undefined}
        onPress={() => {
          setCustom(false);
          onChange(undefined);
        }}
      />
      {PRESETS.map((p) => {
        const date = addDays(today, p.days);
        return (
          <Chip
            key={p.days}
            label={p.label}
            selected={!custom && value === date}
            onPress={() => {
              setCustom(false);
              onChange(date);
            }}
          />
        );
      })}
      <Chip
        label="Una altra…"
        selected={custom}
        onPress={() => {
          setCustom(true);
          if (value === undefined) onChange(addDays(today, 7));
        }}
      />
      {custom && value !== undefined ? (
        <DateField value={value} onChange={onChange} minimum={minimum} accessibilityLabel="Data límit" />
      ) : null}
    </>
  );
}
