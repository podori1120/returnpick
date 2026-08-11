begin;

insert into sourced_products (
  source,
  source_product_id,
  category,
  title,
  source_url,
  image_url,
  affiliate_url,
  source_price,
  naver_lowest_price,
  condition_grade,
  stock_count,
  sourcing_status,
  is_published,
  raw_json
)
select
  'schema_verifier',
  'keyset-' || n,
  'laptop',
  'Keyset smoke ' || n,
  'https://www.coupang.com/vp/products/' || (100000000 + n),
  'https://images.example.com/returnpick/keyset-' || n || '.png',
  'https://link.coupang.com/a/KeysetA' || lpad(n::text, 3, '0'),
  100000 + n,
  200000,
  '상',
  1,
  'published',
  true,
  case
    when n = 127 then jsonb_build_object(
      'affiliate_verification', jsonb_build_object(
        'affiliate_url', 'https://link.coupang.com/a/KeysetA' || lpad(n::text, 3, '0'),
        'expected_product_id', (100000000 + n)::text,
        'expected_id_source', 'source_url',
        'resolution_code', 'MANUAL_SMOKE',
        'checked_at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'status', 'MANUAL_CONFIRMED',
        'method', 'manual',
        'resolved_product_id', (100000000 + n)::text
      )
    )
    else '{}'::jsonb
  end
from generate_series(1, 127) as n;

insert into deal_scores (
  product_id,
  total_score,
  price_score,
  condition_score,
  spec_score,
  category_risk_score,
  hidden_cost_score,
  as_score,
  timing_score,
  verdict
)
select
  id,
  1000 - row_number() over (order by source_product_id),
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  '추천'
from sourced_products
where source_product_id like 'keyset-%';

insert into distribution_deliveries (
  product_id,
  channel,
  status,
  delivery_mode,
  request_key,
  last_error,
  attempt_count
)
select
  id,
  'blogger',
  'failed',
  'draft',
  'keyset-failed-prewrite-1',
  'GOOGLE_OAUTH_HTTP_503',
  1
from sourced_products
where source_product_id = 'keyset-1';

insert into distribution_deliveries (
  product_id,
  channel,
  status,
  delivery_mode,
  request_key,
  last_error,
  attempt_count
)
select
  id,
  'blogger',
  'ambiguous',
  'publish',
  'keyset-ambiguous-1',
  'BLOGGER_REQUEST_TIMEOUT_12000MS',
  1
from sourced_products
where source_product_id = 'keyset-2';

do $$
declare
  first_page_count integer;
  second_page_count integer;
  cursor_score integer;
  cursor_created_at timestamptz;
  cursor_id uuid;
  applied_version text;
  failed_candidate_visible boolean;
  ambiguous_candidate_visible boolean;
  retry_attempt_count integer;
begin
  select count(*)
  into first_page_count
  from list_distribution_candidate_ids('blogger', 100, null, null, null);

  select candidate_score, candidate_created_at, product_id
  into cursor_score, cursor_created_at, cursor_id
  from list_distribution_candidate_ids('blogger', 100, null, null, null)
  order by candidate_score asc, candidate_created_at asc, product_id desc
  limit 1;

  select count(*)
  into second_page_count
  from list_distribution_candidate_ids('blogger', 100, cursor_score, cursor_created_at, cursor_id);

  select value
  into applied_version
  from returnpick_schema_meta
  where key = 'schema_version';

  select exists (
    select 1
    from list_distribution_candidate_ids('blogger', 100, null, null, null) as candidate
    join sourced_products as product on product.id = candidate.product_id
    where product.source_product_id = 'keyset-1'
  )
  into failed_candidate_visible;

  select exists (
    select 1
    from list_distribution_candidate_ids('blogger', 100, null, null, null) as candidate
    join sourced_products as product on product.id = candidate.product_id
    where product.source_product_id = 'keyset-2'
  )
  into ambiguous_candidate_visible;

  if first_page_count <> 100 or second_page_count <> 26 then
    raise exception 'keyset page counts mismatch: first %, second %', first_page_count, second_page_count;
  end if;
  if not failed_candidate_visible then
    raise exception 'definite prewrite failure was hidden from retry queue';
  end if;
  if ambiguous_candidate_visible then
    raise exception 'ambiguous delivery was exposed to automatic retry queue';
  end if;

  update distribution_deliveries
  set
    status = 'pending',
    request_key = 'keyset-failed-prewrite-2',
    last_error = null,
    attempt_count = attempt_count + 1
  where channel = 'blogger'
    and product_id = (select id from sourced_products where source_product_id = 'keyset-1')
    and status = 'failed'
    and delivery_mode = 'draft'
    and request_key = 'keyset-failed-prewrite-1'
  returning attempt_count into retry_attempt_count;

  if retry_attempt_count <> 2 then
    raise exception 'failed prewrite claim was not reclaimed with attempt 2: %', retry_attempt_count;
  end if;
  if exists (
    select 1
    from list_distribution_candidate_ids('blogger', 100, null, null, null) as candidate
    join sourced_products as product on product.id = candidate.product_id
    where product.source_product_id = 'keyset-1'
  ) then
    raise exception 'reclaimed pending delivery remained in automatic queue';
  end if;
  if not has_function_privilege(
    'service_role',
    'list_distribution_candidate_ids(text,integer,integer,timestamptz,uuid)',
    'execute'
  ) then
    raise exception 'service_role cannot execute keyset candidate RPC';
  end if;
  if has_function_privilege(
    'anon',
    'list_distribution_candidate_ids(text,integer,integer,timestamptz,uuid)',
    'execute'
  ) then
    raise exception 'anon can execute private keyset candidate RPC';
  end if;
  if has_function_privilege(
    'authenticated',
    'list_distribution_candidate_ids(text,integer,integer,timestamptz,uuid)',
    'execute'
  ) then
    raise exception 'authenticated can execute private keyset candidate RPC';
  end if;
  if applied_version <> '2026-08-11-hotdeals-identity-v1' then
    raise exception 'schema version mismatch: %', applied_version;
  end if;
end;
$$;

select
  100 as first_page_count,
  26 as second_page_count,
  has_function_privilege(
    'service_role',
    'list_distribution_candidate_ids(text,integer,integer,timestamptz,uuid)',
    'execute'
  ) as service_execute,
  has_function_privilege(
    'anon',
    'list_distribution_candidate_ids(text,integer,integer,timestamptz,uuid)',
    'execute'
  ) as anon_execute,
  has_function_privilege(
    'authenticated',
    'list_distribution_candidate_ids(text,integer,integer,timestamptz,uuid)',
    'execute'
  ) as authenticated_execute,
  (select value from returnpick_schema_meta where key = 'schema_version') as schema_version;

rollback;
