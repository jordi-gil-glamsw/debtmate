import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { describeMovement, MovementRow } from '@/components/MovementRow';
import { EmptyState, Screen } from '@/components/Screen';
import { monthSummary, sortNewestFirst } from '@/domain/balances';
import { formatDayHeading, formatMonth } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import type { Movement } from '@/domain/types';
import { useContacts, useMovements } from '@/store/store';
import { colors, radius, space, touchTarget } from '@/theme/tokens';

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="small" color={colors.textMuted}>
        {label}
      </AppText>
      <AppText variant="heading" color={color} style={{ fontSize: 21 }}>
        {value}
      </AppText>
    </View>
  );
}

export default function ActivityScreen() {
  const movements = useMovements();
  const contacts = useContacts();
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });

  const shift = (delta: number) =>
    setCursor(({ year, month }) => {
      const index = year * 12 + (month - 1) + delta;
      return { year: Math.floor(index / 12), month: (index % 12) + 1 };
    });

  const names = useMemo(() => new Map(contacts.map((c) => [c.id, c.name])), [contacts]);
  const summary = useMemo(() => monthSummary(movements, cursor.year, cursor.month), [movements, cursor]);

  const groups = useMemo(() => {
    const prefix = `${cursor.year}-${String(cursor.month).padStart(2, '0')}`;
    const byDay = new Map<string, Movement[]>();
    for (const m of sortNewestFirst(movements.filter((m) => m.date.startsWith(prefix)))) {
      const list = byDay.get(m.date) ?? [];
      list.push(m);
      byDay.set(m.date, list);
    }
    return [...byDay.entries()];
  }, [movements, cursor]);

  return (
    <Screen title="Activitat">
      <View style={styles.monthNav}>
        <Pressable onPress={() => shift(-1)} accessibilityRole="button" accessibilityLabel="Mes anterior" style={styles.navButton}>
          <Icon name="back" size={18} color={colors.textMuted} />
        </Pressable>
        <AppText variant="bodyStrong" accessibilityRole="header">
          {formatMonth(cursor.year, cursor.month)}
        </AppText>
        <Pressable onPress={() => shift(1)} accessibilityRole="button" accessibilityLabel="Mes següent" style={styles.navButton}>
          <Icon name="chevronRight" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.grid}>
        <Stat label="Nous deutes a favor" value={formatMoney(summary.newOwedToMe)} color={colors.owedToMe} />
        <Stat label="Nous deutes en contra" value={formatMoney(summary.newIOwe)} color={colors.iOwe} />
        <Stat label="T'han retornat" value={formatMoney(summary.receivedBack)} />
        <Stat label="Has retornat" value={formatMoney(summary.paidBack)} />
      </View>

      {groups.length === 0 ? (
        <EmptyState title="Sense moviments" message="Aquest mes no hi ha cap moviment." />
      ) : (
        groups.map(([day, items]) => (
          <View key={day}>
            <AppText variant="overline" color={colors.textMuted} accessibilityRole="header" style={styles.day}>
              {formatDayHeading(day)}
            </AppText>
            {items.map((m) => (
              <MovementRow
                key={m.id}
                movement={m}
                subtitle={`${names.get(m.contactId) ?? '—'} · ${describeMovement(m).toLowerCase()}`}
              />
            ))}
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: space.xs,
  },
  day: { marginTop: space.sm, marginBottom: space.xs },
});
