-- 长季鲜 · 多人同步数据库（Supabase / PostgreSQL）
-- 用法：Supabase 新项目 → SQL Editor → 新建查询 → 粘贴整段运行。
-- 运行后到 Authentication → Users → Add user 建一个店员账号（邮箱+密码，勾选 auto confirm）。
-- 然后把 Project Settings → API 里的 URL 和 anon public key 填进 App 的「多人同步」。

-- ========== 1. 表 ==========
create table if not exists public.cjx_rooms (
  id text primary key,
  name text not null,
  seats integer default 10,
  sort integer default 1,
  enabled boolean default true,
  note text default '',
  updated_at timestamptz default now(),
  deleted boolean default false
);

create table if not exists public.cjx_dishes (
  id text primary key,
  name text not null,
  category text default '热菜',
  price numeric default 0,
  status text default 'on',          -- on 在售 / preorder 需预订 / off 下市
  lead_days integer default 0,
  tags text[] default '{}',
  flavor text[] default '{}',
  note text default '',
  updated_at timestamptz default now(),
  deleted boolean default false
);

create table if not exists public.cjx_customers (
  id text primary key,
  name text not null,
  aliases text[] default '{}',
  wechat text default '',
  phone text default '',
  tags text[] default '{}',
  dietary text[] default '{}',
  taste_tags text[] default '{}',
  taste_scores jsonb default '{}'::jsonb,
  dish_counts jsonb default '{}'::jsonb,
  pref_room text default '',
  notes text default '',
  visit_count integer default 0,
  last_visit date,
  budget_pref numeric,
  budget_mode text default 'table',
  updated_at timestamptz default now(),
  deleted boolean default false
);

create table if not exists public.cjx_orders (
  id text primary key,
  code text default '',
  status text default 'pending',     -- pending / confirmed / notified / done / cancelled
  date date,
  time text default '',
  party_size integer default 0,
  room_id text default '',
  customer_id text default '',
  customer_name text default '',
  phone text default '',
  wechat text default '',
  occasion text default '',
  dishes jsonb default '[]'::jsonb,
  dietary text[] default '{}',
  taste_hints text[] default '{}',
  special text default '',
  host_name text default '',
  notes text default '',
  budget numeric,
  budget_mode text default 'table',
  menu_source text default 'manual',
  guests jsonb default '[]'::jsonb,
  service_checks jsonb default '{}'::jsonb,
  invite_code text default '',
  invite_at timestamptz,
  missing text[] default '{}',
  change_log jsonb default '[]'::jsonb,
  audit jsonb default '{}'::jsonb,
  change_pending boolean default false,
  updated_at timestamptz default now(),
  deleted boolean default false
);

create table if not exists public.cjx_rsvps (
  id text primary key,
  order_id text default '',
  invite_code text default '',
  guest_name text default '',
  phone text default '',
  attend boolean default true,
  dietary text[] default '{}',
  party_size integer default 1,
  submitted_at timestamptz default now(),
  source text default 'invite'
);

create table if not exists public.cjx_settings (
  id integer primary key,
  doc jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- 已建过表的项目：补上开台准备字段
alter table public.cjx_orders add column if not exists service_checks jsonb default '{}'::jsonb;

create index if not exists cjx_orders_date_idx on public.cjx_orders (date);
create index if not exists cjx_orders_updated_idx on public.cjx_orders (updated_at);
create index if not exists cjx_rsvps_order_idx on public.cjx_rsvps (order_id);
create index if not exists cjx_dishes_updated_idx on public.cjx_dishes (updated_at);

-- ========== 2. 行级权限 ==========
alter table public.cjx_rooms enable row level security;
alter table public.cjx_dishes enable row level security;
alter table public.cjx_customers enable row level security;
alter table public.cjx_orders enable row level security;
alter table public.cjx_rsvps enable row level security;
alter table public.cjx_settings enable row level security;

-- 店员账号（authenticated）：全部读写
drop policy if exists "cjx staff rooms" on public.cjx_rooms;
drop policy if exists "cjx staff dishes" on public.cjx_dishes;
drop policy if exists "cjx staff customers" on public.cjx_customers;
drop policy if exists "cjx staff orders" on public.cjx_orders;
drop policy if exists "cjx staff rsvps" on public.cjx_rsvps;
drop policy if exists "cjx staff settings" on public.cjx_settings;

create policy "cjx staff rooms" on public.cjx_rooms for all to authenticated using (true) with check (true);
create policy "cjx staff dishes" on public.cjx_dishes for all to authenticated using (true) with check (true);
create policy "cjx staff customers" on public.cjx_customers for all to authenticated using (true) with check (true);
create policy "cjx staff orders" on public.cjx_orders for all to authenticated using (true) with check (true);
create policy "cjx staff rsvps" on public.cjx_rsvps for all to authenticated using (true) with check (true);
create policy "cjx staff settings" on public.cjx_settings for all to authenticated using (true) with check (true);

-- 亲友回执：匿名只能新增，不能读取订单或其他回执
drop policy if exists "cjx rsvp anon insert" on public.cjx_rsvps;
create policy "cjx rsvp anon insert" on public.cjx_rsvps for insert to anon with check (true);

-- ========== 3. 权限 ==========
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.cjx_rooms to authenticated;
grant select, insert, update, delete on public.cjx_dishes to authenticated;
grant select, insert, update, delete on public.cjx_customers to authenticated;
grant select, insert, update, delete on public.cjx_orders to authenticated;
grant select, insert, update, delete on public.cjx_rsvps to authenticated;
grant insert on public.cjx_rsvps to anon;
grant select, insert, update, delete on public.cjx_settings to authenticated;

-- ========== 4. 客人只读视图（不含任何客人隐私） ==========
create or replace view public.cjx_public_menu as
select
  s.id as shop_id,
  coalesce(s.doc->>'shopName', '长季鲜') as shop_name,
  coalesce(s.doc->>'cuisine', '福安菜 × 厦门海鲜') as cuisine,
  '' as meal_focus,
  coalesce(s.doc->>'businessHours', '') as hours,
  coalesce(s.doc->>'phone', '') as phone,
  d.name,
  d.category,
  d.price,
  d.status,
  d.lead_days,
  d.note,
  d.flavor,
  d.updated_at
from public.cjx_settings s
left join public.cjx_dishes d on d.deleted = false
where s.id = 1;

create or replace view public.cjx_public_shop as
select
  s.id,
  coalesce(s.doc->>'shopName', '长季鲜') as shop_name,
  coalesce(s.doc->>'cuisine', '福安菜 × 厦门海鲜') as cuisine,
  '' as meal_focus,
  coalesce(s.doc->>'businessHours', '') as hours,
  coalesce(s.doc->>'phone', '') as phone,
  coalesce(s.doc->>'address', '') as address,
  s.updated_at
from public.cjx_settings s
where s.id = 1;

grant select on public.cjx_public_menu to anon, authenticated;
grant select on public.cjx_public_shop to anon, authenticated;

-- 让 PostgREST 立即认识新表/视图
notify pgrst, 'reload schema';

-- 完成。下一步：Authentication → Users → Add user，建一个邮箱+密码账号并 auto confirm。
