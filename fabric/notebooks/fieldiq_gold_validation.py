# Fabric notebook starter — not executed in this repository.
# Import into a Microsoft Fabric notebook after the named Lakehouse tables exist.

# %% [markdown]
# # FIELDIQ Gold data validation
#
# Purpose: demonstrate how Gold model contracts can be checked with PySpark in a
# Fabric Lakehouse notebook. Update the table names for the target Lakehouse.
# These cells have not been run against a Fabric workspace.

# %%
from pyspark.sql import functions as F

work = spark.table("fact_work_order")
parts = spark.table("fact_parts_order")
rentals = spark.table("fact_rental_contract")
fleet = spark.table("fact_fleet_day")
equipment = spark.table("dim_equipment")
dates = spark.table("dim_date")

# %% [markdown]
# ## Key and grain assertions

# %%
checks = {
    "work_order_key_unique": work.groupBy("work_order_id").count().filter(F.col("count") > 1).count() == 0,
    "parts_order_key_unique": parts.groupBy("parts_order_id").count().filter(F.col("count") > 1).count() == 0,
    "rental_contract_key_unique": rentals.groupBy("contract_id").count().filter(F.col("count") > 1).count() == 0,
    "fleet_asset_day_grain_unique": fleet.groupBy("equipment_key", "date_key").count().filter(F.col("count") > 1).count() == 0,
    "fleet_utilization_bounds": fleet.filter((F.col("is_rented") < 0) | (F.col("is_rented") > F.col("is_available"))).count() == 0,
    "parts_quantity_bounds": parts.filter((F.col("qty_requested") <= 0) | (F.col("qty_fulfilled") < 0) | (F.col("qty_fulfilled") > F.col("qty_requested"))).count() == 0,
    "open_work_orders_no_revenue": work.filter((F.col("status") != "Closed") & (F.col("service_revenue") != 0)).count() == 0,
}

# %% [markdown]
# ## Referential integrity and reconciliation

# %%
missing_equipment = fleet.join(equipment.select("equipment_key"), "equipment_key", "left_anti").count()
missing_dates = fleet.join(dates.select("date_key"), "date_key", "left_anti").count()
silver_revenue = work.filter(F.col("status") == "Closed").agg(F.sum("labor_revenue") + F.sum("parts_revenue")).first()[0]
gold_revenue = work.filter(F.col("status") == "Closed").agg(F.sum("service_revenue")).first()[0]
checks["fleet_equipment_fk"] = missing_equipment == 0
checks["fleet_date_fk"] = missing_dates == 0
checks["service_revenue_reconciles"] = round(float(silver_revenue or 0), 2) == round(float(gold_revenue or 0), 2)

# %%
results = [(name, "PASS" if passed else "FAIL") for name, passed in checks.items()]
result_df = spark.createDataFrame(results, ["check_name", "status"])
display(result_df.orderBy("status", "check_name"))

failed = [name for name, passed in checks.items() if not passed]
if failed:
    raise AssertionError("FIELDIQ Gold validation failed: " + ", ".join(failed))
print(f"All {len(checks)} starter checks passed. Validate table mappings and business rules before production use.")
