import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { EmptyState, Screen } from '@/components/Screen';
import { WalletSwitcher } from '@/components/WalletSwitcher';
import { groupBalances, groupNet } from '@/domain/groups';
import { formatMoney } from '@/domain/money';
import type { Group } from '@/domain/types';
import { useContacts, useExpenses, useGroups, useMovements } from '@/store/store';
import { balanceColor, colors, radius, space, touchTarget } from '@/theme/tokens';

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function GroupRow({ group, expenseCount, net }: { group: Group; expenseCount: number; net: number }) {
  const people = group.memberIds.length + 1; // + me
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/grup/[id]', params: { id: group.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${group.name}, ${plural(people, 'persona', 'persones')}`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}>
      <View style={styles.icon}>
        <Icon name="group" size={20} color={colors.accent} />
      </View>
      <View style={styles.middle}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {group.name}
        </AppText>
        <AppText variant="small" color={colors.textMuted} numberOfLines={1}>
          {plural(people, 'persona', 'persones')} · {plural(expenseCount, 'despesa', 'despeses')}
        </AppText>
      </View>
      <View style={styles.right}>
        <AppText variant="amount" color={balanceColor(net)}>
          {formatMoney(net, { sign: 'always', currency: false })}
        </AppText>
        <AppText variant="small" color={colors.textMuted}>
          {net > 0 ? 'et deuen' : net < 0 ? 'deus' : 'quadrat'}
        </AppText>
      </View>
    </Pressable>
  );
}

export default function GroupsScreen() {
  const groups = useGroups();
  const expenses = useExpenses();
  const contacts = useContacts();
  const movements = useMovements();

  const rows = useMemo(() => {
    const ids = new Set(contacts.map((c) => c.id));
    const exists = (id: string) => ids.has(id);
    return [...groups]
      .map((g) => {
        const own = expenses.filter((e) => e.groupId === g.id);
        const payments = movements.filter((m) => m.kind === 'payment' && m.groupId === g.id);
        const last = own.reduce((max, e) => (e.date > max ? e.date : max), g.createdAt.slice(0, 10));
        return { group: g, expenseCount: own.length, net: groupNet(groupBalances(own, payments, exists)), last };
      })
      .sort((a, b) => b.last.localeCompare(a.last) || a.group.name.localeCompare(b.group.name, 'ca'));
  }, [groups, expenses, contacts, movements]);

  const create = () => router.push('/editar-grup');

  return (
    <Screen
      title="Grups"
      titleAccessory={
        <Pressable onPress={create} accessibilityRole="button" accessibilityLabel="Nou grup" style={styles.addButton}>
          <Icon name="add" size={20} color={colors.onAccent} />
        </Pressable>
      }>
      <WalletSwitcher />

      {rows.length === 0 ? (
        <EmptyState
          title="Encara no tens cap grup"
          message="Crea un grup per als dinars amb la colla o un viatge. Apunta qui paga cada despesa i Ovia la reparteix a parts iguals."
          action={<Button label="Crea un grup" icon="add" onPress={create} style={{ marginTop: space.sm }} />}
        />
      ) : (
        <View style={styles.list}>
          {rows.map((r) => (
            <GroupRow key={r.group.id} group={r.group} expenseCount={r.expenseCount} net={r.net} />
          ))}
          <AppText variant="small" color={colors.textFaint}>
            L’import és el que queda pendent de cada grup, comptant les liquidacions.
          </AppText>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end', gap: 1 },
});
