import { Link, router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BalanceBar } from '@/components/BalanceBar';
import { Button } from '@/components/Button';
import { PersonRow } from '@/components/PersonRow';
import { EmptyState, Screen, SectionHeader } from '@/components/Screen';
import { sortNewestFirst } from '@/domain/balances';
import { formatMoney } from '@/domain/money';
import { DesktopHome } from '@/features/desktop/DesktopHome';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useContactsWithBalance, useMovements, useTotals } from '@/store/store';
import { colors, space } from '@/theme/tokens';

export default function HomeScreen() {
  const desktop = useIsDesktop();
  return desktop ? <DesktopHome /> : <MobileHome />;
}

function MobileHome() {
  const totals = useTotals();
  const people = useContactsWithBalance();
  const movements = useMovements();

  const pending = useMemo(() => people.filter((p) => p.balance !== 0), [people]);
  const lastConcept = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of sortNewestFirst(movements)) if (!map.has(m.contactId)) map.set(m.contactId, m.concept);
    return map;
  }, [movements]);

  const [netInt, netDec] = formatMoney(totals.net, { sign: 'always', currency: false }).split(',');

  return (
    <Screen
      title="debtmate"
      titleAccessory={
        <AppText variant="caption" color={colors.textMuted}>
          {pending.length === 1 ? '1 persona' : `${pending.length} persones`}
        </AppText>
      }>
      <View style={styles.balance} accessible accessibilityLabel={`Balanç net ${formatMoney(totals.net, { sign: 'always' })}`}>
        <AppText variant="caption" color={colors.textMuted}>
          Balanç net
        </AppText>
        <AppText variant="hero">
          {netInt}
          <AppText variant="hero" color={colors.textMuted}>
            ,{netDec} €
          </AppText>
        </AppText>
      </View>

      <View style={styles.split}>
        <BalanceBar owedToMe={totals.owedToMe} iOwe={totals.iOwe} />
        <View style={styles.splitLabels}>
          <AppText variant="captionStrong" color={colors.owedToMe}>
            Em deuen {formatMoney(totals.owedToMe)}
          </AppText>
          <AppText variant="captionStrong" color={colors.iOwe}>
            Dec {formatMoney(totals.iOwe)}
          </AppText>
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label="Em deuen"
          icon="owedToMe"
          style={styles.action}
          onPress={() => router.push({ pathname: '/nou', params: { direction: 'owed' } })}
        />
        <Button
          label="Dec"
          icon="iOwe"
          variant="secondary"
          style={styles.action}
          onPress={() => router.push({ pathname: '/nou', params: { direction: 'owe' } })}
        />
      </View>

      <SectionHeader
        title="Pendents"
        accessory={
          <Link href="/persones">
            <AppText variant="captionStrong" color={colors.accent}>
              Veure tots
            </AppText>
          </Link>
        }
      />

      {pending.length === 0 ? (
        <EmptyState
          title="Tot al dia"
          message="No tens cap deute pendent. Apunta'n un amb els botons de dalt."
        />
      ) : (
        <View style={styles.list}>
          {pending.map((p) => (
            <PersonRow key={p.id} id={p.id} name={p.name} balance={p.balance} subtitle={lastConcept.get(p.id)} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  balance: { gap: 6, marginTop: space.sm },
  split: { gap: 10 },
  splitLabels: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.sm },
  actions: { flexDirection: 'row', gap: 10, marginTop: space.xs },
  action: { flex: 1 },
  list: { gap: space.sm },
});
