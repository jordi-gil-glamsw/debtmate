import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { LockGate } from '@/features/lock/LockGate';
import { ReminderManager } from '@/features/reminders/ReminderManager';
import { useOnboarded } from '@/store/store';
import { SyncManager } from '@/sync/SyncManager';
import { colors, fonts } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

/** The stack's base screen. Without it, a cold start could fall back to /compte. */
export const unstable_settings = { anchor: '(tabs)' };

const theme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
  },
};

const sheetOptions = {
  presentation: 'formSheet',
  headerShown: false,
  sheetGrabberVisible: true,
  sheetCornerRadius: 24,
  contentStyle: { backgroundColor: colors.bg },
} as const;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  const onboarded = useOnboarded();
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <SyncManager />
      <ReminderManager />
      <LockGate>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { fontFamily: fonts.bodySemiBold },
            headerShadowVisible: false,
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: colors.bg },
          }}>
          {/* Not guarded: on a cold start at "/" a guarded (tabs) made the navigator fall back to
              its first screen (/compte). The tab layouts redirect to /benvinguda themselves. */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Protected guard={onboarded} redirectTo="/benvinguda">
            <Stack.Screen name="persona/[id]" options={{ title: '' }} />
            <Stack.Screen name="nou" options={{ ...sheetOptions, sheetAllowedDetents: [1] }} />
            <Stack.Screen name="pagament/[id]" options={{ ...sheetOptions, sheetAllowedDetents: [0.85, 1] }} />
            <Stack.Screen name="moviment/[id]" options={{ ...sheetOptions, sheetAllowedDetents: [1] }} />
          </Stack.Protected>
          <Stack.Protected guard={!onboarded} redirectTo="/">
            <Stack.Screen name="benvinguda" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Screen name="compte" options={{ ...sheetOptions, sheetAllowedDetents: [1] }} />
          <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        </Stack>
      </LockGate>
    </ThemeProvider>
  );
}
