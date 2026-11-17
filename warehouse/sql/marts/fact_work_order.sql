-- Grain: one row per service work order.
select
  w.work_order_id,
  e.equipment_key,
  b.branch_key,
  cast(to_char(cast(w.opened_date as date), 'YYYYMMDD') as integer) as opened_date_key,
  cast(w.opened_date as date) as opened_date,
  w.status,
  w.priority,
  w.days_open,
  w.labor_revenue,
  w.parts_revenue,
  w.labor_revenue + w.parts_revenue as service_revenue,
  case when w.status = 'Closed' then 1 else 0 end as is_closed
from silver_work_orders w
left join dim_equipment e on w.equipment_id = e.equipment_id
left join dim_branch b on w.branch = b.branch_name;
