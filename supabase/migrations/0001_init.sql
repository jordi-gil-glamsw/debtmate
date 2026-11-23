-- Ovia · initial schema (not applied yet; for the upcoming cloud-sync phase).
-- Mirrors src/domain/types.ts. Amounts in integer cents. Balances are derived, never stored.
-- Soft deletes (deleted_at) + updated_at make incremental sync between devices possible.

create table public.contacts (
  id          uuid primary key,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table public.movements (
  id            uuid primary key,
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contact_id    uuid not null references public.contacts (id) on delete cascade,
  kind          text not null check (kind in ('debt', 'payment')),
  direction     text not null,
  amount_cents  bigint not null check (amount_cents > 0),
  concept       text not null default '',
  date          date not null,
  due_date      date,
  method        text,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint movement_shape check (
    (kind = 'debt'    and direction in ('owed', 'owe') and method is null)
    or
    (kind = 'payment' and direction in ('in', 'out')
                      and method in ('bizum', 'efectiu', 'transferencia', 'altres')
                      and due_date is null)
  )
);

create index contacts_owner_updated_idx  on public.contacts  (owner_id, updated_at);
create index movements_owner_updated_idx on public.movements (owner_id, updated_at);
create index movements_contact_idx       on public.movements (contact_id);

-- Keep updated_at fresh on every change (used by sync).
create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger contacts_touch  before update on public.contacts  for each row execute function public.touch_updated_at();
create trigger movements_touch before update on public.movements for each row execute function public.touch_updated_at();

-- Row level security: every user only sees and edits their own rows.
alter table public.contacts  enable row level security;
alter table public.movements enable row level security;

create policy "own contacts" on public.contacts
  for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "own movements" on public.movements
  for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Derived balances (positive = the contact owes me). security_invoker applies the caller's RLS.
create view public.contact_balances with (security_invoker = true) as
select
  c.id as contact_id,
  c.owner_id,
  c.name,
  coalesce(sum(
    case
      when m.kind = 'debt'    and m.direction = 'owed' then  m.amount_cents
      when m.kind = 'debt'    and m.direction = 'owe'  then -m.amount_cents
      when m.kind = 'payment' and m.direction = 'in'   then -m.amount_cents
      when m.kind = 'payment' and m.direction = 'out'  then  m.amount_cents
    end
  ), 0)::bigint as balance_cents
from public.contacts c
left join public.movements m on m.contact_id = c.id and m.deleted_at is null
where c.deleted_at is null
group by c.id, c.owner_id, c.name;
