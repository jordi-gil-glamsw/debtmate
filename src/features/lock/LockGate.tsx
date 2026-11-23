import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { useSettings } from '@/store/store';
import { colors, space } from '@/theme/tokens';

function requestUnlock(): Promise<boolean> {
  return LocalAuthentication.authenticateAsync({
    promptMessage: 'Desbloqueja Ovia',
    cancelLabel: 'Cancel·la',
    disableDeviceFallback: false,
  }).then((r) => r.success);
}

/**
 * When "Bloqueja amb Face ID" is on, covers the app until the user authenticates
 * (Face ID / Touch ID / fingerprint, falling back to the device passcode).
 * Locks again whenever the app goes to the background. Not used on web.
 *
 * Note: the Face ID prompt itself moves the app to "inactive" (not "background"),
 * so we only re-prompt on a background → active transition to avoid prompt loops.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const { biometricLock } = useSettings();
  const enabled = biometricLock && Platform.OS !== 'web';
  // Locked at launch only if the lock was already on. Turning it on from Settings
  // (which authenticates there) must not lock the current session.
  const lockedAtLaunch = useRef(enabled);
  const [unlocked, setUnlocked] = useState(!enabled);
  const previousState = useRef(AppState.currentState);

  const unlock = () => {
    requestUnlock().then((ok) => {
      if (ok) setUnlocked(true);
    });
  };

  // Prompt once on launch when the lock was already enabled.
  useEffect(() => {
    if (!lockedAtLaunch.current) return;
    let cancelled = false;
    requestUnlock().then((ok) => {
      if (ok && !cancelled) setUnlocked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-lock in background; prompt again when coming back.
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (next) => {
      const prev = previousState.current;
      previousState.current = next;
      if (next === 'background') setUnlocked(false);
      else if (next === 'active' && prev === 'background') {
        requestUnlock().then((ok) => {
          if (ok) setUnlocked(true);
        });
      }
    });
    return () => sub.remove();
  }, [enabled]);

  const locked = enabled && !unlocked;

  return (
    <View style={styles.fill}>
      {children}
      {locked ? (
        <View style={[StyleSheet.absoluteFill, styles.overlay]}>
          <Icon name="lock" size={40} color={colors.accent} />
          <AppText variant="title">Ovia està bloquejat</AppText>
          <Button label="Desbloqueja" onPress={unlock} style={{ alignSelf: 'stretch' }} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: {
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    padding: space.xxxl,
  },
});
