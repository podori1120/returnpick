create extension if not exists pgcrypto;

create table if not exists sourcing_keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  category text not null check (category in ('laptop', 'monitor', 'robot_vacuum', 'cordless_vacuum', 'air_purifier', 'dehumidifier')),
  is_active boolean default true,
  min_price integer,
  max_price integer,
  min_discount_rate numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists sourced_products (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_product_id text,
  category text not null check (category in ('laptop', 'monitor', 'robot_vacuum', 'cordless_vacuum', 'air_purifier', 'dehumidifier')),
  keyword text,
  title text not null,
  brand text,
  model_name text,
  image_url text,
  source_url text,
  coupang_url text,
  affiliate_url text,
  source_price integer,
  return_price integer,
  new_price integer,
  naver_lowest_price integer,
  condition_grade text default '확인필요' check (condition_grade in ('미개봉', '최상', '상', '중', '알수없음', '확인필요')),
  stock_count integer,
  spec_json jsonb default '{}',
  raw_json jsonb default '{}',
  sourcing_status text default 'candidate' check (sourcing_status in ('candidate', 'needs_review', 'approved', 'published', 'rejected', 'sold_out', 'error')),
  is_published boolean default false,
  is_rejected boolean default false,
  rejection_reason text,
  admin_memo text,
  public_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists deal_scores (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references sourced_products(id) on delete cascade,
  total_score integer not null,
  price_score integer not null,
  condition_score integer not null,
  spec_score integer not null,
  category_risk_score integer not null,
  hidden_cost_score integer not null,
  as_score integer not null,
  timing_score integer not null,
  verdict text not null,
  reasons jsonb default '[]',
  risk_flags jsonb default '[]',
  score_detail jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists sourcing_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null,
  started_at timestamptz default now(),
  finished_at timestamptz,
  keyword_count integer default 0,
  found_count integer default 0,
  inserted_count integer default 0,
  updated_count integer default 0,
  error_count integer default 0,
  error_message text,
  log_json jsonb default '{}'
);

create table if not exists telegram_logs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references sourced_products(id) on delete set null,
  message text,
  status text,
  error text,
  created_at timestamptz default now()
);

create table if not exists affiliate_events (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references sourced_products(id) on delete set null,
  event_type text not null check (event_type in ('impression', 'detail_view', 'affiliate_click', 'telegram_detail_click')),
  channel text,
  anon_session_id text,
  referrer text,
  utm_source text,
  created_at timestamptz default now()
);

create table if not exists product_snapshots (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references sourced_products(id) on delete cascade,
  observed_at timestamptz default now(),
  source_price integer,
  return_price integer,
  new_price integer,
  naver_lowest_price integer,
  stock_count integer,
  condition_grade text not null default '확인필요',
  change_flags jsonb default '[]',
  raw_json jsonb default '{}'
);

create unique index if not exists sourced_products_source_product_key
  on sourced_products (source, source_product_id)
  where source_product_id is not null;

create unique index if not exists sourced_products_title_category_key
  on sourced_products (lower(title), category);

create index if not exists sourced_products_status_idx on sourced_products (sourcing_status);
create index if not exists sourced_products_published_idx on sourced_products (is_published, sourcing_status);
create index if not exists sourced_products_category_idx on sourced_products (category);
create index if not exists deal_scores_product_created_idx on deal_scores (product_id, created_at desc);
create index if not exists sourcing_keywords_active_idx on sourcing_keywords (is_active, category);
create index if not exists product_snapshots_product_observed_idx on product_snapshots (product_id, observed_at desc);
create index if not exists product_snapshots_change_flags_idx on product_snapshots using gin (change_flags);
create index if not exists affiliate_events_product_created_idx on affiliate_events (product_id, created_at desc);
create index if not exists affiliate_events_type_created_idx on affiliate_events (event_type, created_at desc);
create index if not exists affiliate_events_channel_created_idx on affiliate_events (channel, created_at desc);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists sourcing_keywords_updated_at on sourcing_keywords;
create trigger sourcing_keywords_updated_at
before update on sourcing_keywords
for each row execute function set_updated_at();

drop trigger if exists sourced_products_updated_at on sourced_products;
create trigger sourced_products_updated_at
before update on sourced_products
for each row execute function set_updated_at();

drop trigger if exists deal_scores_updated_at on deal_scores;
create trigger deal_scores_updated_at
before update on deal_scores
for each row execute function set_updated_at();

alter table sourcing_keywords enable row level security;
alter table sourced_products enable row level security;
alter table deal_scores enable row level security;
alter table sourcing_runs enable row level security;
alter table telegram_logs enable row level security;
alter table product_snapshots enable row level security;
alter table affiliate_events enable row level security;

drop policy if exists "Public can read published products" on sourced_products;
create policy "Public can read published products"
on sourced_products for select
using (is_published = true and sourcing_status = 'published');

drop policy if exists "Public can read scores for published products" on deal_scores;
create policy "Public can read scores for published products"
on deal_scores for select
using (
  exists (
    select 1 from sourced_products
    where sourced_products.id = deal_scores.product_id
      and sourced_products.is_published = true
      and sourced_products.sourcing_status = 'published'
  )
);

drop policy if exists "Public can read snapshots for published products" on product_snapshots;
create policy "Public can read snapshots for published products"
on product_snapshots for select
using (
  exists (
    select 1 from sourced_products
    where sourced_products.id = product_snapshots.product_id
      and sourced_products.is_published = true
      and sourced_products.sourcing_status = 'published'
  )
);
