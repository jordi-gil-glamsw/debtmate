/**
 * Bottom padding that clears the home indicator, plus `extra`.
 * Native: `inset` comes from useSafeAreaInsets(). See safeArea.web.ts for why web differs.
 */
export function safeBottom(inset: number, extra = 0): number {
  return inset + extra;
}
