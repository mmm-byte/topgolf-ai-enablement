import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("fieldiq_pipeline", ROOT / "scripts" / "build_pipeline.py")
pipeline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pipeline)


def test_source_ids_are_unique_and_counts_are_stable():
    source = pipeline.generate_sources()
    assert len(source["work_orders"]) == 480
    assert len({row["work_order_id"] for row in source["work_orders"]}) == 480
    assert len({row["equipment_id"] for row in source["equipment"]}) == 90


def test_open_work_orders_have_no_recognized_revenue():
    for row in pipeline.generate_sources()["work_orders"]:
        if row["status"] != "Closed":
            assert row["labor_revenue"] == 0
            assert row["parts_revenue"] == 0


def test_rental_contracts_resolve_to_equipment_branch():
    source = pipeline.generate_sources()
    equipment = {row["equipment_id"]: row for row in source["equipment"]}
    for contract in source["rental_contracts"]:
        assert contract["branch"] == equipment[contract["equipment_id"]]["branch"]


def test_parts_quantities_are_valid():
    for row in pipeline.generate_sources()["parts_orders"]:
        assert row["qty_requested"] > 0
        assert 0 <= row["qty_fulfilled"] <= row["qty_requested"]


def test_pipeline_builds_executable_quality_results():
    snapshot = pipeline.run()
    assert len(snapshot["quality"]) == 10
    assert all(check["status"] == "PASS" for check in snapshot["quality"])
    assert len(snapshot["work_orders"]) == 480
    assert len(snapshot["parts_orders"]) == 320
    assert len(snapshot["rental_contracts"]) == 250
    assert snapshot["metadata"]["layers"]["gold"] == 7


def test_gold_dimensions_and_facts_have_conformed_keys():
    pipeline.run()
    import pandas as pd
    gold = ROOT / "data" / "gold"
    branches = pd.read_csv(gold / "dim_branch.csv")
    equipment = pd.read_csv(gold / "dim_equipment.csv")
    dates = pd.read_csv(gold / "dim_date.csv")
    work = pd.read_csv(gold / "fact_work_order.csv")
    parts = pd.read_csv(gold / "fact_parts_order.csv")
    rentals = pd.read_csv(gold / "fact_rental_contract.csv")
    fleet = pd.read_csv(gold / "fact_fleet_day.csv")
    assert branches.branch_key.is_unique
    assert equipment.equipment_key.is_unique
    assert dates.date_key.is_unique
    assert work.branch_key.notna().all() and work.equipment_key.notna().all()
    assert parts.branch_key.notna().all()
    assert rentals.branch_key.notna().all() and rentals.equipment_key.notna().all()
    assert not fleet.duplicated(["equipment_key", "date_key"]).any()
    assert fleet.is_rented.sum() <= fleet.is_available.sum()
    assert len(fleet) == len(equipment) * len(dates)
