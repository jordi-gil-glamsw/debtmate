import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { PersonRow } from '@/components/PersonRow';
import { EmptyState, Screen, SectionHeader } from '@/components/Screen';
import { formatShortDate } from '@/domain/dates';
import { expenseShares, groupBalances, ME, myNetEffect } from '@/domain/groups';
import { formatMoney } from '@/domain/money';
import type { GroupExpense } from '@/domain/types';
import { useBalances, useContacts, useExpenses, useGroup } from '@/store/store';
import { balanceColor, colors, radius, space } from '@/theme/tokens';

function ExpenseRow({ expense, payerName, net }: { expense: GroupExpense; payerName: string; net: number }) {
  const people = expense.participantIds.length + (expense.includesMe ? 1 : 0);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/despesa', params: { id: expense.id } })}
      accessibilityRole="button"
      accessibilityHint="Obre la despesa per editar-la"
      style={({ pressed }) => [styles.expense, pressed && { opacity: 0.7 }]}>
      <View style={styles.expenseIcon}>
        <Icon name="receipt" size={18} color={colors.textMuted} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {expense.concept}
        </AppText>
        <AppText variant="small" color={colors.textMuted} numberOfLines={1}>
          {formatShortDate(expense.date)} · {formatMoney(expense.amountCents)} · {payerName} · {people} pers.
        </AppText>
      </View>
      <AppText variant="amount" color={balanceColor(net)}>
        {formatMoney(net, { sign: 'always', currency: false })}
      </AppText>
    </Pressable>
  );
}

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = useGroup(id);
  const contacts = useContacts();
  const allExpenses = useExpenses();
  const balances = useBalances();

  const names = useMemo(() => new Map(contacts.map((c) => [c.id, c.name])), [contacts]);
  const exists = useMemo(() => (cid: string) => names.has(cid), [names]);
  const expenses = useMemo(
    () =>
      allExpenses
        .filter((e) => e.groupId === id)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [allExpenses, id],
  );
  const fromGroup = useMemo(() => groupBalances(expenses, exists), [expenses, exists]);
  const stats = useMemo(() => {
    let total = 0;
    let mine = 0;
    let net = 0;
    for (const e of expenses) {
      total += e.amountCents;
      mine += expenseShares(e).get(ME) ?? 0;
      net += myNetEffect(e, exists);
    }
    return { total, mine, net };
  }, [expenses, exists]);

  if (!group) {
    return (
      <Screen topInset={false}>
        <Stack.Screen options={{ title: '' }} />
        <EmptyState title="Grup no trobat" message="Potser s'ha esborrat." />
      </Screen>
    );
  }

  const members = group.memberIds
    .filter((m) => names.has(m))
    .map((m) => ({ id: m, name: names.get(m)!, balance: balances.get(m) ?? 0, fromGroup: fromGroup.get(m) ?? 0 }))
    .sort((a, b) => Math.abs(b.fromGroup) - Math.abs(a.fromGroup) || a.name.localeCompare(b.name, 'ca'));

  const payerName = (e: GroupExpense) => (e.paidBy === null ? 'Has pagat tu' : `Ha pagat ${(names.get(e.paidBy) ?? '—').split(' ')[0]}`);

  return (
    <Screen topInset={false}>
      <Stack.Screen
        options={{
          title: group.name,
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: '/editar-grup', params: { id: group.id } })}
              accessibilityRole="button"
              accessibilityLabel={`Edita ${group.name}`}
              hitSlop={8}
              style={Platform.OS === 'web' ? { paddingHorizontal: space.lg } : undefined}>
              <AppText variant="bodyStrong" color={colors.accent}>
                Edita
              </AppText>
            </Pressable>
          ),
        }}
      />

      <View style={styles.card}>
        <AppText variant="captionStrong" color={balanceColor(stats.net)}>
          {stats.net > 0 ? 'Del grup, et deuen' : stats.net < 0 ? 'Del grup, deus' : 'Grup quadrat'}
        </AppText>
        <AppText variant="amountLarge" style={{ fontSize: 46, lineHeight: 52 }}>
          {formatMoney(stats.net, { sign: 'never' })}
        </AppText>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <AppText variant="small" color={colors.textMuted}>
              Total gastat
            </AppText>
            <AppText variant="bodyStrong">{formatMoney(stats.total)}</AppText>
          </View>
          <View style={styles.stat}>
            <AppText variant="small" color={colors.textMuted}>
              La teva part
            </AppText>
            <AppText variant="bodyStrong">{formatMoney(stats.mine)}</AppText>
          </View>
        </View>
      </View>

      <Button label="Nova despesa" icon="add" onPress={() => router.push({ pathname: '/despesa', params: { grup: group.id } })} />

      <SectionHeader title="Despeses" />
      {expenses.length === 0 ? (
        <EmptyState title="Sense despeses" message="Apunta el primer dinar o compra compartida: es repartirà a parts iguals." />
      ) : (
        <View>
          {expenses.map((e) => (
            <ExpenseRow key={e.id} expense={e} payerName={payerName(e)} net={myNetEffect(e, exists)} />
          ))}
        </View>
      )}

      <SectionHeader title="Persones" />
      <View style={styles.people}>
        {members.map((m) => (
          <PersonRow
            key={m.id}
            id={m.id}
            name={m.name}
            balance={m.balance}
            subtitle={m.fromGroup === 0 ? 'Res d’aquest grup' : `D’aquest grup: ${formatMoney(m.fromGroup, { sign: 'always' })}`}
          />
        ))}
      </View>
      <AppText variant="small" color={colors.textFaint}>
        A la dreta, el saldo total amb cada persona. Per cobrar o pagar, entra a la persona.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space.xl,
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.sm,
  },
  stats: { flexDirection: 'row', gap: space.lg, marginTop: space.sm },
  stat: { flex: 1, gap: 2 },
  expense: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 },
  expenseIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  people: { gap: space.sm },
});
