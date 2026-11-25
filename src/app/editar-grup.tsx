import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { FieldGroup, TextField } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { SheetHeader } from '@/components/SheetHeader';
import { confirm } from '@/lib/dialogs';
import { addContact, addGroup, deleteGroup, updateGroup, useAllExpenses, useContacts, useGroup } from '@/store/store';
import { colors, fonts, radius, sheetMaxWidth, space, touchTarget } from '@/theme/tokens';

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Create a group (no id) or edit one (?id=): name and members. */
export default function EditGroupSheet() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const group = useGroup(id);
  const contacts = useContacts();
  const expenseCount = useAllExpenses().filter((e) => e.groupId === id).length;
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(group?.name ?? '');
  const [members, setMembers] = useState<string[]>(group?.memberIds ?? []);
  /** People typed in here that don't exist yet; created on save. */
  const [newPeople, setNewPeople] = useState<string[]>([]);
  const [newName, setNewName] = useState('');

  const sorted = useMemo(() => [...contacts].sort((a, b) => a.name.localeCompare(b.name, 'ca')), [contacts]);

  if (id && !group) {
    return (
      <View style={[styles.root, styles.content]}>
        <SheetHeader title="Grup" onCancel={() => router.back()} />
        <AppText variant="body" color={colors.textMuted}>
          Aquest grup ja no existeix.
        </AppText>
      </View>
    );
  }

  const memberCount = members.length + newPeople.length;
  const canSave = name.trim().length > 0 && memberCount > 0;

  const toggle = (contactId: string) =>
    setMembers((m) => (m.includes(contactId) ? m.filter((x) => x !== contactId) : [...m, contactId]));

  const addNewPerson = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const existing = contacts.find((c) => sameName(c.name, trimmed));
    if (existing) {
      if (!members.includes(existing.id)) setMembers((m) => [...m, existing.id]);
    } else if (!newPeople.some((n) => sameName(n, trimmed))) {
      setNewPeople((p) => [...p, trimmed]);
    }
    setNewName('');
  };

  const save = () => {
    if (!canSave) return;
    const memberIds = [...members, ...newPeople.map((n) => addContact(n).id)];
    if (group) updateGroup(group.id, { name, memberIds });
    else {
      const created = addGroup(name, memberIds);
      router.back();
      router.push({ pathname: '/grup/[id]', params: { id: created.id } });
      return;
    }
    router.back();
  };

  const onDelete = async () => {
    if (!group) return;
    const message =
      expenseCount > 0
        ? `S’esborraran també les seves ${expenseCount} despeses i els deutes que generaven.`
        : 'Les persones no s’esborren.';
    if (await confirm(`Esborrar «${group.name}»`, message, 'Esborra', true)) {
      // Close this sheet and the group's screen behind it.
      router.dismissAll();
      deleteGroup(group.id);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      <SheetHeader title={group ? 'Edita el grup' : 'Nou grup'} onCancel={() => router.back()} onConfirm={save} confirmDisabled={!canSave} />

      <FieldGroup>
        <TextField
          label="Nom"
          value={name}
          onChangeText={setName}
          placeholder="Colla del dinar, Viatge…"
          autoCapitalize="sentences"
          autoFocus={!group}
          last
        />
      </FieldGroup>

      <View style={{ gap: space.sm }}>
        <AppText variant="captionStrong" color={colors.textMuted}>
          Persones · {memberCount + 1} amb tu
        </AppText>

        <View style={styles.addRow}>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Afegeix una persona nova"
            placeholderTextColor={colors.textFaint}
            accessibilityLabel="Nom d’una persona nova"
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={addNewPerson}
            style={styles.addInput}
          />
          <Pressable
            onPress={addNewPerson}
            disabled={!newName.trim()}
            accessibilityRole="button"
            accessibilityLabel="Afegeix"
            style={[styles.addButton, !newName.trim() && { opacity: 0.4 }]}>
            <Icon name="personAdd" size={18} color={colors.onAccent} />
          </Pressable>
        </View>

        <View style={styles.list}>
          {newPeople.map((n) => (
            <MemberRow key={`new:${n}`} name={n} selected subtitle="Nova" onPress={() => setNewPeople((p) => p.filter((x) => x !== n))} />
          ))}
          {sorted.map((c) => (
            <MemberRow key={c.id} name={c.name} selected={members.includes(c.id)} onPress={() => toggle(c.id)} />
          ))}
        </View>
        {sorted.length === 0 && newPeople.length === 0 ? (
          <AppText variant="small" color={colors.textMuted}>
            Escriu el nom dels amics que formen el grup.
          </AppText>
        ) : null}
      </View>

      <Button label={group ? 'Desa el grup' : 'Crea el grup'} onPress={save} disabled={!canSave} />
      {group ? <Button label="Esborra el grup" variant="danger" icon="trash" onPress={onDelete} /> : null}
    </ScrollView>
  );
}

function MemberRow({ name, selected, subtitle, onPress }: { name: string; selected: boolean; subtitle?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={name}
      style={({ pressed }) => [styles.member, pressed && { opacity: 0.75 }]}>
      <Avatar name={name} size={32} />
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {name}
        </AppText>
        {subtitle ? (
          <AppText variant="small" color={colors.accent}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.check, selected && styles.checkOn]}>{selected ? <Icon name="check" size={14} color={colors.onAccent} /> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.xl, gap: space.xl, paddingTop: space.sm, width: '100%', maxWidth: sheetMaxWidth, alignSelf: 'center' },
  addRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  addInput: {
    flex: 1,
    minHeight: touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    color: colors.text,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
  },
  addButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    minHeight: touchTarget + 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
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
});
