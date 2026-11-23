import { Image, type ImageStyle } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { signedReceiptUrl } from '@/sync/receiptStorage';
import { colors } from '@/theme/tokens';

import { localReceiptUri } from './receipts';

/** Where to load a photo from: the device copy, or a temporary link to the account copy. */
export function useReceiptUri(name: string | undefined): { uri: string | null; loading: boolean } {
  const local = name ? localReceiptUri(name) : null;
  const [remote, setRemote] = useState<{ name: string; uri: string | null } | null>(null);

  useEffect(() => {
    if (!name || local) return;
    let cancelled = false;
    signedReceiptUrl(name).then(
      (uri) => {
        if (!cancelled) setRemote({ name, uri });
      },
      () => {
        if (!cancelled) setRemote({ name, uri: null });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [name, local]);

  if (!name) return { uri: null, loading: false };
  if (local) return { uri: local, loading: false };
  if (remote?.name === name) return { uri: remote.uri, loading: false };
  return { uri: null, loading: true };
}

type Props = {
  name: string;
  style: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain';
  accessibilityLabel?: string;
};

export function ReceiptImage({ name, style, contentFit = 'cover', accessibilityLabel = 'Foto del tiquet' }: Props) {
  const { uri, loading } = useReceiptUri(name);

  if (uri) {
    return <Image source={{ uri }} style={style} contentFit={contentFit} accessibilityLabel={accessibilityLabel} transition={150} />;
  }
  return (
    <View style={[style as object, styles.placeholder]} accessibilityLabel={accessibilityLabel}>
      {loading ? (
        <ActivityIndicator color={colors.textMuted} />
      ) : (
        <>
          <Icon name="photo" size={20} color={colors.textMuted} />
          <AppText variant="small" color={colors.textMuted} style={styles.center}>
            No disponible
          </AppText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.04)' },
  center: { textAlign: 'center' },
});
