-- Grain: one row per rental contract (not one row per contract-day).
select
  r.contract_id,
  e.equipment_key,
  b.branch_key,
  cast(to_char(cast(r.start_date as date), 'YYYYMMDD') as integer) as start_date_key,
  cast(r.start_date as date) as start_date,
  r.rental_days,
  r.daily_rate,
  cast(r.rental_days as decimal(18,2)) * r.daily_rate as modeled_rental_revenue
from silver_rental_contracts r
left join dim_equipment e on r.equipment_id = e.equipment_id
left join dim_branch b on r.branch = b.branch_name;
