import { Image } from 'expo-image';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { fonts, radius, space, touchTarget } from '@/theme/tokens';

// Google's "light" button: white fill, neutral outline, #1F1F1F label, multicolor G.
// Matches the white Apple button above it. https://developers.google.com/identity/branding-guidelines
const GOOGLE_BORDER = '#747775';
const GOOGLE_LABEL = '#1F1F1F';

/** "Continua amb Google" button with the official logo. */
export function GoogleButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Continua amb Google"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.base, { opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }]}>
      <Image source={require('../../../assets/images/google-g.svg')} style={styles.logo} contentFit="contain" accessibilityElementsHidden />
      <AppText variant="bodyStrong" color={GOOGLE_LABEL} style={styles.label} numberOfLines={1}>
        Continua amb Google
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget + 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: GOOGLE_BORDER,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  logo: { width: 20, height: 20 },
  label: { fontFamily: fonts.bodySemiBold },
});
