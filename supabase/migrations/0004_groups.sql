-- Ovia · groups and shared group expenses.
-- Mirrors Group and GroupExpense in src/domain/types.ts. The debts an expense creates between
-- me and each person are derived in the app (src/domain/groups.ts), never stored.

create table public.groups (
  id          uuid primary key,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 100),
  member_ids  uuid[] not null default '{}',   -- contacts (I'm always implicitly a member)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table public.expenses (
  id               uuid primary key,
  owner_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  group_id         uuid not null references public.groups (id) on delete cascade,
  concept          text not null default '',
  amount_cents     bigint not null check (amount_cents > 0),
  date             date not null,
  paid_by          uuid,                        -- contact who paid; null = me
  participant_ids  uuid[] not null default '{}', -- contacts who took part (not me)
  includes_me      boolean not null default true,
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create index groups_owner_updated_idx   on public.groups   (owner_id, updated_at);
create index expenses_owner_updated_idx on public.expenses (owner_id, updated_at);
create index expenses_group_idx         on public.expenses (group_id);

-- touch_updated_at() comes from 0001_init.sql.
create trigger groups_touch   before update on public.groups   for each row execute function public.touch_updated_at();
create trigger expenses_touch before update on public.expenses for each row execute function public.touch_updated_at();

alter table public.groups   enable row level security;
alter table public.expenses enable row level security;

create policy "own groups" on public.groups
  for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "own expenses" on public.expenses
  for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

grant select, insert, update, delete on public.groups   to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
