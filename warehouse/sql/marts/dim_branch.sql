-- Grain: one row per branch. Stable key ordering for this deterministic demo.
select
  row_number() over (order by branch) as branch_key,
  branch as branch_name,
  region
from silver_branches;
