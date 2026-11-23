import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { cloudEnabled } from '@/features/account/session';
import { completeOnboarding, loadSampleData } from '@/store/store';
import { colors, space } from '@/theme/tokens';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl }]}>
      <AppText variant="title" style={styles.brand}>
        ovia
      </AppText>

      <View style={styles.hero}>
        <AppText variant="hero" accessibilityRole="header">
          Qui et deu què.{'\n'}
          <AppText variant="hero" color={colors.accent}>
            I què deus tu.
          </AppText>
        </AppText>
        <AppText variant="body" color={colors.textMuted} style={styles.lead}>
          Apunta els deutes amb amics i família, liquida&apos;ls a poc a poc i tingues la cartera sempre al dia.
        </AppText>
      </View>

      <View style={styles.actions}>
        <Button label="Comença" onPress={completeOnboarding} />
        <Button
          label="Prova-ho amb dades d'exemple"
          variant="secondary"
          onPress={() => {
            loadSampleData();
            completeOnboarding();
          }}
        />
        {cloudEnabled ? (
          <Button label="Ja tinc un compte" variant="ghost" onPress={() => router.push('/compte')} />
        ) : null}
        <AppText variant="small" color={colors.textMuted} style={styles.note}>
          {cloudEnabled
            ? 'Pots començar sense compte: les dades es guarden en aquest dispositiu i les podràs sincronitzar més endavant.'
            : 'Les dades es guarden només en aquest dispositiu.'}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.xxl, alignItems: 'center' },
  brand: { alignSelf: 'stretch', maxWidth: 520, width: '100%' },
  hero: { flex: 1, justifyContent: 'center', gap: space.xl, width: '100%', maxWidth: 520 },
  lead: { fontSize: 16, lineHeight: 24 },
  actions: { gap: space.sm, width: '100%', maxWidth: 520 },
  note: { textAlign: 'center', marginTop: space.sm },
});
