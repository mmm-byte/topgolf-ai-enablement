# Microsoft Fabric implementation starter

This folder is a **design / code starter**, not an executed Fabric deployment. No Fabric workspace, Lakehouse, capacity, identity, or deployment pipeline is provisioned by this repository.

## Suggested Lakehouse layout

- `Files/bronze/`: source-shaped extracts from ERP / service / rental / parts systems.
- `Tables/silver_*`: standardized, typed, validated entities.
- `Tables/dim_branch`, `dim_equipment`, `dim_date`: conformed dimensions.
- `Tables/fact_work_order`, `fact_parts_order`, `fact_rental_contract`, `fact_fleet_day`: Gold facts.

## Notebook starter

`notebooks/fieldiq_gold_validation.py` uses Fabric notebook cell markers and PySpark. Import it into a Fabric notebook after the Silver / Gold Lakehouse tables exist, update table names if your Lakehouse uses a schema prefix, and execute it in a development workspace. It intentionally fails fast on failed assertions.

## Promotion path

1. Develop source mapping and transformations in a development workspace.
2. Validate row counts, keys, referential integrity, metric reconciliation, and model grain.
3. Publish / update the semantic model and test DAX measures in Power BI.
4. Configure RLS / OLS and test with representative identities.
5. Promote approved artifacts to test and production using the organization's Fabric deployment process.

Do not describe this starter as a deployed or tested Microsoft Fabric solution.
