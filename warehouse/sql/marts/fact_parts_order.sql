-- Grain: one row per parts order. Fill rate is weighted by units at aggregate level.
select
  p.parts_order_id,
  b.branch_key,
  cast(to_char(cast(p.order_date as date), 'YYYYMMDD') as integer) as order_date_key,
  cast(p.order_date as date) as order_date,
  p.qty_requested,
  p.qty_fulfilled,
  case when p.qty_requested = 0 then null
       else cast(p.qty_fulfilled as decimal(18,4)) / p.qty_requested end as fill_rate
from silver_parts_orders p
left join dim_branch b on p.branch = b.branch_name;
