-- PostgreSQL-style SQL starter.
-- Grain: one row per equipment asset per calendar date.
-- A rental counts once per asset-day even when overlapping contracts exist.
with rental_asset_days as (
    select
        r.equipment_id,
        d.date_key,
        count(*) as rental_contract_count
    from silver_rental_contracts r
    join dim_date d
      on d.date >= cast(r.start_date as date)
     and d.date < cast(r.start_date as date) + (r.rental_days * interval '1 day')
    group by r.equipment_id, d.date_key
)
select
    e.equipment_key,
    b.branch_key,
    d.date_key,
    1 as is_available, -- Assumption: maintenance / out-of-service time is not modeled.
    case when coalesce(rad.rental_contract_count, 0) > 0 then 1 else 0 end as is_rented,
    coalesce(rad.rental_contract_count, 0) as rental_contract_count
from dim_equipment e
join dim_branch b on e.branch_name = b.branch_name
cross join dim_date d
left join rental_asset_days rad
  on rad.equipment_id = e.equipment_id
 and rad.date_key = d.date_key;
