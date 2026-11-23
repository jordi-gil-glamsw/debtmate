/** Design tokens for visual direction "B · Fosc fintech". */

export const colors = {
  bg: '#0E0F13',
  surface: '#181A21',
  surfaceRaised: '#1E2029',
  surfaceMuted: '#262934',
  border: '#2C2F3A',
  borderStrong: '#333744',
  text: '#F2F3F5',
  textMuted: '#9AA0AC',
  textFaint: '#7D8391',
  accent: '#C8F169', // primary actions
  onAccent: '#0E0F13',
  owedToMe: '#7DB8FF', // they owe me (blue)
  iOwe: '#FFB067', // I owe (orange)
  danger: '#FF8A80',
  success: '#34C759',
  scrim: 'rgba(0,0,0,0.62)',
} as const;

/** Font family names as registered by @expo-google-fonts in the root layout. */
export const fonts = {
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  display: 'SpaceGrotesk_600SemiBold',
  displayBold: 'SpaceGrotesk_700Bold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { sm: 10, md: 14, lg: 16, xl: 20, xxl: 24, pill: 999 } as const;

/** Minimum touch target (Apple HIG 44pt, Material 48dp). */
export const touchTarget = 44;

/** Max width of form sheets, so they stay readable on desktop browsers. */
export const sheetMaxWidth = 600;

/** Colour for a contact balance (positive = owed to me). */
export function balanceColor(cents: number): string {
  if (cents > 0) return colors.owedToMe;
  if (cents < 0) return colors.iOwe;
  return colors.textMuted;
}
