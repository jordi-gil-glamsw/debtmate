import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { FieldGroup, TextField } from '@/components/Field';
import { SheetHeader } from '@/components/SheetHeader';
import { renameContact, useContact } from '@/store/store';
import { colors, sheetMaxWidth, space } from '@/theme/tokens';

/** Edit a person (for now, their name). */
export default function EditContactSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const contact = useContact(id);
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(contact?.name ?? '');
  const [error, setError] = useState<string | null>(null);

  if (!contact) {
    return (
      <View style={[styles.root, styles.content]}>
        <SheetHeader title="Persona" onCancel={() => router.back()} />
        <AppText variant="body" color={colors.textMuted}>
          Aquesta persona ja no existeix.
        </AppText>
      </View>
    );
  }

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed !== contact.name;

  const save = () => {
    if (!canSave) return;
    const result = renameContact(contact.id, trimmed);
    if (result === 'duplicate') {
      setError(`Ja tens una persona que es diu «${trimmed}».`);
      return;
    }
    router.back();
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      <SheetHeader title="Edita la persona" onCancel={() => router.back()} onConfirm={save} confirmDisabled={!canSave} />

      <View style={styles.avatar}>
        <Avatar name={trimmed || contact.name} size={64} />
      </View>

      <FieldGroup>
        <TextField
          label="Nom"
          value={name}
          onChangeText={(t) => {
            setName(t);
            setError(null);
          }}
          placeholder="Nom de la persona"
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={save}
          autoFocus
          last
        />
      </FieldGroup>

      {error ? (
        <AppText variant="caption" color={colors.danger} accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.xl, gap: space.xl, paddingTop: space.sm, width: '100%', maxWidth: sheetMaxWidth, alignSelf: 'center' },
  avatar: { alignItems: 'center' },
});
