import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { DateField } from '@/components/DateField';
import { DueDateField } from '@/components/DueDateField';
import { FieldGroup, FieldRow, TextField } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SheetHeader } from '@/components/SheetHeader';
import { todayISO } from '@/domain/dates';
import { parseAmount } from '@/domain/money';
import { requestReminderPermission } from '@/features/reminders/notifications';
import { refreshReminders } from '@/features/reminders/ReminderManager';
import { addContact, addMovement, readState, useContactsWithBalance } from '@/store/store';
import { colors, fonts, radius, space, sheetMaxWidth } from '@/theme/tokens';

type Direction = 'owed' | 'owe';

export default function NewMovementSheet() {
  const params = useLocalSearchParams<{ direction?: Direction; contactId?: string }>();
  const insets = useSafeAreaInsets();
  const people = useContactsWithBalance();

  const [direction, setDirection] = useState<Direction>(params.direction === 'owe' ? 'owe' : 'owed');
  const [amountText, setAmountText] = useState('');
  const [contactId, setContactId] = useState<string | undefined>(params.contactId);
  const [creatingNew, setCreatingNew] = useState(!params.contactId && people.length === 0);
  const [newName, setNewName] = useState('');
  const [concept, setConcept] = useState('');
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [dueDate, setDueDate] = useState<string | undefined>(undefined);

  const amount = parseAmount(amountText);
  const hasPerson = creatingNew ? newName.trim().length > 0 : Boolean(contactId);
  const canSave = amount !== null && amount > 0 && hasPerson;

  const save = () => {
    if (!canSave || amount === null) return;
    const id = creatingNew ? addContact(newName).id : contactId!;
    addMovement({
      kind: 'debt',
      direction,
      contactId: id,
      amountCents: amount,
      concept: concept.trim() || (direction === 'owed' ? 'Préstec' : 'Deute'),
      date,
      dueDate,
    });
    router.back();
    // Ask for notifications at the moment they make sense: the first debt with a due date.
    if (dueDate && readState().settings.reminders) {
      requestReminderPermission()
        .then(() => refreshReminders())
        .catch(() => {});
    }
  };

  const amountColor = direction === 'owed' ? colors.owedToMe : colors.iOwe;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      <SheetHeader title="Nou moviment" onCancel={() => router.back()} onConfirm={save} confirmDisabled={!canSave} />

      <SegmentedControl
        accessibilityLabel="Tipus de moviment"
        value={direction}
        onChange={setDirection}
        options={[
          { value: 'owed', label: 'Em deuen' },
          { value: 'owe', label: 'Dec' },
        ]}
      />

      <View style={styles.amountBox}>
        <AppText variant="caption" color={colors.textMuted}>
          {direction === 'owed' ? 'Quant et deuen?' : 'Quant deus?'}
        </AppText>
        <View style={styles.amountRow}>
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            placeholder="0,00"
            placeholderTextColor={colors.textFaint}
            keyboardType="decimal-pad"
            accessibilityLabel="Import en euros"
            autoFocus
            style={[styles.amountInput, { color: amountColor }]}
          />
          <AppText variant="amountLarge" color={amountColor}>
            €
          </AppText>
        </View>
        {amountText.length > 0 && amount === null ? (
          <AppText variant="small" color={colors.danger}>
            Escriu un import vàlid, per exemple 32,40
          </AppText>
        ) : null}
      </View>

      <View style={{ gap: space.sm }}>
        <AppText variant="captionStrong" color={colors.textMuted}>
          Persona
        </AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.people} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={() => {
              setCreatingNew(true);
              setContactId(undefined);
            }}
            accessibilityRole="button"
            accessibilityLabel="Nova persona"
            accessibilityState={{ selected: creatingNew }}
            style={[styles.personTile, styles.newTile, creatingNew && styles.personSelected]}>
            <Icon name="personAdd" size={20} color={creatingNew ? colors.accent : colors.textMuted} />
            <AppText variant="small" color={colors.textMuted}>
              Nova
            </AppText>
          </Pressable>
          {people.map((p) => {
            const selected = !creatingNew && contactId === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => {
                  setCreatingNew(false);
                  setContactId(p.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={p.name}
                accessibilityState={{ selected }}
                style={[styles.personTile, selected && styles.personSelected]}>
                <Avatar name={p.name} size={32} />
                <AppText variant="small" numberOfLines={1} style={{ maxWidth: 64 }}>
                  {p.name.split(' ')[0]}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FieldGroup>
        {creatingNew ? (
          <TextField label="Nom" value={newName} onChangeText={setNewName} placeholder="Nom de la persona" autoCapitalize="words" />
        ) : null}
        <TextField label="Concepte" value={concept} onChangeText={setConcept} placeholder="Sopar, entrades…" />
        <FieldRow label="Data">
          <DateField value={date} onChange={setDate} maximum={today} accessibilityLabel="Data del deute" />
        </FieldRow>
        <FieldRow label="Límit" last>
          <DueDateField value={dueDate} onChange={setDueDate} minimum={date} />
        </FieldRow>
      </FieldGroup>

      <Button label="Desa el moviment" onPress={save} disabled={!canSave} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  // Centered column on wide (web) windows; full width on phones.
  content: { paddingHorizontal: space.xl, gap: space.xl, paddingTop: space.sm, width: '100%', maxWidth: sheetMaxWidth, alignSelf: 'center' },
  amountBox: { alignItems: 'center', gap: space.xs },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  amountInput: {
    fontFamily: fonts.display,
    fontSize: 52,
    minWidth: 120,
    maxWidth: 280, // web inputs have a wide intrinsic width; enough for 12.345,67
    textAlign: 'center',
    paddingVertical: 0,
    fontVariant: ['tabular-nums'],
  },
  people: { gap: space.sm },
  personTile: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  newTile: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  personSelected: { borderColor: colors.accent, borderWidth: 2 },
});
