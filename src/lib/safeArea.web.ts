/**
 * Web version of safeBottom. expo-router gives useSafeAreaInsets() zero insets on web (SDK 58),
 * so the home-indicator inset comes from CSS env(), which only has a value in a home-screen web
 * app and when the viewport declares viewport-fit=cover (see src/app/+html.tsx).
 * react-native-web passes the string through as a CSS value; the cast only satisfies RN's types.
 */
export function safeBottom(_inset: number, extra = 0): number {
  return `calc(env(safe-area-inset-bottom, 0px) + ${extra}px)` as unknown as number;
}
