import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatMoney } from '@/domain/money';
import { balanceColor, colors, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Avatar } from './Avatar';

type Props = {
  id: string;
  name: string;
  balance: number;
  subtitle?: string;
};

export function balanceLabel(balance: number): string {
  if (balance > 0) return 'et deu';
  if (balance < 0) return 'li deus';
  return 'al dia';
}

export function PersonRow({ id, name, balance, subtitle }: Props) {
  const amount = formatMoney(balance, { sign: 'always', currency: false });
  return (
    // Pressable + router.push rather than <Link asChild>: on web, Link's slot drops function styles.
    <Pressable
      onPress={() => router.push({ pathname: '/persona/[id]', params: { id } })}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${balanceLabel(balance)} ${formatMoney(balance, { sign: 'never' })}`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}>
      <Avatar name={name} />
      <View style={styles.middle}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {name}
        </AppText>
        {subtitle ? (
          <AppText variant="small" color={colors.textMuted} numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <View style={styles.right}>
        <AppText variant="amount" color={balanceColor(balance)}>
          {amount}
        </AppText>
        <AppText variant="small" color={colors.textMuted}>
          {balanceLabel(balance)}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  middle: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end', gap: 1 },
});
