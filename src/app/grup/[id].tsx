import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { MovementRow } from '@/components/MovementRow';
import { EmptyState, Screen, SectionHeader } from '@/components/Screen';
import { WalletSwitcher } from '@/components/WalletSwitcher';
import { sortNewestFirst } from '@/domain/balances';
import { formatShortDate } from '@/domain/dates';
import { expenseShares, groupBalances, groupNet, groupShareMessage, ME, myNetEffect } from '@/domain/groups';
import { formatMoney } from '@/domain/money';
import type { GroupExpense } from '@/domain/types';
import { shareText } from '@/lib/dialogs';
import { useBalances, useContacts, useExpenses, useGroup, useMovements } from '@/store/store';
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
          {expense.split === 'exact' ? ' · per imports' : ''}
        </AppText>
      </View>
      <AppText variant="amount" color={balanceColor(net)}>
        {formatMoney(net, { sign: 'always', currency: false })}
      </AppText>
    </Pressable>
  );
}

type Member = { id: string; name: string; total: number; fromGroup: number };

function MemberRow({ member, groupId }: { member: Member; groupId: string }) {
  const { id, name, total, fromGroup } = member;
  const label = fromGroup > 0 ? 'et deu' : fromGroup < 0 ? 'li deus' : 'al dia';
  // Two sibling pressables (not nested): the row opens the person, the pill settles.
  return (
    <View style={styles.member}>
      <Pressable
        onPress={() => router.push({ pathname: '/persona/[id]', params: { id } })}
        accessibilityRole="button"
        accessibilityLabel={`${name}, d’aquest grup ${label} ${formatMoney(fromGroup, { sign: 'never' })}`}
        style={({ pressed }) => [styles.memberMain, pressed && { opacity: 0.75 }]}>
        <Avatar name={name} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {name}
          </AppText>
          <AppText variant="small" color={colors.textMuted} numberOfLines={1}>
            Saldo total {formatMoney(total, { sign: 'always' })}
          </AppText>
        </View>
      </Pressable>
      <View style={styles.memberRight}>
        <AppText variant="amount" color={balanceColor(fromGroup)}>
          {fromGroup === 0 ? '0,00' : formatMoney(fromGroup, { sign: 'always', currency: false })}
        </AppText>
        {fromGroup !== 0 ? (
          <Pressable
            onPress={() => router.push({ pathname: '/pagament/[id]', params: { id, grup: groupId } })}
            accessibilityRole="button"
            accessibilityLabel={`Liquida amb ${name}`}
            hitSlop={6}
            style={({ pressed }) => [styles.settle, pressed && { opacity: 0.7 }]}>
            <Icon name="check" size={12} color={colors.onAccent} />
            <AppText variant="small" color={colors.onAccent} style={{ fontWeight: '600' }}>
              Liquida
            </AppText>
          </Pressable>
        ) : (
          <AppText variant="small" color={colors.textMuted}>
            al dia
          </AppText>
        )}
      </View>
    </View>
  );
}

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = useGroup(id);
  const contacts = useContacts();
  const allExpenses = useExpenses();
  const movements = useMovements();
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
  const payments = useMemo(() => movements.filter((m) => m.kind === 'payment' && m.groupId === id), [movements, id]);
  const fromGroup = useMemo(() => groupBalances(expenses, payments, exists), [expenses, payments, exists]);
  const stats = useMemo(() => {
    let total = 0;
    let mine = 0;
    for (const e of expenses) {
      total += e.amountCents;
      mine += expenseShares(e).get(ME) ?? 0;
    }
    return { total, mine, net: groupNet(fromGroup) };
  }, [expenses, fromGroup]);

  if (!group) {
    return (
      <Screen topInset={false}>
        <Stack.Screen options={{ title: '' }} />
        <EmptyState title="Grup no trobat" message="Potser s'ha esborrat." />
      </Screen>
    );
  }

  // Members, plus anyone still pending from the group who is no longer a member.
  const memberIds = [...new Set([...group.memberIds, ...[...fromGroup].filter(([, v]) => v !== 0).map(([cid]) => cid)])];
  const members: Member[] = memberIds
    .filter((m) => names.has(m))
    .map((m) => ({ id: m, name: names.get(m)!, total: balances.get(m) ?? 0, fromGroup: fromGroup.get(m) ?? 0 }))
    .sort((a, b) => Math.abs(b.fromGroup) - Math.abs(a.fromGroup) || a.name.localeCompare(b.name, 'ca'));

  const payerName = (e: GroupExpense) => (e.paidBy === null ? 'Has pagat tu' : `Ha pagat ${(names.get(e.paidBy) ?? '—').split(' ')[0]}`);
  const share = () => shareText(groupShareMessage(group.name, expenses, fromGroup, (cid) => names.get(cid)));

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

      <WalletSwitcher />

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

      <View style={styles.actions}>
        <Button
          label="Nova despesa"
          icon="add"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/despesa', params: { grup: group.id } })}
        />
        <Button label="Comparteix" icon="share" variant="secondary" style={{ flex: 1 }} onPress={share} />
      </View>

      <SectionHeader title="Persones" />
      <View style={styles.people}>
        {members.map((m) => (
          <MemberRow key={m.id} member={m} groupId={group.id} />
        ))}
      </View>
      <AppText variant="small" color={colors.textFaint}>
        L’import és el que queda pendent d’aquest grup. «Liquida» registra el pagament i també baixa el saldo total de la persona.
      </AppText>

      <SectionHeader title="Despeses" />
      {expenses.length === 0 ? (
        <EmptyState title="Sense despeses" message="Apunta el primer dinar o compra compartida i es repartirà entre els que hi éreu." />
      ) : (
        <View>
          {expenses.map((e) => (
            <ExpenseRow key={e.id} expense={e} payerName={payerName(e)} net={myNetEffect(e, exists)} />
          ))}
        </View>
      )}

      {payments.length > 0 ? (
        <>
          <SectionHeader title="Pagaments del grup" />
          <View>
            {sortNewestFirst(payments).map((m) => (
              <MovementRow
                key={m.id}
                movement={m}
                subtitle={`${formatShortDate(m.date)} · ${names.get(m.contactId) ?? '—'}`}
                onPress={() => router.push({ pathname: '/moviment/[id]', params: { id: m.id } })}
              />
            ))}
          </View>
        </>
      ) : null}
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
  actions: { flexDirection: 'row', gap: space.sm },
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
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingRight: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  memberMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingLeft: 14 },
  memberRight: { alignItems: 'flex-end', gap: 4 },
  settle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
});
