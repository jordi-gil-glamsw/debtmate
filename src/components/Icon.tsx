import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

import { colors } from '@/theme/tokens';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

/** Semantic icon names → SF Symbols on iOS, Material Symbols on Android and web. */
const ICONS = {
  add: { ios: 'plus', android: 'add', web: 'add' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  back: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  owedToMe: { ios: 'arrow.down.left', android: 'south_west', web: 'south_west' },
  iOwe: { ios: 'arrow.up.right', android: 'north_east', web: 'north_east' },
  share: { ios: 'square.and.arrow.up', android: 'share', web: 'share' },
  calendar: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  lock: { ios: 'lock.fill', android: 'lock', web: 'lock' },
  trash: { ios: 'trash', android: 'delete', web: 'delete' },
  export: { ios: 'square.and.arrow.down', android: 'download', web: 'download' },
  personAdd: { ios: 'person.badge.plus', android: 'person_add', web: 'person_add' },
  receipt: { ios: 'doc.text', android: 'receipt_long', web: 'receipt_long' },
  payment: { ios: 'eurosign.circle', android: 'payments', web: 'payments' },
} satisfies Record<string, SymbolName>;

export type IconName = keyof typeof ICONS;

type Props = {
  name: IconName;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
};

export function Icon({ name, size = 20, color = colors.text, style }: Props) {
  return <SymbolView name={ICONS[name]} size={size} tintColor={color} style={style} aria-hidden />;
}
