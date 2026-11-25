import type { WalletView } from '@/domain/types';
import { WALLET_LABELS } from '@/domain/types';
import { updateSettings, useSettings, useWalletView } from '@/store/store';

import { SegmentedControl } from './SegmentedControl';

const OPTIONS: { value: WalletView; label: string }[] = [
  { value: 'all', label: 'Tot' },
  { value: 'personal', label: WALLET_LABELS.personal },
  { value: 'familia', label: WALLET_LABELS.familia },
];

/** Switches every screen between personal money, the family card or both. Hidden while wallets are off. */
export function WalletSwitcher() {
  const { wallets } = useSettings();
  const view = useWalletView();
  if (!wallets) return null;
  return (
    <SegmentedControl
      accessibilityLabel="Cartera"
      value={view}
      onChange={(walletView) => updateSettings({ walletView })}
      options={OPTIONS}
    />
  );
}
