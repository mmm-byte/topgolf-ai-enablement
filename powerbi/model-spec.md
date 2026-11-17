# FIELDIQ semantic model specification

## Purpose

A reusable, branch-aware semantic model design for synthetic heavy-equipment dealership workflows. Service work orders, parts orders, rental contracts, and fleet availability are modeled as separate business processes. This is an implemented CSV dimensional data set plus a semantic-model starter specification—not a published Power BI semantic model.

## Tables and grain

| Table | Type | Grain | Primary key |
|---|---|---|---|
| `dim_branch` | Dimension | One row per branch | `branch_key` |
| `dim_equipment` | Dimension | One row per equipment asset | `equipment_key` |
| `dim_date` | Dimension | One row per calendar date | `date_key` |
| `fact_work_order` | Fact | One row per service work order | `work_order_id` |
| `fact_parts_order` | Fact | One row per parts order | `parts_order_id` |
| `fact_rental_contract` | Fact | One row per rental contract | `contract_id` |
| `fact_fleet_day` | Fact | One row per equipment asset per calendar date | `equipment_key` + `date_key` |

## Relationships

- `dim_branch[branch_key]` 1 → * `fact_work_order[branch_key]`
- `dim_branch[branch_key]` 1 → * `fact_parts_order[branch_key]`
- `dim_branch[branch_key]` 1 → * `fact_rental_contract[branch_key]`
- `dim_branch[branch_key]` 1 → * `fact_fleet_day[branch_key]`
- `dim_equipment[equipment_key]` 1 → * `fact_work_order[equipment_key]`
- `dim_equipment[equipment_key]` 1 → * `fact_rental_contract[equipment_key]`
- `dim_equipment[equipment_key]` 1 → * `fact_fleet_day[equipment_key]`
- `dim_date[date_key]` 1 → * each fact's applicable date key

Use single-direction filtering from dimensions to facts. Do not create fact-to-fact relationships. Mark `dim_date[date]` as the date table and validate active/inactive date roles for each fact. A production model may use role-playing date dimensions for opened, order, contract-start, and daily fleet dates.

## Measure contracts

See `measures.dax`. Revenue measures are modeled synthetic amounts, not audited accounting values. Parts fill rate is total fulfilled units divided by total requested units; do not average row-level percentages. Average days to close excludes open work orders.

## Fleet utilization definition

`fact_fleet_day` is unique at equipment × calendar date. An asset-day is marked rented if at least one rental contract overlaps that date, so overlapping contracts do not double-count utilization. The current denominator assumes every asset-day is available. Maintenance downtime, repair status, transportation, and other out-of-service reasons are not modeled. Treat the KPI as a demonstration measure, not an operational fleet-availability metric.

## Security and deployment

`rls-pattern.md` documents a branch-level design pattern. No identity provider, RLS role, OLS rule, Power BI workspace, Fabric Lakehouse, or deployment pipeline is provisioned by this repository.
