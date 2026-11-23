import { Platform, useWindowDimensions } from 'react-native';

/** Width from which the web app switches to the desktop layout (sidebar, table, detail panel). */
export const DESKTOP_MIN_WIDTH = 1024;

/** True on web when the window is wide enough for the desktop layout. Always false on iOS/Android. */
export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH;
}
