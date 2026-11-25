-- Ovia · wallets: personal money vs the shared family card.
-- Run after 0005_group_settle_split.sql, BEFORE shipping an app version that syncs wallets
-- (the app always sends this column).
-- null = personal, so rows written by older app versions keep counting as personal.

alter table public.movements
  add column wallet text check (wallet in ('familia'));

alter table public.expenses
  add column wallet text check (wallet in ('familia'));
