create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default '',
  role text not null default 'EDITOR' check (role in ('OWNER', 'ADMIN', 'EDITOR')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 80),
  slug text not null unique,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 180),
  slug text not null unique,
  description text not null default '' check (char_length(description) <= 5000),
  image_url text,
  original_price numeric(10,2) check (original_price is null or original_price > 0),
  current_price numeric(10,2) not null check (current_price > 0),
  affiliate_url text not null check (affiliate_url ~ '^https://(([A-Za-z0-9-]+[.])*shopee[.]com[.]br|shopee[.]ee)(/|$)'),
  category_id uuid not null references public.categories(id) on delete restrict,
  is_featured boolean not null default false,
  is_active boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_product_prices check (original_price is null or original_price > current_price)
);

create table public.click_events (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  clicked_at timestamptz not null default now(),
  campaign_id uuid references public.campaigns(id) on delete set null
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index products_active_category_idx on public.products (category_id, current_price) where is_active;
create index products_featured_idx on public.products (created_at desc) where is_active and is_featured;
create index products_updated_idx on public.products (updated_at desc);
create index click_events_product_date_idx on public.click_events (product_id, clicked_at desc);
create index click_events_date_idx on public.click_events (clicked_at desc);
create index click_events_campaign_idx on public.click_events (campaign_id, clicked_at desc);
create index audit_logs_entity_date_idx on public.audit_logs (entity_type, entity_id, created_at desc);

create or replace function public.has_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = any(allowed_roles)
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'display_name', ''), 'EDITOR')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger categories_updated_at before update on public.categories for each row execute procedure public.set_updated_at();
create trigger campaigns_updated_at before update on public.campaigns for each row execute procedure public.set_updated_at();
create trigger products_updated_at before update on public.products for each row execute procedure public.set_updated_at();

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_data jsonb;
  new_data jsonb;
  row_id text;
begin
  if tg_op <> 'INSERT' then old_data := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then new_data := to_jsonb(new); end if;
  row_id := coalesce(new_data ->> 'id', old_data ->> 'id');
  insert into public.audit_logs (actor_id, entity_type, entity_id, action, changes)
  values ((select auth.uid()), tg_table_name, row_id, lower(tg_op), jsonb_build_object('old', old_data, 'new', new_data));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger products_audit after insert or update or delete on public.products for each row execute procedure public.write_audit_log();
create trigger categories_audit after insert or update or delete on public.categories for each row execute procedure public.write_audit_log();
create trigger campaigns_audit after insert or update or delete on public.campaigns for each row execute procedure public.write_audit_log();
create trigger profiles_audit after insert or update or delete on public.profiles for each row execute procedure public.write_audit_log();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.campaigns enable row level security;
alter table public.click_events enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles self or owner read" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.has_role(array['OWNER']));
create policy "owner manages profiles" on public.profiles for all to authenticated
  using (public.has_role(array['OWNER'])) with check (public.has_role(array['OWNER']));

create policy "active categories public read" on public.categories for select to anon, authenticated
  using (is_active or public.has_role(array['OWNER', 'ADMIN', 'EDITOR']));
create policy "admins manage categories" on public.categories for insert to authenticated
  with check (public.has_role(array['OWNER', 'ADMIN']));
create policy "admins update categories" on public.categories for update to authenticated
  using (public.has_role(array['OWNER', 'ADMIN'])) with check (public.has_role(array['OWNER', 'ADMIN']));
create policy "admins delete categories" on public.categories for delete to authenticated
  using (public.has_role(array['OWNER', 'ADMIN']));

create policy "active products public read" on public.products for select to anon, authenticated
  using (
    (is_active and exists (select 1 from public.categories c where c.id = category_id and c.is_active))
    or public.has_role(array['OWNER', 'ADMIN', 'EDITOR'])
  );
create policy "staff creates products" on public.products for insert to authenticated
  with check (public.has_role(array['OWNER', 'ADMIN', 'EDITOR']) and (created_by is null or created_by = (select auth.uid())));
create policy "staff updates products" on public.products for update to authenticated
  using (public.has_role(array['OWNER', 'ADMIN', 'EDITOR'])) with check (public.has_role(array['OWNER', 'ADMIN', 'EDITOR']));
create policy "admin deletes products" on public.products for delete to authenticated
  using (public.has_role(array['OWNER', 'ADMIN']));

create policy "active campaigns public read" on public.campaigns for select to anon, authenticated
  using (is_active or public.has_role(array['OWNER', 'ADMIN']));
create policy "admins manage campaigns" on public.campaigns for all to authenticated
  using (public.has_role(array['OWNER', 'ADMIN'])) with check (public.has_role(array['OWNER', 'ADMIN']));

create policy "public records click on active product" on public.click_events for insert to anon, authenticated
  with check (
    exists (select 1 from public.products p where p.id = product_id and p.is_active)
    and (campaign_id is null or exists (select 1 from public.campaigns c where c.id = campaign_id and c.is_active))
  );
create policy "admins read click metrics" on public.click_events for select to authenticated
  using (public.has_role(array['OWNER', 'ADMIN']));

create policy "admins read audit log" on public.audit_logs for select to authenticated
  using (public.has_role(array['OWNER', 'ADMIN']));

grant usage on schema public to anon, authenticated;
grant select on public.categories, public.products, public.campaigns to anon, authenticated;
grant insert, update, delete on public.profiles, public.categories, public.products, public.campaigns to authenticated;
grant select, insert on public.click_events to anon, authenticated;
grant select on public.audit_logs to authenticated;
grant execute on function public.has_role(text[]) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;

create policy "product images public read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'product-images');
create policy "staff uploads product images" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.has_role(array['OWNER', 'ADMIN', 'EDITOR']));
create policy "staff updates product images" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.has_role(array['OWNER', 'ADMIN', 'EDITOR']))
  with check (bucket_id = 'product-images' and public.has_role(array['OWNER', 'ADMIN', 'EDITOR']));
create policy "admins delete product images" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.has_role(array['OWNER', 'ADMIN']));