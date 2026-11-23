import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { FieldGroup, TextField } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { SheetHeader } from '@/components/SheetHeader';
import { AppleButton } from '@/features/account/AppleButton';
import { GoogleButton } from '@/features/account/GoogleButton';
import { AuthCancelled, authErrorMessage, sendEmailCode, verifyEmailCode } from '@/features/account/auth';
import { signInWithApple, signInWithGoogle } from '@/features/account/oauth';
import { completeOnboarding, readState } from '@/store/store';
import { colors, fonts, radius, space, sheetMaxWidth } from '@/theme/tokens';

type Step = 'choose' | 'email' | 'code';

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
const isCode = (s: string) => /^\d{6,10}$/.test(s.trim());

/** Sign in / create account sheet: Apple (iOS), Google, or email with a one-time code. */
export default function AccountSheet() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('choose');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = () => {
    if (readState().onboarded) {
      router.back();
    } else {
      completeOnboarding();
      router.replace('/');
    }
  };

  const run = async (action: () => Promise<void>, onDone?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onDone?.();
    } catch (e) {
      if (!(e instanceof AuthCancelled)) setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // On web, Google leaves the page; the session is picked up when the app loads again.
  const google = () => run(signInWithGoogle, Platform.OS === 'web' ? undefined : finish);
  const apple = () => run(signInWithApple, finish);
  const sendCode = () => run(() => sendEmailCode(email), () => setStep('code'));
  const verify = () => run(() => verifyEmailCode(email, code), finish);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      <SheetHeader title="Compte" onCancel={() => router.back()} />

      {step === 'choose' ? (
        <>
          <View style={styles.hero}>
            <Image source={require('../../assets/images/logo.svg')} style={styles.logo} contentFit="contain" accessibilityElementsHidden />
            <AppText variant="largeTitle" accessibilityRole="header" style={styles.center}>
              Guarda-ho al núvol
            </AppText>
            <AppText variant="body" color={colors.textMuted} style={[styles.center, styles.lead]}>
              Inicia sessió o crea un compte per tenir les dades a tots els teus dispositius. El que ja tens apuntat aquí s’hi afegirà.
            </AppText>
          </View>

          <View style={styles.actions}>
            <AppleButton onPress={apple} disabled={busy} />
            <GoogleButton onPress={google} disabled={busy} />

            <View style={styles.divider} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={styles.rule} />
              <AppText variant="small" color={colors.textFaint}>
                o
              </AppText>
              <View style={styles.rule} />
            </View>

            <Button label="Entra amb el correu" variant="secondary" icon="mail" onPress={() => setStep('email')} disabled={busy} />
          </View>
        </>
      ) : (
        <View style={styles.intro}>
          <AppText variant="largeTitle" accessibilityRole="header">
            {step === 'code' ? 'Revisa el correu' : 'Entra amb el correu'}
          </AppText>
          <AppText variant="body" color={colors.textMuted}>
            {step === 'code'
              ? `Hem enviat un codi a ${email.trim()}. Escriu-lo aquí per entrar.`
              : 'T’enviarem un codi d’un sol ús: no cal cap contrasenya.'}
          </AppText>
        </View>
      )}

      {step === 'email' ? (
        <View style={styles.actions}>
          <FieldGroup>
            <TextField
              label="Correu"
              value={email}
              onChangeText={setEmail}
              placeholder="nom@exemple.cat"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={() => isEmail(email) && sendCode()}
              autoFocus
              last
            />
          </FieldGroup>
          <Button label="Envia’m un codi" onPress={sendCode} disabled={busy || !isEmail(email)} />
          <Button label="Altres opcions" variant="ghost" onPress={() => setStep('choose')} disabled={busy} />
        </View>
      ) : null}

      {step === 'code' ? (
        <View style={styles.actions}>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
            placeholder="000000"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={10}
            accessibilityLabel="Codi de verificació"
            autoFocus
            style={styles.codeInput}
          />
          <Button label="Entra" onPress={verify} disabled={busy || !isCode(code)} />
          <Button label="Torna a enviar el codi" variant="ghost" onPress={sendCode} disabled={busy} />
          <Button
            label="Canvia el correu"
            variant="ghost"
            onPress={() => {
              setCode('');
              setStep('email');
            }}
            disabled={busy}
          />
        </View>
      ) : null}

      {error ? (
        <AppText variant="caption" color={colors.danger} accessibilityRole="alert" style={styles.center}>
          {error}
        </AppText>
      ) : null}

      <View style={styles.note}>
        <Icon name="lock" size={14} color={colors.textFaint} style={styles.noteIcon} />
        <AppText variant="small" color={colors.textMuted} style={styles.noteText}>
          Només tu pots veure les teves dades. Pots eliminar el compte quan vulguis des d’Ajustos.
        </AppText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  // Centered column on wide (web) windows; full width on phones.
  content: { paddingHorizontal: space.xl, gap: space.xl, paddingTop: space.sm, width: '100%', maxWidth: sheetMaxWidth, alignSelf: 'center' },
  intro: { gap: space.sm },
  hero: { alignItems: 'center', gap: space.md, paddingTop: space.lg },
  logo: { width: 84, height: 84, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, marginBottom: space.sm },
  lead: { maxWidth: 420 },
  actions: { gap: space.md },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.xs },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingHorizontal: space.xs },
  noteIcon: { marginTop: 1 },
  noteText: { flex: 1 },
  center: { textAlign: 'center' },
  codeInput: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 36,
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    fontVariant: ['tabular-nums'],
  },
});
