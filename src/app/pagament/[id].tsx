import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { DateField } from '@/components/DateField';
import { FieldGroup, FieldRow } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { SheetHeader } from '@/components/SheetHeader';
import { balanceOf } from '@/domain/balances';
import { todayISO } from '@/domain/dates';
import { centsToInput, formatMoney, parseAmount } from '@/domain/money';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/domain/types';
import { addMovement, useContact, useMovements } from '@/store/store';
import { colors, fonts, radius, space } from '@/theme/tokens';

type Preset = 'all' | 'half' | 'other';
const METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];

export default function PaymentSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const contact = useContact(id);
  const movements = useMovements();
  const balance = useMemo(() => balanceOf(movements, id), [movements, id]);
  const outstanding = Math.abs(balance);
  const half = Math.floor(outstanding / 2);

  const [preset, setPreset] = useState<Preset>('all');
  const [otherText, setOtherText] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('bizum');
  const today = todayISO();
  const [date, setDate] = useState(today);

  const amount = preset === 'all' ? outstanding : preset === 'half' ? half : parseAmount(otherText);
  const valid = amount !== null && amount > 0 && amount <= outstanding;
  const remaining = valid ? outstanding - amount : outstanding;

  if (!contact || balance === 0) {
    return (
      <View style={[styles.root, styles.content]}>
        <SheetHeader title="Pagament" onCancel={() => router.back()} />
        <AppText variant="body" color={colors.textMuted}>
          No hi ha cap deute pendent amb aquesta persona.
        </AppText>
      </View>
    );
  }

  const firstName = contact.name.split(' ')[0];
  const theyPay = balance > 0; // they owe me → they pay me
  const title = theyPay ? `${firstName} et paga` : `Pagues a ${firstName}`;

  const confirm = () => {
    if (!valid || amount === null) return;
    addMovement({
      kind: 'payment',
      direction: theyPay ? 'in' : 'out',
      contactId: contact.id,
      amountCents: amount,
      method,
      concept: theyPay ? `Pagament rebut (${PAYMENT_METHOD_LABELS[method]})` : `Pagament fet (${PAYMENT_METHOD_LABELS[method]})`,
      date,
    });
    router.back();
  };

  const result = !valid
    ? preset === 'other' && amount !== null && amount > outstanding
      ? `L’import supera el deute (${formatMoney(outstanding)})`
      : 'Escriu l’import del pagament'
    : remaining === 0
      ? `Quedareu al dia amb ${firstName}`
      : theyPay
        ? `Encara et deurà ${formatMoney(remaining)}`
        : `Encara li deuràs ${formatMoney(remaining)}`;

  const presets: { value: Preset; title: string; label: string }[] = [
    { value: 'all', title: formatMoney(outstanding, { compact: true }), label: 'Tot' },
    { value: 'half', title: formatMoney(half, { compact: true }), label: 'La meitat' },
    { value: 'other', title: '…', label: 'Una altra' },
  ];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      <SheetHeader title="Registrar pagament" onCancel={() => router.back()} />

      <View style={{ gap: space.xs }}>
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
        <AppText variant="caption" color={colors.textMuted}>
          Deute pendent: {formatMoney(outstanding)}
        </AppText>
      </View>

      <View style={styles.presets}>
        {presets.map((p) => {
          const selected = preset === p.value;
          return (
            <Pressable
              key={p.value}
              onPress={() => {
                setPreset(p.value);
                if (p.value === 'other' && !otherText) setOtherText(centsToInput(half));
              }}
              accessibilityRole="button"
              accessibilityLabel={`${p.label} ${p.value === 'other' ? '' : p.title}`}
              accessibilityState={{ selected }}
              style={[styles.preset, selected && styles.presetSelected]}>
              <AppText variant="amount">{p.title}</AppText>
              <AppText variant="small" color={colors.textMuted}>
                {p.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {preset === 'other' ? (
        <View style={styles.otherRow}>
          <TextInput
            value={otherText}
            onChangeText={setOtherText}
            keyboardType="decimal-pad"
            accessibilityLabel="Import del pagament"
            autoFocus
            selectTextOnFocus
            style={styles.otherInput}
          />
          <AppText variant="title">€</AppText>
        </View>
      ) : null}

      <View style={{ gap: space.sm }}>
        <AppText variant="captionStrong" color={colors.textMuted}>
          {theyPay ? 'Com t’ha pagat?' : 'Com li pagues?'}
        </AppText>
        <View style={styles.methods}>
          {METHODS.map((m) => (
            <Chip key={m} label={PAYMENT_METHOD_LABELS[m]} selected={method === m} onPress={() => setMethod(m)} />
          ))}
        </View>
      </View>

      <FieldGroup>
        <FieldRow label="Data" last>
          <DateField value={date} onChange={setDate} maximum={today} accessibilityLabel="Data del pagament" />
        </FieldRow>
      </FieldGroup>

      <View style={styles.result} accessibilityLiveRegion="polite">
        <Icon name={valid ? 'check' : 'payment'} size={18} color={valid ? colors.accent : colors.textMuted} />
        <AppText variant="body" style={{ flex: 1 }}>
          {result}
        </AppText>
      </View>

      <Button
        label={valid && amount !== null ? `Confirma ${formatMoney(amount)}` : 'Confirma el pagament'}
        onPress={confirm}
        disabled={!valid}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.xl, gap: space.xl, paddingTop: space.sm },
  presets: { flexDirection: 'row', gap: space.sm },
  preset: {
    flex: 1,
    minHeight: 68,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  presetSelected: { borderColor: colors.accent, borderWidth: 2 },
  otherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
  otherInput: { flex: 1, color: colors.text, fontFamily: fonts.display, fontSize: 28, paddingVertical: 12 },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
});
