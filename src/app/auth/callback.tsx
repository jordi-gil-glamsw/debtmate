import * as Linking from 'expo-linking';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { createSessionFromUrl } from '@/features/account/oauth';
import { colors } from '@/theme/tokens';

/** Gives up waiting for the link after this long and just goes home. */
const TIMEOUT_MS = 4000;

/**
 * Target of ovia://auth/callback: an email link or the Google redirect opening the app.
 * Reads the session from the URL, then goes home (SyncManager takes over from there).
 * On web the Supabase client reads the URL by itself.
 */
export default function AuthCallback() {
  const url = Linking.useURL();
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const finish = () => {
      if (!cancelled) setDone(true);
    };
    const timer = setTimeout(finish, TIMEOUT_MS);
    if (url) {
      // Errors (e.g. the Google flow already used these tokens) are not fatal: just go home.
      createSessionFromUrl(url).catch(() => {}).finally(finish);
    }
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [url]);

  if (done) return <Redirect href="/" />;
  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
