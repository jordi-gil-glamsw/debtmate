import { View } from 'react-native';

import type { Wallet } from '@/domain/types';
import { WALLET_LABELS } from '@/domain/types';
import { WALLETS } from '@/domain/wallets';
import { useSettings } from '@/store/store';
import { colors, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { SegmentedControl } from './SegmentedControl';

type Props = {
  value: Wallet;
  onChange: (wallet: Wallet) => void;
  /** Question above the control. */
  label?: string;
};

/** Picks the wallet of a debt, payment or expense. Hidden while wallets are off. */
export function WalletField({ value, onChange, label = 'Cartera' }: Props) {
  const { wallets } = useSettings();
  if (!wallets) return null;
  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="captionStrong" color={colors.textMuted}>
        {label}
      </AppText>
      <SegmentedControl
        accessibilityLabel={label}
        value={value}
        onChange={onChange}
        options={WALLETS.map((w) => ({ value: w, label: WALLET_LABELS[w] }))}
      />
    </View>
  );
}
