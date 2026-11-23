import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { features } from '@/config/features';
import { useSession } from '@/features/account/session';
import { confirm, notify } from '@/lib/dialogs';
import { colors, radius, space } from '@/theme/tokens';

import { ReceiptImage } from './ReceiptImage';
import { canTakePhoto, pickReceipt, receiptsNeedAccount } from './receipts';

type Props = {
  /** Photo file name, or undefined when there is none. */
  value: string | undefined;
  onChange: (name: string | undefined) => void;
};

/** Ask where the photo comes from (native action sheet); web only has the file picker. */
function chooseSource(): Promise<'camera' | 'library' | null> {
  if (!canTakePhoto) return Promise.resolve('library');
  return new Promise((resolve) => {
    Alert.alert(
      'Foto del tiquet',
      undefined,
      [
        { text: 'Fes una foto', onPress: () => resolve('camera') },
        { text: 'Tria de la galeria', onPress: () => resolve('library') },
        { text: 'Cancel·la', style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

/** "Add photo" button, or the thumbnail with Change / Remove. */
export function ReceiptField({ value, onChange }: Props) {
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const blocked = receiptsNeedAccount && !session;

  // Hidden until the paid tier: see src/config/features.ts.
  if (!features.receiptPhotos) return null;

  const pick = async () => {
    const source = await chooseSource();
    if (!source) return;
    setBusy(true);
    try {
      const result = await pickReceipt(source);
      if (!result) return;
      if ('error' in result) {
        const ok = await confirm(
          'Sense accés a la càmera',
          'Permet l’accés a la càmera de Ovia als ajustos del dispositiu.',
          'Obre els ajustos',
        );
        if (ok) Linking.openSettings();
        return;
      }
      onChange(result.name);
    } catch {
      notify('No s’ha pogut afegir la foto', 'Torna-ho a provar.');
    } finally {
      setBusy(false);
    }
  };

  if (blocked) {
    return (
      <AppText variant="caption" color={colors.textMuted}>
        Inicia sessió per afegir fotos des del web.
      </AppText>
    );
  }

  if (!value) {
    return busy ? (
      <ActivityIndicator color={colors.textMuted} style={styles.busy} />
    ) : (
      <Button label="Afegeix la foto del tiquet" variant="secondary" icon="camera" onPress={pick} />
    );
  }

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => router.push({ pathname: '/tiquet/[name]', params: { name: value } })}
        accessibilityRole="imagebutton"
        accessibilityLabel="Mostra la foto del tiquet">
        <ReceiptImage name={value} style={styles.thumb} />
      </Pressable>
      <View style={styles.actions}>
        <Button label="Canvia" variant="secondary" onPress={pick} disabled={busy} />
        <Button label="Treu" variant="danger" onPress={() => onChange(undefined)} disabled={busy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  thumb: { width: 88, height: 88, borderRadius: radius.md, overflow: 'hidden' },
  actions: { flex: 1, gap: space.sm },
  busy: { paddingVertical: space.lg, alignSelf: Platform.OS === 'web' ? 'flex-start' : 'center' },
});
