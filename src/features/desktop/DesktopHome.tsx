import { Link, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View, type PressableStateCallbackType } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { BalanceBar, ProgressBar } from '@/components/BalanceBar';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { MovementRow } from '@/components/MovementRow';
import { balanceLabel } from '@/components/PersonRow';
import { settlementProgress, sortNewestFirst } from '@/domain/balances';
import { formatShortDate, todayISO } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { upcomingDueDates } from '@/domain/reminders';
import type { Movement } from '@/domain/types';
import { useContactsWithBalance, useMovements, useTotals } from '@/store/store';
import { balanceColor, colors, fonts, radius, space } from '@/theme/tokens';

/** Accent- and case-insensitive search ("marti" finds "Martí"). */
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const hoverable = (state: PressableStateCallbackType) => Boolean((state as { hovered?: boolean }).hovered);

type Person = ReturnType<typeof useContactsWithBalance>[number];

/**
 * Desktop web home (design "B · Web escriptori"): summary cards, a people table and a
 * detail panel for the selected person. The selection lives in the URL (?p=<id>).
 */
export function DesktopHome() {
  const totals = useTotals();
  const people = useContactsWithBalance();
  const movements = useMovements();
  const { p: selectedParam } = useLocalSearchParams<{ p?: string }>();
  const [query, setQuery] = useState('');
  const today = todayISO();

  const byContact = useMemo(() => {
    const map = new Map<string, Movement[]>();
    for (const m of sortNewestFirst(movements)) {
      const list = map.get(m.contactId) ?? [];
      list.push(m);
      map.set(m.contactId, list);
    }
    return map;
  }, [movements]);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return q ? people.filter((p) => normalize(p.name).includes(q)) : people;
  }, [people, query]);

  const selected = people.find((p) => p.id === selectedParam) ?? people.find((p) => p.balance !== 0) ?? people[0];
  const select = (id: string) => router.setParams({ p: id });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.toolbar}>
        <View style={styles.search}>
          <Icon name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Cerca una persona"
            placeholderTextColor={colors.textFaint}
            accessibilityLabel="Cerca una persona"
            style={styles.searchInput}
          />
        </View>
        <View style={styles.toolbarActions}>
          <Button
            label="Registrar pagament"
            variant="secondary"
            disabled={!selected || selected.balance === 0}
            onPress={() => selected && router.push({ pathname: '/pagament/[id]', params: { id: selected.id } })}
          />
          <Button
            label="Nou moviment"
            icon="add"
            onPress={() =>
              router.push({ pathname: '/nou', params: selected ? { contactId: selected.id } : {} })
            }
          />
        </View>
      </View>

      <View style={styles.cards}>
        <View style={[styles.card, styles.cardWide]}>
          <AppText variant="caption" color={colors.textMuted}>
            Balanç net
          </AppText>
          <AppText variant="amountLarge">{formatMoney(totals.net, { sign: 'always' })}</AppText>
          <BalanceBar owedToMe={totals.owedToMe} iOwe={totals.iOwe} height={8} />
        </View>
        <View style={styles.card}>
          <AppText variant="caption" color={colors.textMuted}>
            Em deuen · {totals.peopleOwingMe} {totals.peopleOwingMe === 1 ? 'persona' : 'persones'}
          </AppText>
          <AppText variant="amountLarge" color={colors.owedToMe}>
            {formatMoney(totals.owedToMe)}
          </AppText>
        </View>
        <View style={styles.card}>
          <AppText variant="caption" color={colors.textMuted}>
            Dec · {totals.peopleIOwe} {totals.peopleIOwe === 1 ? 'persona' : 'persones'}
          </AppText>
          <AppText variant="amountLarge" color={colors.iOwe}>
            {formatMoney(totals.iOwe)}
          </AppText>
        </View>
      </View>

      <View style={styles.columns}>
        <View style={[styles.panel, styles.tablePanel]}>
          <AppText variant="heading" accessibilityRole="header" style={styles.panelTitle}>
            Persones
          </AppText>
          {people.length === 0 ? (
            <EmptyTable />
          ) : (
            <View accessibilityRole="list">
              <View style={[styles.tr, styles.thead]}>
                <AppText variant="captionStrong" color={colors.textMuted} style={styles.colName}>
                  Nom
                </AppText>
                <AppText variant="captionStrong" color={colors.textMuted} style={styles.colLast}>
                  Últim moviment
                </AppText>
                <AppText variant="captionStrong" color={colors.textMuted} style={styles.colDue}>
                  Data límit
                </AppText>
                <AppText variant="captionStrong" color={colors.textMuted} style={styles.colAmount}>
                  Saldo
                </AppText>
              </View>
              {visible.map((p) => (
                <PersonTableRow
                  key={p.id}
                  person={p}
                  last={byContact.get(p.id)?.[0]?.concept}
                  due={upcomingDueDates(byContact.get(p.id) ?? [], p.id, p.balance, today)[0]}
                  selected={p.id === selected?.id}
                  onPress={() => select(p.id)}
                />
              ))}
              {visible.length === 0 ? (
                <AppText variant="caption" color={colors.textMuted} style={styles.noResults}>
                  Cap persona coincideix amb «{query.trim()}».
                </AppText>
              ) : null}
            </View>
          )}
        </View>

        {selected ? <DetailPanel person={selected} movements={byContact.get(selected.id) ?? []} today={today} /> : null}
      </View>
    </ScrollView>
  );
}

function PersonTableRow({ person, last, due, selected, onPress }: {
  person: Person;
  last?: string;
  due?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${person.name}, ${balanceLabel(person.balance)} ${formatMoney(person.balance, { sign: 'never' })}`}
      style={(state) => [
        styles.tr,
        styles.row,
        (selected || hoverable(state)) && { backgroundColor: selected ? colors.surfaceRaised : colors.surfaceMuted + '55' },
      ]}>
      <View style={[styles.colName, styles.nameCell]}>
        <Avatar name={person.name} size={32} />
        <AppText variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
          {person.name}
        </AppText>
      </View>
      <AppText variant="body" color={colors.textMuted} numberOfLines={1} style={styles.colLast}>
        {last ?? '—'}
      </AppText>
      <AppText variant="body" color={due ? colors.text : colors.textMuted} style={styles.colDue}>
        {due ? formatShortDate(due) : '—'}
      </AppText>
      <AppText variant="amount" color={balanceColor(person.balance)} style={styles.colAmount}>
        {person.balance === 0 ? 'al dia' : formatMoney(person.balance, { sign: 'always' })}
      </AppText>
    </Pressable>
  );
}

function DetailPanel({ person, movements, today }: { person: Person; movements: Movement[]; today: string }) {
  const progress = useMemo(() => settlementProgress(movements, person.id), [movements, person.id]);
  const due = upcomingDueDates(movements, person.id, person.balance, today)[0];
  const firstName = person.name.split(' ')[0];
  const theyOwe = person.balance > 0;

  return (
    <View style={[styles.panel, styles.detail]} accessibilityLabel={`Detall de ${person.name}`}>
      <View style={styles.detailHeader}>
        <Avatar name={person.name} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading" numberOfLines={1}>
            {person.name}
          </AppText>
          <Link href={{ pathname: '/persona/[id]', params: { id: person.id } }}>
            <AppText variant="captionStrong" color={colors.accent}>
              Obre la fitxa
            </AppText>
          </Link>
        </View>
      </View>

      <View style={{ gap: 4 }}>
        <AppText variant="caption" color={colors.textMuted}>
          {person.balance === 0 ? 'Esteu al dia' : theyOwe ? 'Et deu' : 'Li deus'}
        </AppText>
        <AppText variant="amountLarge" color={balanceColor(person.balance)}>
          {formatMoney(Math.abs(person.balance))}
        </AppText>
      </View>

      {progress && (progress.returned > 0 || due) ? (
        <View style={{ gap: space.sm }}>
          <ProgressBar ratio={progress.ratio} />
          <View style={styles.progressLabels}>
            <AppText variant="small" color={colors.textMuted}>
              Retornat {formatMoney(progress.returned)}
            </AppText>
            {due ? (
              <AppText variant="small" color={colors.textMuted}>
                Límit {formatShortDate(due)}
              </AppText>
            ) : null}
          </View>
        </View>
      ) : null}

      <View>
        {movements.slice(0, 8).map((m) => (
          <MovementRow
            key={m.id}
            movement={m}
            onPress={() => router.push({ pathname: '/moviment/[id]', params: { id: m.id } })}
          />
        ))}
        {movements.length > 8 ? (
          <Link href={{ pathname: '/persona/[id]', params: { id: person.id } }}>
            <AppText variant="captionStrong" color={colors.accent}>
              Veure els {movements.length} moviments
            </AppText>
          </Link>
        ) : null}
      </View>

      <View style={{ gap: space.sm }}>
        {person.balance !== 0 ? (
          <Button
            label={theyOwe ? `Cobrar de ${firstName}` : `Pagar a ${firstName}`}
            icon="payment"
            onPress={() => router.push({ pathname: '/pagament/[id]', params: { id: person.id } })}
          />
        ) : null}
        <Button
          label="Afegir moviment"
          variant="secondary"
          icon="add"
          onPress={() => router.push({ pathname: '/nou', params: { contactId: person.id } })}
        />
      </View>
    </View>
  );
}

function EmptyTable() {
  return (
    <View style={styles.empty}>
      <AppText variant="heading">Encara no hi ha ningú</AppText>
      <AppText variant="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>
        Apunta el primer deute amb «Nou moviment».
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 40, paddingTop: 28, paddingBottom: 40, gap: space.xxl, maxWidth: 1400, width: '100%', alignSelf: 'center' },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, justifyContent: 'space-between', alignItems: 'center' },
  search: {
    flexGrow: 1,
    flexBasis: 260,
    maxWidth: 420,
    height: 44,
    borderRadius: radius.md - 2,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
  },
  searchInput: { flex: 1, minWidth: 0, color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 15, height: '100%' },
  toolbarActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  card: { flexGrow: 1, flexBasis: 220, padding: space.xl, borderRadius: radius.xl, backgroundColor: colors.surface, gap: space.sm },
  cardWide: { flexGrow: 1.4 },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xl, alignItems: 'flex-start' },
  panel: { borderRadius: radius.xl, backgroundColor: colors.surface },
  tablePanel: { flexGrow: 3, flexBasis: 480, minWidth: 0, paddingVertical: space.sm },
  panelTitle: { marginHorizontal: space.xl, marginTop: space.md, marginBottom: space.sm },
  tr: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl },
  thead: { paddingVertical: 10 },
  row: { paddingVertical: space.md, borderTopWidth: 1, borderTopColor: colors.surfaceRaised },
  colName: { flex: 3, minWidth: 0 },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  colLast: { flex: 3, minWidth: 0 },
  colDue: { flex: 1.4 },
  colAmount: { flex: 1.6, textAlign: 'right' },
  noResults: { paddingHorizontal: space.xl, paddingVertical: space.lg },
  detail: { flexGrow: 2, flexBasis: 320, minWidth: 300, maxWidth: 460, padding: space.xl, gap: space.xl },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: 48, paddingHorizontal: space.xl },
});
