-- MT-THECREATOR shop database. Run once in Supabase > SQL Editor.
-- BEFORE RUNNING: replace OWNER@EMAIL.COM below with Milly's login: p + her 10-digit phone + @mtthecreator.login
--   e.g. phone (414) 555-0100  ->  p4145550100@mtthecreator.login
-- Then in Authentication > Users > Add user, create that same login with her password and tick "Auto Confirm User".
-- The site reads products, open days and settings with the public key.
-- Orders are written only by the server (api/checkout.js, service key), and only the owner can read them.

create table if not exists products (
  id text primary key,
  cat text not null check (cat in ('paper','media','treat')),
  name text not null,
  note text default '',
  price_cents int not null check (price_cents >= 0 and price_cents <= 100000),
  active boolean not null default true,
  sort int not null default 0
);

create table if not exists open_days (
  day date primary key,
  note text default ''
);

create table if not exists settings (
  k text primary key,
  v jsonb not null
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  phone text not null,
  email text default '',
  items jsonb not null,               -- [{id,name,qty,price_cents}] priced by the server
  total_cents int not null,
  fulfil text not null check (fulfil in ('pickup','delivery')),
  day date,                           -- pickup day (treats) or needed-by day
  address text default '',
  details text default '',
  status text not null default 'new' check (status in ('new','making','ready','done','cancelled')),
  paid boolean not null default false,
  paid_at timestamptz,
  stripe_session text
);

create or replace function is_owner() returns boolean language sql stable as $$
  select coalesce(lower(auth.jwt()->>'email') = lower('OWNER@EMAIL.COM'), false)
$$;

alter table products  enable row level security;
alter table open_days enable row level security;
alter table settings  enable row level security;
alter table orders    enable row level security;

drop policy if exists p_read on products;   create policy p_read on products for select using (true);
drop policy if exists p_own  on products;   create policy p_own  on products for all using (is_owner()) with check (is_owner());
drop policy if exists d_read on open_days;  create policy d_read on open_days for select using (true);
drop policy if exists d_own  on open_days;  create policy d_own  on open_days for all using (is_owner()) with check (is_owner());
drop policy if exists s_read on settings;   create policy s_read on settings for select using (true);
drop policy if exists s_own  on settings;   create policy s_own  on settings for all using (is_owner()) with check (is_owner());
-- No public policy on orders: visitors can't read or write them.
drop policy if exists o_own  on orders;     create policy o_own  on orders for select using (is_owner());
drop policy if exists o_upd  on orders;     create policy o_upd  on orders for update using (is_owner()) with check (is_owner());

-- Starting menu (Milly's prices, 2026-10-12). She edits these in the panel.
insert into products (id,cat,name,note,price_cents,sort) values
 ('itinerary','paper','Itinerary','',2500,1),
 ('poster','paper','Poster','',2500,2),
 ('flyer','paper','Flyer','',1500,3),
 ('card','paper','Card','',1500,4),
 ('invite','paper','Custom invitation','',1500,5),
 ('bizcard','paper','Business cards','',1500,6),
 ('pfp','paper','Business profile picture','',1000,7),
 ('photo-edit','media','Photo editing','Your photos, edited',1000,10),
 ('photo-shoot','media','Photo shoot + editing','Taken and edited by Milly',1500,11),
 ('yt','media','YouTube intro / outro','',3000,12),
 ('cookie-1','treat','Cookie','Single',200,20),
 ('cookie-3','treat','Cookies, 3 pack','',500,21),
 ('milly-dozen','treat','Milly Dozen','13 cookies',1500,22),
 ('loaf','treat','Mini loaf cake','',500,23)
on conflict (id) do nothing;

insert into settings (k,v) values
 ('shop', '{"open":true,"banner":"","delivery_fee_cents":0,"phone":"","instagram":"mtthecreator_"}')
on conflict (k) do nothing;
