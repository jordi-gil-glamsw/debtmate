import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { ProgressBar } from '@/components/BalanceBar';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { MovementRow } from '@/components/MovementRow';
import { EmptyState, Screen, SectionHeader } from '@/components/Screen';
import { balanceOf, settlementProgress, sortNewestFirst } from '@/domain/balances';
import { formatShortDate, todayISO } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { upcomingDueDates } from '@/domain/reminders';
import type { Movement } from '@/domain/types';
import { confirm, shareText } from '@/lib/dialogs';
import { deleteContact, deleteMovement, useContact, useMovements } from '@/store/store';
import { balanceColor, colors, radius, space } from '@/theme/tokens';

function buildShareMessage(name: string, balance: number, movements: Movement[]): string {
  const firstName = name.split(' ')[0];
  const amount = formatMoney(balance, { sign: 'never' });
  const head =
    balance > 0
      ? `Hola ${firstName}! Segons el meu registre em deus ${amount}:`
      : `Hola ${firstName}! Segons el meu registre et dec ${amount}:`;
  const lines = sortNewestFirst(movements)
    .slice(0, 10)
    .map((m) => {
      const verb = m.kind === 'payment' ? ' (pagament)' : '';
      return `• ${formatShortDate(m.date)} · ${m.concept}${verb}: ${formatMoney(m.amountCents)}`;
    });
  return [head, ...lines].join('\n');
}

export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const contact = useContact(id);
  const allMovements = useMovements();

  const movements = useMemo(() => allMovements.filter((m) => m.contactId === id), [allMovements, id]);
  const balance = useMemo(() => balanceOf(allMovements, id), [allMovements, id]);
  const progress = useMemo(() => settlementProgress(allMovements, id), [allMovements, id]);
  const nextDue = useMemo(
    () => (id ? upcomingDueDates(movements, id, balance, todayISO())[0] : undefined),
    [movements, id, balance],
  );

  if (!contact) {
    return (
      <Screen topInset={false}>
        <Stack.Screen options={{ title: '' }} />
        <EmptyState title="Persona no trobada" message="Potser s'ha esborrat." />
      </Screen>
    );
  }

  const label = balance > 0 ? 'Et deu' : balance < 0 ? 'Li deus' : 'Esteu al dia';

  const onDeleteMovement = async (m: Movement) => {
    if (await confirm('Esborrar moviment', `«${m.concept}» · ${formatMoney(m.amountCents)}`, 'Esborra', true)) {
      deleteMovement(m.id);
    }
  };

  const onDeleteContact = async () => {
    if (await confirm(`Esborrar ${contact.name}`, 'S’esborraran també tots els seus moviments.', 'Esborra', true)) {
      router.back();
      deleteContact(contact.id);
    }
  };

  return (
    <Screen topInset={false}>
      <Stack.Screen
        options={{
          title: contact.name,
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: '/contacte/[id]', params: { id: contact.id } })}
              accessibilityRole="button"
              accessibilityLabel={`Edita ${contact.name}`}
              hitSlop={8}
              // Native headers add their own margin; the web header does not.
              style={Platform.OS === 'web' ? { paddingHorizontal: space.lg } : undefined}>
              <AppText variant="bodyStrong" color={colors.accent}>
                Edita
              </AppText>
            </Pressable>
          ),
        }}
      />

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Avatar name={contact.name} size={48} />
          <AppText variant="captionStrong" color={balanceColor(balance)}>
            {label}
          </AppText>
        </View>
        <AppText variant="amountLarge" style={{ fontSize: 46, lineHeight: 52 }}>
          {formatMoney(balance, { sign: 'never' })}
        </AppText>
        {progress ? (
          <View style={{ gap: space.sm }}>
            <ProgressBar ratio={progress.ratio} />
            <View style={styles.progressLabels}>
              <AppText variant="small" color={colors.textMuted}>
                Retornat {formatMoney(progress.returned)}
              </AppText>
              <AppText variant="small" color={colors.textMuted}>
                Total {formatMoney(progress.total)}
              </AppText>
            </View>
          </View>
        ) : null}
        {nextDue ? (
          <View style={styles.due}>
            <Icon name="calendar" size={16} color={colors.textMuted} />
            <AppText variant="small" color={colors.textMuted}>
              Data límit acordada: {formatShortDate(nextDue)}
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Button
          label={balance > 0 ? 'Cobrar' : 'Pagar'}
          icon="check"
          stacked
          disabled={balance === 0}
          style={styles.action}
          onPress={() => router.push({ pathname: '/pagament/[id]', params: { id: contact.id } })}
        />
        <Button
          label="Afegir"
          icon="add"
          stacked
          variant="secondary"
          style={styles.action}
          onPress={() => router.push({ pathname: '/nou', params: { contactId: contact.id } })}
        />
        <Button
          label="Compartir"
          icon="share"
          stacked
          variant="secondary"
          disabled={balance === 0}
          style={styles.action}
          onPress={() => shareText(buildShareMessage(contact.name, balance, movements))}
        />
      </View>

      <SectionHeader title="Moviments" />
      {movements.length === 0 ? (
        <EmptyState title="Sense moviments" message="Afegeix el primer deute amb aquesta persona." />
      ) : (
        <View>
          {sortNewestFirst(movements).map((m) => (
            <MovementRow
              key={m.id}
              movement={m}
              onPress={() => router.push({ pathname: '/moviment/[id]', params: { id: m.id } })}
              onLongPress={() => onDeleteMovement(m)}
            />
          ))}
          <AppText variant="small" color={colors.textFaint} style={{ marginTop: space.sm }}>
            Toca un moviment per editar-lo. Mantén-lo premut per esborrar-lo.
          </AppText>
        </View>
      )}

      <Button label={`Esborra ${contact.name}`} variant="danger" icon="trash" onPress={onDeleteContact} style={{ marginTop: space.xl }} />
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
    gap: 14,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  due: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1, paddingHorizontal: space.xs },
});
