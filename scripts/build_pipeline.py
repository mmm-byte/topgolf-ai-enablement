"""Deterministic synthetic source generator and Bronze/Silver/Gold BI pipeline.

FIELDIQ is an independent portfolio demonstration. All records are synthetic.
"""
from __future__ import annotations

import json
import random
import shutil
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
BRONZE, SILVER, GOLD = DATA / "bronze", DATA / "silver", DATA / "gold"
SEED = 58
BRANCHES = ["San Antonio", "Austin", "Dallas", "Fort Worth", "Waco"]
EQUIPMENT_TYPES = ["Excavator", "Wheel Loader", "Dozer", "Motor Grader", "Generator"]
START_DATE = date(2025, 1, 1)
COVERAGE_DAYS = 321


def generate_sources():
    rng = random.Random(SEED)
    equipment = [
        {
            "equipment_id": f"EQ-{i:04d}",
            "branch": rng.choice(BRANCHES),
            "equipment_type": rng.choice(EQUIPMENT_TYPES),
            "model": rng.choice(["320 GC", "950 GC", "D6", "140", "XQ200"]),
            "year": rng.randint(2018, 2025),
        }
        for i in range(1, 91)
    ]
    work_orders = []
    for i in range(1, 481):
        opened = START_DATE + timedelta(days=rng.randint(0, COVERAGE_DAYS - 1))
        status = rng.choices(["Open", "In Progress", "Closed"], weights=[22, 18, 60])[0]
        asset = rng.choice(equipment)
        closed = status == "Closed"
        work_orders.append(
            {
                "work_order_id": f"WO-{i:05d}",
                "equipment_id": asset["equipment_id"],
                "branch": asset["branch"],
                "equipment_type": asset["equipment_type"],
                "status": status,
                "priority": rng.choice(["Critical", "High", "Normal", "Low"]),
                "opened_date": opened.isoformat(),
                "days_open": rng.randint(1, 24) if closed else rng.randint(1, 58),
                "labor_revenue": round(rng.uniform(450, 6800), 2) if closed else 0,
                "parts_revenue": round(rng.uniform(100, 4200), 2) if closed else 0,
            }
        )

    rentals = []
    for i in range(1, 251):
        asset = rng.choice(equipment)
        start_offset = rng.randint(0, COVERAGE_DAYS - 3)
        max_days = COVERAGE_DAYS - start_offset
        rentals.append(
            {
                "contract_id": f"RC-{i:05d}",
                "equipment_id": asset["equipment_id"],
                "branch": asset["branch"],
                "start_date": (START_DATE + timedelta(days=start_offset)).isoformat(),
                "rental_days": rng.randint(2, min(35, max_days)),
                "daily_rate": round(rng.uniform(180, 1150), 2),
            }
        )

    parts_orders = []
    for i in range(1, 321):
        requested = rng.randint(1, 25)
        parts_orders.append(
            {
                "parts_order_id": f"PO-{i:05d}",
                "branch": rng.choice(BRANCHES),
                "qty_requested": requested,
                "qty_fulfilled": rng.randint(max(0, requested - 5), requested),
                "order_date": (START_DATE + timedelta(days=rng.randint(0, COVERAGE_DAYS - 1))).isoformat(),
            }
        )

    return {
        "equipment": equipment,
        "work_orders": work_orders,
        "rental_contracts": rentals,
        "parts_orders": parts_orders,
        "branches": [{"branch": branch, "region": "Texas"} for branch in BRANCHES],
    }


def write_csv(frame: pd.DataFrame, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False)


def _records(frame: pd.DataFrame):
    safe = frame.copy()
    for column in safe.columns:
        if pd.api.types.is_datetime64_any_dtype(safe[column]):
            safe[column] = safe[column].dt.strftime("%Y-%m-%d")
    return safe.where(pd.notna(safe), None).to_dict(orient="records")


def run():
    for layer in (BRONZE, SILVER, GOLD):
        if layer.exists():
            shutil.rmtree(layer)
        layer.mkdir(parents=True)

    source = generate_sources()
    for name, records in source.items():
        write_csv(pd.DataFrame(records), BRONZE / f"{name}.csv")

    equipment = pd.DataFrame(source["equipment"])
    work = pd.DataFrame(source["work_orders"])
    rentals = pd.DataFrame(source["rental_contracts"])
    parts = pd.DataFrame(source["parts_orders"])
    branches = pd.DataFrame(source["branches"])

    work["opened_date"] = pd.to_datetime(work["opened_date"])
    rentals["start_date"] = pd.to_datetime(rentals["start_date"])
    parts["order_date"] = pd.to_datetime(parts["order_date"])
    for column in ("days_open", "labor_revenue", "parts_revenue"):
        work[column] = pd.to_numeric(work[column], errors="raise")
    for column in ("qty_requested", "qty_fulfilled"):
        parts[column] = pd.to_numeric(parts[column], errors="raise")

    work = work.merge(
        equipment[["equipment_id", "model", "year"]],
        on="equipment_id", how="left", validate="many_to_one"
    )
    if work["model"].isna().any():
        raise ValueError("Unknown equipment_id in work orders")

    for name, frame in (("work_orders", work), ("equipment", equipment),
                        ("rental_contracts", rentals), ("parts_orders", parts),
                        ("branches", branches)):
        write_csv(frame, SILVER / f"{name}.csv")

    branch_dim = branches.sort_values("branch").reset_index(drop=True).copy()
    branch_dim.insert(0, "branch_key", range(1, len(branch_dim) + 1))
    branch_dim = branch_dim.rename(columns={"branch": "branch_name"})
    equipment_dim = equipment.sort_values("equipment_id").reset_index(drop=True).copy()
    equipment_dim.insert(0, "equipment_key", range(1, len(equipment_dim) + 1))
    equipment_dim = equipment_dim.rename(columns={"branch": "branch_name", "year": "model_year"})

    coverage_start = pd.Timestamp(START_DATE)
    date_values = pd.date_range(coverage_start, periods=COVERAGE_DAYS, freq="D")
    date_dim = pd.DataFrame({
        "date_key": date_values.strftime("%Y%m%d").astype(int),
        "date": date_values,
        "year": date_values.year,
        "quarter": date_values.quarter,
        "month_number": date_values.month,
        "month_name": date_values.strftime("%B"),
        "month_short": date_values.strftime("%b"),
        "day_of_month": date_values.day,
        "day_of_week": date_values.day_name(),
    })
    branch_key = dict(zip(branch_dim.branch_name, branch_dim.branch_key))
    equipment_key = dict(zip(equipment_dim.equipment_id, equipment_dim.equipment_key))

    fact_work = work.copy()
    fact_work["branch_key"] = fact_work["branch"].map(branch_key)
    fact_work["equipment_key"] = fact_work["equipment_id"].map(equipment_key)
    fact_work["opened_date_key"] = fact_work["opened_date"].dt.strftime("%Y%m%d").astype(int)
    fact_work["service_revenue"] = fact_work["labor_revenue"] + fact_work["parts_revenue"]
    fact_work["is_closed"] = (fact_work["status"] == "Closed").astype(int)

    fact_rental = rentals.copy()
    fact_rental["equipment_key"] = fact_rental["equipment_id"].map(equipment_key)
    fact_rental["branch_key"] = fact_rental["branch"].map(branch_key)
    fact_rental["start_date_key"] = fact_rental["start_date"].dt.strftime("%Y%m%d").astype(int)
    fact_rental["modeled_rental_revenue"] = fact_rental["rental_days"] * fact_rental["daily_rate"]

    fact_parts = parts.copy()
    fact_parts["branch_key"] = fact_parts["branch"].map(branch_key)
    fact_parts["order_date_key"] = fact_parts["order_date"].dt.strftime("%Y%m%d").astype(int)
    fact_parts["fill_rate"] = fact_parts["qty_fulfilled"] / fact_parts["qty_requested"]

    # One row per asset per calendar day. A rental counts once even if overlapping
    # contracts exist for the same asset/day. Availability is assumed for this demo;
    # maintenance and out-of-service days are not modeled.
    rental_days_by_asset: dict[str, dict[pd.Timestamp, int]] = {}
    for contract in rentals.itertuples(index=False):
        first = pd.Timestamp(contract.start_date)
        last_exclusive = first + pd.Timedelta(days=int(contract.rental_days))
        active_dates = pd.date_range(first, last_exclusive - pd.Timedelta(days=1), freq="D")
        active = rental_days_by_asset.setdefault(contract.equipment_id, {})
        for day in active_dates:
            active[day] = active.get(day, 0) + 1

    fleet_rows = []
    for asset in equipment_dim.itertuples(index=False):
        active = rental_days_by_asset.get(asset.equipment_id, {})
        for day in date_values:
            count = active.get(day, 0)
            fleet_rows.append({
                "equipment_key": int(asset.equipment_key),
                "branch_key": int(branch_key[asset.branch_name]),
                "date_key": int(day.strftime("%Y%m%d")),
                "is_available": 1,
                "is_rented": int(count > 0),
                "rental_contract_count": int(count),
            })
    fact_fleet_day = pd.DataFrame(fleet_rows)

    gold_frames = [
        (branch_dim, "dim_branch.csv"),
        (equipment_dim, "dim_equipment.csv"),
        (date_dim, "dim_date.csv"),
        (fact_work, "fact_work_order.csv"),
        (fact_rental, "fact_rental_contract.csv"),
        (fact_parts, "fact_parts_order.csv"),
        (fact_fleet_day, "fact_fleet_day.csv"),
    ]
    for frame, filename in gold_frames:
        write_csv(frame, GOLD / filename)

    coverage_end = coverage_start + pd.Timedelta(days=COVERAGE_DAYS - 1)
    closed = fact_work[fact_work.status == "Closed"]
    all_service_revenue = float(closed.service_revenue.sum())
    total_requested = int(fact_parts.qty_requested.sum())
    total_fulfilled = int(fact_parts.qty_fulfilled.sum())
    total_rented_asset_days = int(fact_fleet_day.is_rented.sum())
    total_available_asset_days = int(fact_fleet_day.is_available.sum())
    all_kpis = {
        "service_revenue": round(all_service_revenue, 2),
        "open_backlog": int((fact_work.status != "Closed").sum()),
        "closed_work_orders": int((fact_work.status == "Closed").sum()),
        "avg_days_to_close": round(float(closed.days_open.mean()), 2),
        "fleet_utilization": round(100 * total_rented_asset_days / total_available_asset_days, 2),
        "parts_fill_rate": round(100 * total_fulfilled / total_requested, 2),
        "rental_revenue": round(float(fact_rental.modeled_rental_revenue.sum()), 2),
        "rented_asset_days": total_rented_asset_days,
        "available_asset_days": total_available_asset_days,
    }

    branch_rows = []
    for branch in BRANCHES:
        bw = fact_work[fact_work.branch == branch]
        br = fact_rental[fact_rental.branch == branch]
        bp = fact_parts[fact_parts.branch == branch]
        bf = fact_fleet_day[fact_fleet_day.branch_key == branch_key[branch]]
        bclosed = bw[bw.status == "Closed"]
        asset_count = int((equipment.branch == branch).sum())
        requested = int(bp.qty_requested.sum())
        fulfilled = int(bp.qty_fulfilled.sum())
        available_days = int(bf.is_available.sum())
        rented_days = int(bf.is_rented.sum())
        branch_rows.append({
            "branch": branch,
            "service_revenue": round(float(bclosed.service_revenue.sum()), 2),
            "open_backlog": int((bw.status != "Closed").sum()),
            "closed_work_orders": int((bw.status == "Closed").sum()),
            "avg_days_to_close": round(float(bclosed.days_open.mean()), 2) if len(bclosed) else 0,
            "fleet_utilization": round(100 * rented_days / available_days, 2) if available_days else 0,
            "parts_fill_rate": round(100 * fulfilled / requested, 2) if requested else 0,
            "parts_requested": requested,
            "parts_fulfilled": fulfilled,
            "rental_revenue": round(float(br.modeled_rental_revenue.sum()), 2),
            "rented_asset_days": rented_days,
            "available_asset_days": available_days,
            "equipment_count": asset_count,
        })

    monthly = fact_work.assign(month=fact_work.opened_date.dt.strftime("%b")).groupby("month").size()
    month_order = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    monthly_rows = [{"month": month, "work_orders": int(monthly.get(month, 0))} for month in month_order if month in set(monthly.index)]

    catalog = [
        {"name": "Service revenue", "formula": "SUM(service_revenue) WHERE status = 'Closed'", "description": "Modeled labor plus parts revenue recognized on closed service work orders.", "grain": "One work order", "owner": "Service operations", "caveat": "Synthetic modeled revenue; not audited accounting revenue."},
        {"name": "Open service backlog", "formula": "COUNT(work_order_id) WHERE status <> 'Closed'", "description": "Work orders not yet closed; a count, not a monetary backlog valuation.", "grain": "One work order", "owner": "Service operations", "caveat": "No SLA or aging threshold is implied."},
        {"name": "Average days to close", "formula": "AVG(days_open) WHERE status = 'Closed'", "description": "Average elapsed days recorded for closed work orders.", "grain": "One closed work order", "owner": "Service operations", "caveat": "Uses generated elapsed days; excludes open work orders."},
        {"name": "Fleet utilization", "formula": "SUM(is_rented) / SUM(is_available)", "description": "Unique rented equipment-days divided by modeled available equipment-days.", "grain": "One equipment per calendar day", "owner": "Rental operations", "caveat": "Availability is assumed for every asset-day; maintenance and out-of-service periods are not modeled."},
        {"name": "Parts fill rate", "formula": "SUM(qty_fulfilled) / SUM(qty_requested)", "description": "Weighted share of requested parts units fulfilled.", "grain": "One parts order", "owner": "Parts operations", "caveat": "Weighted by units; not an order-line on-time fill measure."},
        {"name": "Modeled rental revenue", "formula": "SUM(rental_days × daily_rate)", "description": "Synthetic contract revenue modeled from rental days and daily rate.", "grain": "One rental contract", "owner": "Rental operations", "caveat": "Not a ledger or invoice amount."},
    ]

    quality = []
    def check(name, passed, description, observed):
        quality.append({"name": name, "status": "PASS" if bool(passed) else "FAIL", "description": description, "observed": str(observed)})

    check("Work order key uniqueness", fact_work.work_order_id.notna().all() and fact_work.work_order_id.is_unique,
          "Every work_order_id is populated and unique.", f"{fact_work.work_order_id.nunique()} unique / {len(fact_work)} rows")
    check("Controlled work order status", fact_work.status.isin(["Open", "In Progress", "Closed"]).all(),
          "Only Open, In Progress, or Closed are accepted.", ", ".join(sorted(fact_work.status.unique())))
    check("Nonnegative service revenue", (fact_work[["labor_revenue", "parts_revenue"]] >= 0).all().all(),
          "Labor and parts revenue cannot be negative.", f"{int((fact_work[['labor_revenue','parts_revenue']] < 0).sum().sum())} negative values")
    open_revenue_exceptions = int((fact_work.loc[fact_work.status != "Closed", "service_revenue"] != 0).sum())
    check("Open orders carry no recognized revenue", open_revenue_exceptions == 0,
          "Open and in-progress work orders must not carry recognized service revenue.", f"{open_revenue_exceptions} exceptions")
    parts_exceptions = int(((fact_parts.qty_fulfilled < 0) | (fact_parts.qty_fulfilled > fact_parts.qty_requested) | (fact_parts.qty_requested <= 0)).sum())
    check("Parts quantity bounds", parts_exceptions == 0,
          "Fulfilled quantity must be between zero and requested quantity.", f"{parts_exceptions} exceptions")
    check("Equipment referential integrity", fact_work.equipment_key.notna().all() and fact_rental.equipment_key.notna().all(),
          "Every work order and rental contract resolves to a Gold equipment dimension row.", f"{fact_work.equipment_key.notna().sum() + fact_rental.equipment_key.notna().sum()} resolved references")
    check("Branch referential integrity", fact_work.branch_key.notna().all() and fact_parts.branch_key.notna().all() and fact_rental.branch_key.notna().all() and fact_fleet_day.branch_key.notna().all(),
          "All operational facts resolve to a conformed branch dimension.", "Work orders, parts orders, rental contracts, and fleet days")
    silver_revenue = float(work.loc[work.status == "Closed", ["labor_revenue", "parts_revenue"]].sum().sum())
    gold_revenue = float(closed.service_revenue.sum())
    check("Service revenue reconciliation", round(silver_revenue, 2) == round(gold_revenue, 2),
          "Closed-work-order revenue agrees between Silver source components and Gold measure input.", f"${gold_revenue:,.2f} reconciled")
    fleet_grain_unique = not fact_fleet_day.duplicated(["equipment_key", "date_key"]).any()
    check("Fleet-day grain uniqueness", fleet_grain_unique,
          "There is exactly one row per equipment asset and calendar date.", f"{len(fact_fleet_day):,} rows / {fact_fleet_day[['equipment_key','date_key']].drop_duplicates().shape[0]:,} unique grains")
    utilization = 100 * total_rented_asset_days / total_available_asset_days if total_available_asset_days else 0
    check("Fleet utilization bounds", total_rented_asset_days <= total_available_asset_days and 0 <= utilization <= 100,
          "Unique rented asset-days cannot exceed modeled available asset-days.", f"{total_rented_asset_days:,} / {total_available_asset_days:,} asset-days ({utilization:.2f}%)")

    snapshot = {
        "metadata": {
            "project": "FIELDIQ",
            "data_classification": "Synthetic demonstration data",
            "period_start": coverage_start.strftime("%Y-%m-%d"),
            "period_end": coverage_end.strftime("%Y-%m-%d"),
            "coverage_days": COVERAGE_DAYS,
            "refreshed_at": "Deterministic build · seed 58",
            "source_records": {"work_orders": len(work), "equipment": len(equipment), "rental_contracts": len(rentals), "parts_orders": len(parts)},
            "layers": {"bronze": 5, "silver": 5, "gold": 7},
            "gold_tables": ["dim_branch", "dim_equipment", "dim_date", "fact_work_order", "fact_parts_order", "fact_rental_contract", "fact_fleet_day"],
        },
        "branches": BRANCHES,
        "work_orders": _records(fact_work),
        "parts_orders": _records(fact_parts),
        "rental_contracts": _records(fact_rental),
        "equipment": _records(equipment_dim),
        "kpis": all_kpis,
        "branch_summary": branch_rows,
        "monthly": monthly_rows,
        "metric_catalog": catalog,
        "quality": quality,
    }
    (ROOT / "public" / "data").mkdir(parents=True, exist_ok=True)
    (ROOT / "public" / "data" / "operations.json").write_text(json.dumps(snapshot, indent=2, default=str))
    print(f"Built {len(work)} work orders, {len(equipment)} assets, {len(rentals)} rentals, {len(parts)} parts orders.")
    print(f"Gold service revenue: ${all_service_revenue:,.2f}; fleet utilization: {utilization:.2f}%")
    print(f"Quality checks: {sum(x['status']=='PASS' for x in quality)}/{len(quality)} PASS")
    return snapshot


if __name__ == "__main__":
    run()
