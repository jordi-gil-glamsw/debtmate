-- Ovia · explicit Data API privileges.
-- Newer Supabase projects don't expose new tables to the API roles automatically.
-- Only signed-in users get access; row level security (0001) still limits them to their own rows.
-- No privileges for `anon`: without a session nothing is readable.

grant select, insert, update, delete on public.contacts  to authenticated;
grant select, insert, update, delete on public.movements to authenticated;
grant select on public.contact_balances to authenticated;
