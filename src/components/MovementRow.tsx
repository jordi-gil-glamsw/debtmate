import { Pressable, StyleSheet, View } from 'react-native';

import { signedEffect } from '@/domain/balances';
import { formatShortDate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { PAYMENT_METHOD_LABELS, type Movement } from '@/domain/types';
import { colors, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

/** Human description of what the movement means, e.g. "et deu", "li has pagat". */
export function describeMovement(m: Movement): string {
  if (m.kind === 'debt') return m.direction === 'owed' ? 'Et deu' : 'Li deus';
  return `${m.direction === 'in' ? 'T’ha pagat' : 'Li has pagat'} · ${PAYMENT_METHOD_LABELS[m.method]}`;
}

function visuals(m: Movement): { icon: IconName; color: string } {
  if (m.kind === 'payment') return { icon: 'check', color: colors.accent };
  return m.direction === 'owed' ? { icon: 'owedToMe', color: colors.owedToMe } : { icon: 'iOwe', color: colors.iOwe };
}

type Props = {
  movement: Movement;
  /** Shown instead of the date line (e.g. the person's name in the activity feed). */
  subtitle?: string;
  /** Usually opens the edit sheet. */
  onPress?: () => void;
  onLongPress?: () => void;
};

export function MovementRow({ movement, subtitle, onPress, onLongPress }: Props) {
  const { icon, color } = visuals(movement);
  const effect = signedEffect(movement);
  const line = subtitle ?? `${formatShortDate(movement.date)} · ${describeMovement(movement)}`;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityHint={onPress ? 'Obre el moviment per editar-lo' : onLongPress ? 'Mantén premut per esborrar' : undefined}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <View style={styles.icon}>
        <Icon name={icon} size={18} color={color} />
      </View>
      <View style={styles.middle}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {movement.concept}
        </AppText>
        <AppText variant="small" color={colors.textMuted} numberOfLines={1}>
          {line}
        </AppText>
      </View>
      <AppText variant="amount" color={movement.kind === 'payment' ? colors.accent : color}>
        {formatMoney(effect, { sign: 'always', currency: false })}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { flex: 1, gap: 1 },
});
