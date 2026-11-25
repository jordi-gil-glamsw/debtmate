/**
 * Wallets: personal money vs the shared family card. Every debt, payment and group expense
 * belongs to one; the screens show one wallet or both together (see WalletView).
 */
import type { Wallet, WalletView } from './types.ts';

export const WALLETS: readonly Wallet[] = ['personal', 'familia'];

/** The wallet of a record (a missing value means personal). */
export function walletOf(record: { wallet?: Wallet }): Wallet {
  return record.wallet ?? 'personal';
}

/** Whether a record is shown in the given view. */
export function inWallet(view: WalletView, record: { wallet?: Wallet }): boolean {
  return view === 'all' || walletOf(record) === view;
}

/** The field to spread into a record: nothing for personal, so stored data stays as before. */
export function walletField(wallet: Wallet): { wallet?: Wallet } {
  return wallet === 'personal' ? {} : { wallet };
}

/** Wallet to preselect in a form: the one being viewed, or personal when viewing both. */
export function defaultWallet(view: WalletView): Wallet {
  return view === 'all' ? 'personal' : view;
}
