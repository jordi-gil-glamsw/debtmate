-- DebtMate · exact-amount splits and payments that settle a group.
-- Run after 0004_groups.sql.

-- An expense can be shared in equal parts (default) or with an exact amount per person.
-- shares: {"me": 1000, "<contact id>": 2500, ...} in cents; only used when split = 'exact'.
alter table public.expenses
  add column split  text  not null default 'equal' check (split in ('equal', 'exact')),
  add column shares jsonb;

-- A payment can be marked as settling a group's expenses (it still counts for the person).
alter table public.movements
  add column group_id uuid;
