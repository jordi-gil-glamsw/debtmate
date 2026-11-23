import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/tokens';

/** Horizontal split bar: share owed to me (blue) vs share I owe (orange). */
export function BalanceBar({ owedToMe, iOwe, height = 10 }: { owedToMe: number; iOwe: number; height?: number }) {
  const total = owedToMe + iOwe;
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]} accessibilityElementsHidden importantForAccessibility="no">
      {total > 0 ? (
        <>
          <View style={{ flex: owedToMe, backgroundColor: colors.owedToMe }} />
          <View style={{ flex: iOwe, backgroundColor: colors.iOwe }} />
        </>
      ) : null}
    </View>
  );
}

/** Progress bar (returned / total). */
export function ProgressBar({ ratio, color = colors.accent }: { ratio: number; color?: string }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <View style={[styles.track, { height: 8, borderRadius: 4 }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}>
      <View style={{ width: `${pct}%`, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', overflow: 'hidden', backgroundColor: colors.surfaceMuted },
});
