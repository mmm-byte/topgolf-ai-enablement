-- Adapt source relation names to your warehouse platform.
select
    cast(work_order_id as varchar(32)) as work_order_id,
    cast(equipment_id as varchar(32)) as equipment_id,
    trim(branch) as branch_name,
    trim(equipment_type) as equipment_type,
    trim(status) as work_order_status,
    cast(opened_date as date) as opened_date,
    cast(days_open as integer) as days_open,
    cast(labor_revenue as decimal(18,2)) as labor_revenue,
    cast(parts_revenue as decimal(18,2)) as parts_revenue
from bronze_work_orders
