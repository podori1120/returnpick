create extension if not exists pgcrypto;

create table if not exists returnpick_schema_meta (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

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

alter table sourcing_keywords
  add column if not exists keyword_key text generated always as (lower(btrim(keyword))) stored;

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
  last_observed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table sourced_products
  add column if not exists last_observed_at timestamptz;

create or replace function is_strict_coupang_partners_url(value text)
returns boolean as $$
  select value is not null
    and value ~ '^https://link\.coupang\.com/a/[A-Za-z0-9]{6,16}([?#].*)?$'
    and value !~* '(test|sample|example|fake|dummy|dryrun|safecheck|nonexisting|readiness)'
    and lower(value) not like 'https://link.coupang.com/a/dpyguokdsm%';
$$ language sql immutable;

create or replace function distribution_coupang_product_id(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when btrim(coalesce(value, '')) ~* '^https://([a-z0-9-]+\.)*coupang\.com/vp/products/[0-9]+/?([?#].*)?$'
    then regexp_replace(btrim(value), '^https://[^/]+/vp/products/([0-9]+)/?([?#].*)?$', E'\\1', 1, 0, 'i')
    else null
  end;
$$;

create or replace function distribution_timestamptz(value text)
returns timestamptz
language plpgsql
immutable
set search_path = public
as $$
declare
  parsed timestamptz;
begin
  if value is null or value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,9})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
    return null;
  end if;

  begin
    parsed := value::timestamptz;
  exception when others then
    return null;
  end;

  return parsed;
end;
$$;

create or replace function is_distribution_timestamp(value text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select distribution_timestamptz(value) is not null;
$$;

create or replace function is_fresh_distribution_manual_review(source_value text, raw_value jsonb)
returns boolean
language sql
stable
set search_path = public
as $$
  select lower(btrim(coalesce(source_value, ''))) not in ('manual_admin', 'manual_affiliate_link')
    or (
      jsonb_typeof(coalesce(raw_value, '{}'::jsonb)->'manual_catalog_review') = 'object'
      and (coalesce(raw_value, '{}'::jsonb)->'manual_catalog_review'->>'status') = 'approved'
      and (coalesce(raw_value, '{}'::jsonb)->'manual_catalog_review'->>'method') = 'manual'
      and is_distribution_timestamp(coalesce(raw_value, '{}'::jsonb)->'manual_catalog_review'->>'reviewed_at')
      and distribution_timestamptz(coalesce(raw_value, '{}'::jsonb)->'manual_catalog_review'->>'reviewed_at') <= now()
      and distribution_timestamptz(coalesce(raw_value, '{}'::jsonb)->'manual_catalog_review'->>'reviewed_at') >= now() - interval '7 days'
    );
$$;

create or replace function is_distribution_affiliate_identity_verified(
  affiliate_value text,
  coupang_value text,
  source_value text,
  raw_value jsonb
)
returns boolean
language sql
stable
set search_path = public
as $$
  with ids as (
    select
      distribution_coupang_product_id(coupang_value) as coupang_id,
      distribution_coupang_product_id(source_value) as source_id
  ), expected as (
    select
      coalesce(coupang_id, source_id) as product_id,
      case when coupang_id is not null then 'coupang_url' else 'source_url' end as id_source
    from ids
  ), evidence as (
    select coalesce(raw_value, '{}'::jsonb)->'affiliate_verification' as evidence_json
  )
  select expected.product_id is not null
    and jsonb_typeof(evidence.evidence_json) = 'object'
    and evidence.evidence_json->>'affiliate_url' = btrim(coalesce(affiliate_value, ''))
    and evidence.evidence_json->>'expected_product_id' = expected.product_id
    and evidence.evidence_json->>'expected_id_source' = expected.id_source
    and evidence.evidence_json->>'resolution_code' is not null
    and btrim(evidence.evidence_json->>'resolution_code') <> ''
    and is_distribution_timestamp(evidence.evidence_json->>'checked_at')
    and (
      (
        evidence.evidence_json->>'status' = 'MATCH'
        and evidence.evidence_json->>'method' = 'automatic'
        and evidence.evidence_json->>'resolved_product_id' = expected.product_id
      )
      or (
        evidence.evidence_json->>'status' = 'MANUAL_CONFIRMED'
        and evidence.evidence_json->>'method' = 'manual'
        and (
          evidence.evidence_json->>'resolved_product_id' is null
          or evidence.evidence_json->>'resolved_product_id' = expected.product_id
        )
      )
    )
  from expected
  cross join evidence;
$$;

create or replace function is_usable_distribution_image_url(value text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select btrim(coalesce(value, '')) <> ''
    and length(btrim(value)) <= 2000
    and btrim(value) ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}([/?#].*)?$'
    and lower(btrim(value)) !~ '^https://([^/?#]+\.)*coupang\.com([/?#]|$)';
$$;

-- This SQL predicate is intentionally a conservative superset of the
-- TypeScript isPublicDealReady gate. The scheduler performs the authoritative
-- check while walking the complete score-ordered keyset, so future gate drift
-- cannot permanently hide a valid product.
create or replace function is_distribution_customer_ready(
  source_value text,
  source_product_id_value text,
  raw_value jsonb,
  published_value boolean,
  sourcing_status_value text,
  affiliate_value text,
  coupang_value text,
  source_url_value text,
  image_value text,
  return_price_value integer,
  source_price_value integer,
  new_price_value integer,
  naver_price_value integer,
  condition_value text,
  stock_value integer
)
returns boolean
language sql
stable
set search_path = public
as $$
  with payload as (
    select coalesce(raw_value, '{}'::jsonb) as raw
  ), prices as (
    select coalesce(return_price_value, source_price_value, new_price_value) as deal_price
  )
  select published_value is true
    and sourcing_status_value = 'published'
    and lower(btrim(coalesce(source_value, ''))) <> ''
    and lower(btrim(coalesce(source_value, ''))) not like '%mock%'
    and lower(btrim(coalesce(source_value, ''))) not like '%demo%'
    and lower(coalesce(payload.raw->>'provider', '')) not like '%mock%'
    and lower(coalesce(payload.raw->>'provider', '')) not like '%demo%'
    and (
      jsonb_typeof(payload.raw->'demo_seed') is distinct from 'boolean'
      or payload.raw->>'demo_seed' is distinct from 'true'
    )
    and coalesce(jsonb_typeof(payload.raw->'demo_seed'), 'null') <> 'string'
    and coalesce(source_product_id_value, '') not like 'seed-%'
    and coalesce(source_value, '') <> 'algumon_discovery'
    and btrim(coalesce(affiliate_value, '')) ~* '^https://link\.coupang\.com/a/[A-Za-z0-9]{6,16}([?#].*)?$'
    and btrim(coalesce(image_value, '')) <> ''
    and prices.deal_price is not null
    and prices.deal_price <> 0
    and stock_value is distinct from 0
  from payload
  cross join prices;
$$;

alter table sourced_products drop constraint if exists sourced_products_public_affiliate_url_check;
alter table sourced_products
  add constraint sourced_products_public_affiliate_url_check
  check (
    not (is_published is true and sourcing_status = 'published')
    or is_strict_coupang_partners_url(affiliate_url)
  ) not valid;

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
  target_type text,
  target_key text,
  message text,
  status text,
  error text,
  created_at timestamptz default now()
);

create table if not exists distribution_deliveries (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references sourced_products(id) on delete cascade,
  channel text not null,
  status text not null check (status in ('pending', 'succeeded', 'ambiguous', 'failed')),
  delivery_mode text not null,
  request_key text not null,
  provider_post_id text,
  provider_url text,
  last_error text,
  attempt_count integer not null default 1 check (attempt_count > 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (channel, product_id)
);

alter table distribution_deliveries
  add column if not exists delivery_mode text;

update distribution_deliveries
set delivery_mode = 'draft'
where delivery_mode is null;

alter table distribution_deliveries
  alter column delivery_mode set not null;

alter table distribution_deliveries drop constraint if exists distribution_deliveries_delivery_mode_check;
alter table distribution_deliveries
  add constraint distribution_deliveries_delivery_mode_check
  check (delivery_mode in ('draft', 'publish'));

alter table telegram_logs
  add column if not exists target_type text,
  add column if not exists target_key text;

create index if not exists distribution_deliveries_channel_status_idx on distribution_deliveries (channel, status, updated_at desc);
create index if not exists distribution_deliveries_product_idx on distribution_deliveries (product_id, updated_at desc);

-- Preserve successful Blogger deliveries created before the durable ledger existed.
-- The insert is idempotent and only uses the product id already stored in the audit log.
insert into distribution_deliveries (product_id, channel, status, delivery_mode, request_key, attempt_count, created_at, updated_at)
select
  product_id,
  'blogger',
  'succeeded',
  case when bool_or(status = 'published') then 'publish' else 'draft' end,
  'legacy:' || product_id::text,
  1,
  min(created_at),
  max(created_at)
from telegram_logs
where target_type = 'blogger'
  and product_id is not null
  and status in ('draft', 'published')
group by product_id
on conflict (channel, product_id) do nothing;

drop function if exists list_distribution_candidate_ids(text, integer, integer);

create or replace function list_distribution_candidate_ids(
  p_channel text,
  p_limit integer default 50,
  p_after_score integer default null,
  p_after_created_at timestamptz default null,
  p_after_id uuid default null
)
returns table(product_id uuid, candidate_score integer, candidate_created_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  with candidates as (
    select
      product.id as product_id,
      coalesce(latest_score.total_score, -2147483648)::integer as candidate_score,
      coalesce(product.created_at, 'epoch'::timestamptz) as candidate_created_at
    from sourced_products as product
    left join lateral (
      select score.total_score
      from deal_scores as score
      where score.product_id = product.id
      order by score.created_at desc, score.id desc
      limit 1
    ) as latest_score on true
    where is_distribution_customer_ready(
        product.source,
        product.source_product_id,
        product.raw_json,
        product.is_published,
        product.sourcing_status,
        product.affiliate_url,
        product.coupang_url,
        product.source_url,
        product.image_url,
        product.return_price,
        product.source_price,
        product.new_price,
        product.naver_lowest_price,
        product.condition_grade,
        product.stock_count
      )
      and not exists (
        select 1
        from distribution_deliveries as delivery
        where delivery.channel = p_channel
          and delivery.product_id = product.id
          and (
            delivery.status <> 'failed'
            or delivery.provider_post_id is not null
          )
      )
  )
  select candidate.product_id, candidate.candidate_score, candidate.candidate_created_at
  from candidates as candidate
  where (
      p_after_score is null
      and p_after_created_at is null
      and p_after_id is null
    )
    or (
      p_after_score is not null
      and p_after_created_at is not null
      and p_after_id is not null
      and (
        candidate.candidate_score < p_after_score
        or (
          candidate.candidate_score = p_after_score
          and candidate.candidate_created_at < p_after_created_at
        )
        or (
          candidate.candidate_score = p_after_score
          and candidate.candidate_created_at = p_after_created_at
          and candidate.product_id > p_after_id
        )
      )
    )
  order by candidate.candidate_score desc, candidate.candidate_created_at desc, candidate.product_id
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  ;
$$;

create table if not exists affiliate_events (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references sourced_products(id) on delete set null,
  event_type text not null check (event_type in ('impression', 'detail_view', 'affiliate_click', 'telegram_detail_click', 'share_copy')),
  channel text,
  context text,
  anon_session_id text,
  referrer text,
  utm_source text,
  created_at timestamptz default now()
);

alter table affiliate_events drop constraint if exists affiliate_events_event_type_check;
alter table affiliate_events
  add constraint affiliate_events_event_type_check
  check (event_type in ('impression', 'detail_view', 'affiliate_click', 'telegram_detail_click', 'share_copy'));

alter table affiliate_events
  add column if not exists context text;

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

drop index if exists sourced_products_title_category_key;
create unique index sourced_products_title_category_key
  on sourced_products (lower(title), category)
  where source not in ('algumon_discovery', 'hotdeals_discovery');

with ranked_sourcing_keywords as (
  select
    id,
    row_number() over (
      partition by lower(btrim(keyword)), category
      order by is_active desc, created_at asc, id asc
    ) as duplicate_rank
  from sourcing_keywords
)
delete from sourcing_keywords
using ranked_sourcing_keywords
where sourcing_keywords.id = ranked_sourcing_keywords.id
  and ranked_sourcing_keywords.duplicate_rank > 1;

create unique index if not exists sourcing_keywords_keyword_category_key
  on sourcing_keywords (keyword_key, category);

create index if not exists sourced_products_status_idx on sourced_products (sourcing_status);
create index if not exists sourced_products_published_idx on sourced_products (is_published, sourcing_status);
create index if not exists sourced_products_published_observed_idx
  on sourced_products (is_published, last_observed_at desc);
create index if not exists sourced_products_status_category_created_idx
  on sourced_products (sourcing_status, category, created_at desc);
create index if not exists sourced_products_published_status_created_idx
  on sourced_products (is_published, sourcing_status, created_at desc);
create index if not exists sourced_products_public_affiliate_ready_idx
  on sourced_products (category, created_at desc)
  where is_published is true
    and sourcing_status = 'published'
    and is_strict_coupang_partners_url(affiliate_url);
create index if not exists sourced_products_category_idx on sourced_products (category);
create index if not exists deal_scores_product_created_idx on deal_scores (product_id, created_at desc);
create index if not exists sourcing_keywords_active_idx on sourcing_keywords (is_active, category);
create index if not exists product_snapshots_product_observed_idx on product_snapshots (product_id, observed_at desc);
create index if not exists product_snapshots_change_flags_idx on product_snapshots using gin (change_flags);
create index if not exists sourcing_runs_started_idx on sourcing_runs (started_at desc);
create index if not exists sourcing_runs_status_started_idx on sourcing_runs (status, started_at desc);
create index if not exists telegram_logs_created_idx on telegram_logs (created_at desc);
create index if not exists telegram_logs_product_created_idx on telegram_logs (product_id, created_at desc);
create index if not exists telegram_logs_target_created_idx on telegram_logs (target_type, target_key, created_at desc);
create index if not exists affiliate_events_created_idx on affiliate_events (created_at desc);
create index if not exists affiliate_events_product_created_idx on affiliate_events (product_id, created_at desc);
create index if not exists affiliate_events_type_created_idx on affiliate_events (event_type, created_at desc);
create index if not exists affiliate_events_channel_created_idx on affiliate_events (channel, created_at desc);
create index if not exists affiliate_events_context_created_idx on affiliate_events (context, created_at desc);

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

drop trigger if exists distribution_deliveries_updated_at on distribution_deliveries;
create trigger distribution_deliveries_updated_at
before update on distribution_deliveries
for each row execute function set_updated_at();

alter table sourcing_keywords enable row level security;
alter table sourced_products enable row level security;
alter table deal_scores enable row level security;
alter table sourcing_runs enable row level security;
alter table telegram_logs enable row level security;
alter table product_snapshots enable row level security;
alter table affiliate_events enable row level security;
alter table distribution_deliveries enable row level security;
alter table returnpick_schema_meta enable row level security;

drop policy if exists "Public can read published products" on sourced_products;
create policy "Public can read published products"
on sourced_products for select
using (
  is_published = true
  and sourcing_status = 'published'
  and is_strict_coupang_partners_url(affiliate_url)
);

drop policy if exists "Public can read scores for published products" on deal_scores;
create policy "Public can read scores for published products"
on deal_scores for select
using (
  exists (
    select 1 from sourced_products
    where sourced_products.id = deal_scores.product_id
      and sourced_products.is_published = true
      and sourced_products.sourcing_status = 'published'
      and is_strict_coupang_partners_url(sourced_products.affiliate_url)
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
      and is_strict_coupang_partners_url(sourced_products.affiliate_url)
  )
);

-- Public API roles may read only customer-facing columns. Server routes use the
-- service role for sourcing and admin work, so internal provenance and notes stay private.
revoke all on table
  returnpick_schema_meta,
  sourcing_keywords,
  sourced_products,
  deal_scores,
  sourcing_runs,
  telegram_logs,
  distribution_deliveries,
  product_snapshots,
  affiliate_events
from anon, authenticated;

grant select (
  id,
  source,
  source_product_id,
  category,
  keyword,
  title,
  brand,
  model_name,
  image_url,
  source_url,
  coupang_url,
  affiliate_url,
  source_price,
  return_price,
  new_price,
  naver_lowest_price,
  condition_grade,
  stock_count,
  spec_json,
  sourcing_status,
  is_published,
  public_note,
  last_observed_at,
  created_at,
  updated_at
) on table sourced_products to anon, authenticated;

grant select (
  id,
  product_id,
  total_score,
  price_score,
  condition_score,
  spec_score,
  category_risk_score,
  hidden_cost_score,
  as_score,
  timing_score,
  verdict,
  reasons,
  risk_flags,
  score_detail,
  created_at,
  updated_at
) on table deal_scores to anon, authenticated;

grant select (
  id,
  product_id,
  observed_at,
  source_price,
  return_price,
  new_price,
  naver_lowest_price,
  stock_count,
  condition_grade,
  change_flags
) on table product_snapshots to anon, authenticated;

revoke all on function list_distribution_candidate_ids(text, integer, integer, timestamptz, uuid) from public, anon, authenticated;
grant execute on function list_distribution_candidate_ids(text, integer, integer, timestamptz, uuid) to service_role;

-- Record the version only after every table, migration, policy, grant, and
-- compatibility backfill above has completed successfully.
insert into returnpick_schema_meta (key, value, updated_at)
values ('schema_version', '2026-08-11-hotdeals-identity-v1', now())
on conflict (key)
do update set value = excluded.value, updated_at = now();
