import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { DateField } from '@/components/DateField';
import { FieldGroup, FieldRow, TextField } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { SheetHeader } from '@/components/SheetHeader';
import { todayISO } from '@/domain/dates';
import { expenseMovements, expenseProblem, expenseShares, ME } from '@/domain/groups';
import { centsToInput, formatMoney, parseAmount } from '@/domain/money';
import { confirm } from '@/lib/dialogs';
import { addExpense, deleteExpense, updateExpense, useContacts, useExpense, useGroup } from '@/store/store';
import { colors, fonts, radius, sheetMaxWidth, space, touchTarget } from '@/theme/tokens';

const PROBLEMS = {
  amount: null, // the amount field shows its own hint
  nobody: 'Marca qui hi era.',
  notMine: 'DebtMate només guarda els teus deutes: aquesta despesa no et toca. Si hi eres, marca’t a «Qui hi era?».',
} as const;

/** New group expense (?grup=) or edit one (?id=). Split in equal parts. */
export default function ExpenseSheet() {
  const params = useLocalSearchParams<{ grup?: string; id?: string }>();
  const existing = useExpense(params.id);
  const group = useGroup(existing?.groupId ?? params.grup);
  const contacts = useContacts();
  const insets = useSafeAreaInsets();
  const today = todayISO();

  const names = useMemo(() => new Map(contacts.map((c) => [c.id, c.name])), [contacts]);
  /** Everyone who can take part: the group's members plus anyone already in this expense. */
  const pool = useMemo(() => {
    const ids = [...(group?.memberIds ?? []), ...(existing?.participantIds ?? []), ...(existing?.paidBy ? [existing.paidBy] : [])];
    return [...new Set(ids)].filter((cid) => names.has(cid));
  }, [group, existing, names]);

  const [amountText, setAmountText] = useState(existing ? centsToInput(existing.amountCents) : '');
  const [concept, setConcept] = useState(existing?.concept ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [date, setDate] = useState(existing?.date ?? today);
  const [paidBy, setPaidBy] = useState<string | null>(existing?.paidBy ?? null);
  const [selected, setSelected] = useState<string[]>(() =>
    existing ? [...(existing.includesMe ? [ME] : []), ...existing.participantIds] : [ME, ...(group?.memberIds ?? [])],
  );

  if (!group || (params.id && !existing)) {
    return (
      <View style={[styles.root, styles.content]}>
        <SheetHeader title="Despesa" onCancel={() => router.back()} />
        <AppText variant="body" color={colors.textMuted}>
          Aquesta despesa ja no existeix.
        </AppText>
      </View>
    );
  }

  const amount = parseAmount(amountText) ?? 0;
  const draft = {
    amountCents: amount,
    paidBy,
    includesMe: selected.includes(ME),
    participantIds: selected.filter((s) => s !== ME && names.has(s)),
  };
  const problem = expenseProblem(draft);
  const canSave = problem === null;
  const shares = expenseShares(draft);
  const debts = expenseMovements({ ...draft, id: '', groupId: group.id, concept: '', date, createdAt: '' }, (cid) => names.has(cid));
  const owedToMe = debts.filter((d) => d.direction === 'owed').reduce((s, d) => s + d.amountCents, 0);
  const iOwe = debts.filter((d) => d.direction === 'owe').reduce((s, d) => s + d.amountCents, 0);

  const toggle = (who: string) => setSelected((s) => (s.includes(who) ? s.filter((x) => x !== who) : [...s, who]));
  const label = (who: string | null) => (who === null || who === ME ? 'Tu' : (names.get(who) ?? '—'));

  const save = () => {
    if (!canSave) return;
    const fields = {
      groupId: group.id,
      concept: concept.trim() || 'Despesa',
      amountCents: amount,
      date,
      paidBy,
      participantIds: draft.participantIds,
      includesMe: draft.includesMe,
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    if (existing) {
      const { note: _old, ...rest } = existing;
      updateExpense({ ...rest, ...fields });
    } else addExpense(fields);
    router.back();
  };

  const onDelete = async () => {
    if (!existing) return;
    if (await confirm('Esborrar la despesa', `«${existing.concept}» · ${formatMoney(existing.amountCents)}. Els deutes que generava desapareixeran.`, 'Esborra', true)) {
      router.back();
      deleteExpense(existing.id);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      <SheetHeader title={existing ? 'Edita la despesa' : 'Nova despesa'} onCancel={() => router.back()} onConfirm={save} confirmDisabled={!canSave} />

      <View style={styles.amountBox}>
        <AppText variant="caption" color={colors.textMuted}>
          {group.name} · Quant ha costat?
        </AppText>
        <View style={styles.amountRow}>
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            placeholder="0,00"
            placeholderTextColor={colors.textFaint}
            keyboardType="decimal-pad"
            accessibilityLabel="Import total en euros"
            autoFocus={!existing}
            style={styles.amountInput}
          />
          <AppText variant="amountLarge">€</AppText>
        </View>
        {amountText.length > 0 && parseAmount(amountText) === null ? (
          <AppText variant="small" color={colors.danger}>
            Escriu un import vàlid, per exemple 96,50
          </AppText>
        ) : null}
      </View>

      <FieldGroup>
        <TextField label="Concepte" value={concept} onChangeText={setConcept} placeholder="Dinar, sopar, compra…" />
        <TextField label="Nota" value={note} onChangeText={setNote} placeholder="Opcional" multiline />
        <FieldRow label="Data" last>
          <DateField value={date} onChange={setDate} maximum={today} accessibilityLabel="Data de la despesa" />
        </FieldRow>
      </FieldGroup>

      <View style={{ gap: space.sm }}>
        <AppText variant="captionStrong" color={colors.textMuted}>
          Qui ha pagat?
        </AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.payers} keyboardShouldPersistTaps="handled">
          {[null, ...pool].map((who) => {
            const isSelected = paidBy === who;
            return (
              <Pressable
                key={who ?? ME}
                onPress={() => setPaidBy(who)}
                accessibilityRole="radio"
                accessibilityLabel={who === null ? 'Tu' : label(who)}
                accessibilityState={{ selected: isSelected }}
                style={[styles.payer, isSelected && styles.payerSelected]}>
                <Avatar name={who === null ? 'Tu' : label(who)} size={32} />
                <AppText variant="small" numberOfLines={1} style={{ maxWidth: 64 }}>
                  {who === null ? 'Tu' : label(who).split(' ')[0]}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={{ gap: space.sm }}>
        <AppText variant="captionStrong" color={colors.textMuted}>
          Qui hi era? · a parts iguals
        </AppText>
        <View style={styles.list}>
          {[ME, ...pool].map((who, i, all) => {
            const on = selected.includes(who);
            const share = on ? (shares.get(who) ?? 0) : 0;
            return (
              <Pressable
                key={who}
                onPress={() => toggle(who)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${label(who)}${on && amount > 0 ? `, ${formatMoney(share)}` : ''}`}
                style={[styles.member, i < all.length - 1 && styles.divider]}>
                <View style={[styles.check, on && styles.checkOn]}>{on ? <Icon name="check" size={14} color={colors.onAccent} /> : null}</View>
                <AppText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }} color={on ? colors.text : colors.textMuted}>
                  {label(who)}
                </AppText>
                <AppText variant="body" color={on ? colors.text : colors.textFaint}>
                  {on && amount > 0 ? formatMoney(share) : '—'}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {problem && PROBLEMS[problem] ? (
        <AppText variant="caption" color={colors.danger} accessibilityRole="alert">
          {PROBLEMS[problem]}
        </AppText>
      ) : canSave ? (
        <View style={styles.summary}>
          {owedToMe > 0 ? (
            <AppText variant="bodyStrong" color={colors.owedToMe}>
              Et deuen {formatMoney(owedToMe)} entre {debts.length} {debts.length === 1 ? 'persona' : 'persones'}
            </AppText>
          ) : null}
          {iOwe > 0 && paidBy ? (
            <AppText variant="bodyStrong" color={colors.iOwe}>
              Deus {formatMoney(iOwe)} a {label(paidBy)}
            </AppText>
          ) : null}
          <AppText variant="small" color={colors.textMuted}>
            {shares.size > 1 && amount % shares.size !== 0
              ? 'Els cèntims que no es poden repartir els assumeix qui ha pagat.'
              : 'Ho veuràs al saldo de cada persona.'}
          </AppText>
        </View>
      ) : null}

      <Button label={existing ? 'Desa la despesa' : 'Afegeix la despesa'} onPress={save} disabled={!canSave} />
      {existing ? <Button label="Esborra la despesa" variant="danger" icon="trash" onPress={onDelete} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.xl, gap: space.xl, paddingTop: space.sm, width: '100%', maxWidth: sheetMaxWidth, alignSelf: 'center' },
  amountBox: { alignItems: 'center', gap: space.xs },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  amountInput: {
    fontFamily: fonts.display,
    fontSize: 52,
    minWidth: 120,
    maxWidth: 280,
    textAlign: 'center',
    paddingVertical: 0,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  payers: { gap: space.sm },
  payer: {
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
  payerSelected: { borderColor: colors.accent, borderWidth: 2 },
  list: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  member: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: touchTarget + 8 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  summary: { gap: space.xs, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface },
});
