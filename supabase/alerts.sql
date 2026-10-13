-- Order alerts (run once in Supabase > SQL Editor, after setup.sql).
-- BEFORE RUNNING: replace OWNER@EMAIL.COM with Milly's login (same one as setup.sql).
-- The owner login now lives in one place, owner_email(); is_owner() reads it.
create or replace function public.owner_email() returns text language sql stable as $$
  select lower('OWNER@EMAIL.COM')
$$;
revoke all on function public.owner_email() from public, anon, authenticated;
grant execute on function public.owner_email() to service_role;

create or replace function public.is_owner() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(lower(auth.jwt()->>'email') = public.owner_email(), false)
$$;
grant execute on function public.is_owner() to anon, authenticated;

-- the phones Milly turned alerts on for; only she can see or change this list
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 60 and 120),
  auth text not null check (char_length(auth) between 16 and 40),
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists ps_read on public.push_subscriptions; create policy ps_read on public.push_subscriptions for select to authenticated using (public.is_owner());
drop policy if exists ps_add  on public.push_subscriptions; create policy ps_add  on public.push_subscriptions for insert to authenticated with check (public.is_owner());
drop policy if exists ps_del  on public.push_subscriptions; create policy ps_del  on public.push_subscriptions for delete to authenticated using (public.is_owner());
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;

-- make the API see the new function and table right away
notify pgrst, 'reload schema';
