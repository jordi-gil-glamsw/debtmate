import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { DateField } from '@/components/DateField';
import { DueDateField } from '@/components/DueDateField';
import { FieldGroup, FieldRow, TextField } from '@/components/Field';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SheetHeader } from '@/components/SheetHeader';
import { todayISO } from '@/domain/dates';
import { centsToInput, parseAmount } from '@/domain/money';
import { PAYMENT_METHOD_LABELS, type Contact, type Movement, type PaymentMethod } from '@/domain/types';
import { ReceiptField } from '@/features/receipts/ReceiptField';
import { confirm } from '@/lib/dialogs';
import { deleteMovement, updateMovement, useContact, useMovements } from '@/store/store';
import { colors, fonts, space, sheetMaxWidth } from '@/theme/tokens';

const METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];

/** Edit sheet for an existing debt or payment. */
export default function EditMovementSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const movement = useMovements().find((m) => m.id === id);
  const contact = useContact(movement?.contactId);
  const insets = useSafeAreaInsets();

  if (!movement || !contact) {
    return (
      <View style={[styles.root, styles.content, { paddingBottom: insets.bottom }]}>
        <SheetHeader title="Moviment" onCancel={() => router.back()} />
        <AppText variant="body" color={colors.textMuted}>
          Aquest moviment ja no existeix.
        </AppText>
      </View>
    );
  }
  // Keyed by id so the form state starts from this movement.
  return <EditForm key={movement.id} movement={movement} contact={contact} />;
}

function EditForm({ movement, contact }: { movement: Movement; contact: Contact }) {
  const insets = useSafeAreaInsets();
  const isDebt = movement.kind === 'debt';
  const today = todayISO();

  const [amountText, setAmountText] = useState(centsToInput(movement.amountCents));
  const [concept, setConcept] = useState(movement.concept);
  const [note, setNote] = useState(movement.note ?? '');
  const [receipt, setReceipt] = useState<string | undefined>(movement.receipt);
  const [date, setDate] = useState(movement.date);
  const [direction, setDirection] = useState<'owed' | 'owe'>(movement.kind === 'debt' ? movement.direction : 'owed');
  const [dueDate, setDueDate] = useState<string | undefined>(movement.kind === 'debt' ? movement.dueDate : undefined);
  const [method, setMethod] = useState<PaymentMethod>(movement.kind === 'payment' ? movement.method : 'bizum');

  const amount = parseAmount(amountText);
  const canSave = amount !== null && amount > 0 && concept.trim().length > 0;
  const firstName = contact.name.split(' ')[0];

  const save = () => {
    if (!canSave || amount === null) return;
    const base = {
      id: movement.id,
      contactId: movement.contactId,
      createdAt: movement.createdAt,
      amountCents: amount,
      concept: concept.trim(),
      date,
      ...(receipt ? { receipt } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    updateMovement(
      movement.kind === 'debt'
        ? { ...base, kind: 'debt', direction, ...(dueDate ? { dueDate } : {}) }
        : { ...base, kind: 'payment', direction: movement.direction, method },
    );
    router.back();
  };

  const remove = async () => {
    const what = isDebt ? 'Aquest deute' : 'Aquest pagament';
    if (await confirm('Esborrar el moviment', `${what} desapareixerà i el saldo es recalcularà.`, 'Esborra', true)) {
      deleteMovement(movement.id);
      router.back();
    }
  };

  const amountColor = !isDebt ? colors.accent : direction === 'owed' ? colors.owedToMe : colors.iOwe;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      <SheetHeader
        title={isDebt ? 'Edita el deute' : 'Edita el pagament'}
        onCancel={() => router.back()}
        onConfirm={save}
        confirmDisabled={!canSave}
      />

      {isDebt ? (
        <SegmentedControl
          accessibilityLabel="Qui deu a qui"
          value={direction}
          onChange={setDirection}
          options={[
            { value: 'owed', label: `${firstName} em deu` },
            { value: 'owe', label: `Dec a ${firstName}` },
          ]}
        />
      ) : (
        <AppText variant="caption" color={colors.textMuted} style={styles.center}>
          {movement.direction === 'in' ? `Pagament de ${contact.name}` : `Pagament a ${contact.name}`}
        </AppText>
      )}

      <View style={styles.amountRow}>
        <TextInput
          value={amountText}
          onChangeText={setAmountText}
          placeholder="0,00"
          placeholderTextColor={colors.textFaint}
          keyboardType="decimal-pad"
          accessibilityLabel="Import en euros"
          selectTextOnFocus
          style={[styles.amountInput, { color: amountColor }]}
        />
        <AppText variant="amountLarge" color={amountColor}>
          €
        </AppText>
      </View>
      {amountText.length > 0 && amount === null ? (
        <AppText variant="small" color={colors.danger} style={styles.center}>
          Escriu un import vàlid, per exemple 32,40
        </AppText>
      ) : null}

      <FieldGroup>
        <TextField label="Concepte" value={concept} onChangeText={setConcept} placeholder="Sopar, entrades…" />
        <TextField label="Nota" value={note} onChangeText={setNote} placeholder="Opcional" multiline />
        <FieldRow label="Data" last={!isDebt}>
          <DateField value={date} onChange={setDate} maximum={today} accessibilityLabel="Data del moviment" />
        </FieldRow>
        {isDebt ? (
          <FieldRow label="Límit" last>
            <DueDateField value={dueDate} onChange={setDueDate} minimum={date} />
          </FieldRow>
        ) : null}
      </FieldGroup>

      {!isDebt ? (
        <View style={{ gap: space.sm }}>
          <AppText variant="captionStrong" color={colors.textMuted}>
            Mètode
          </AppText>
          <View style={styles.methods}>
            {METHODS.map((m) => (
              <Chip key={m} label={PAYMENT_METHOD_LABELS[m]} selected={method === m} onPress={() => setMethod(m)} />
            ))}
          </View>
        </View>
      ) : null}

      <ReceiptField value={receipt} onChange={setReceipt} />

      <View style={{ gap: space.sm }}>
        <Button label="Desa els canvis" onPress={save} disabled={!canSave} />
        <Button label="Esborra el moviment" variant="danger" icon="trash" onPress={remove} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  // Centered column on wide (web) windows; full width on phones.
  content: { paddingHorizontal: space.xl, gap: space.xl, paddingTop: space.sm, width: '100%', maxWidth: sheetMaxWidth, alignSelf: 'center' },
  center: { textAlign: 'center' },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: space.sm },
  amountInput: {
    fontFamily: fonts.display,
    fontSize: 52,
    minWidth: 120,
    maxWidth: 280, // web inputs have a wide intrinsic width; enough for 12.345,67
    textAlign: 'center',
    paddingVertical: 0,
    fontVariant: ['tabular-nums'],
  },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
