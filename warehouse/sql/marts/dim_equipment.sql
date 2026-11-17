-- Grain: one row per equipment asset.
select
  row_number() over (order by equipment_id) as equipment_key,
  equipment_id,
  branch as branch_name,
  equipment_type,
  model,
  year as model_year
from silver_equipment;
