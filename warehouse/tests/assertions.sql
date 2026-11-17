-- PostgreSQL-style validation examples. Each query should return zero rows.

-- 1. Duplicate business keys in Silver work orders.
select work_order_id
from silver_work_orders
group by work_order_id
having count(*) > 1;

-- 2. Invalid work-order status values.
select * from silver_work_orders
where status not in ('Open', 'In Progress', 'Closed');

-- 3. Negative service revenue components.
select * from silver_work_orders
where labor_revenue < 0 or parts_revenue < 0;

-- 4. Parts fulfillment outside the valid range.
select * from silver_parts_orders
where qty_requested <= 0 or qty_fulfilled < 0 or qty_fulfilled > qty_requested;

-- 5. Orphan equipment references in work orders.
select w.* from silver_work_orders w
left join silver_equipment e on w.equipment_id = e.equipment_id
where e.equipment_id is null;

-- 6. Open / in-progress work orders must not carry recognized revenue.
select * from fact_work_order
where status <> 'Closed' and service_revenue <> 0;

-- 7. All fact branch keys must resolve.
select 'fact_work_order' as model, count(*) as orphan_rows
from fact_work_order where branch_key is null
group by 'fact_work_order'
union all
select 'fact_parts_order', count(*)
from fact_parts_order where branch_key is null
group by 'fact_parts_order'
union all
select 'fact_rental_contract', count(*)
from fact_rental_contract where branch_key is null
group by 'fact_rental_contract'
union all
select 'fact_fleet_day', count(*)
from fact_fleet_day where branch_key is null
group by 'fact_fleet_day';

-- 8. Fleet-day grain must be unique.
select equipment_key, date_key
from fact_fleet_day
group by equipment_key, date_key
having count(*) > 1;

-- 9. Fleet utilization numerator cannot exceed modeled available days.
select * from fact_fleet_day
where is_rented not in (0, 1) or is_available not in (0, 1) or is_rented > is_available;

-- 10. Every Gold date / equipment key must resolve to a dimension.
select f.* from fact_fleet_day f
left join dim_equipment e on f.equipment_key = e.equipment_key
left join dim_date d on f.date_key = d.date_key
where e.equipment_key is null or d.date_key is null;
