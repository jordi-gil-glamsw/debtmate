import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { ReceiptImage } from '@/features/receipts/ReceiptImage';
import { colors, space, touchTarget } from '@/theme/tokens';

/** Full-screen receipt photo. */
export default function ReceiptViewer() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Tanca" hitSlop={8} style={styles.close}>
          <Icon name="close" size={22} color={colors.text} />
        </Pressable>
        <AppText variant="bodyStrong">Tiquet</AppText>
        <View style={styles.close} />
      </View>
      {name ? <ReceiptImage name={name} style={styles.image} contentFit="contain" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg },
  close: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  image: { flex: 1, width: '100%' },
});
