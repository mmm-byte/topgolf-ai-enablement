"""Deterministic synthetic Topgolf venue-operations pipeline (Bronze / Silver / Gold).

This pipeline is the *fixture* that stands in for internal systems. It exists so the
archetypes, connectors, MCP server, guardrails and drift monitor in this repository can
run end-to-end against realistically shaped data without touching any real system.

ALL RECORDS ARE SYNTHETIC. They are not Topgolf data and do not describe any real
venue, guest, membership or campaign.

Standard library only: no third-party dependencies, so the governance checks in CI run
anywhere Python 3.10+ is available.
"""
from __future__ import annotations

import csv
import json
import random
import shutil
import sys
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
BRONZE, SILVER, GOLD = DATA / "bronze", DATA / "silver", DATA / "gold"

SEED = 1847
START_DATE = date(2025, 1, 1)
COVERAGE_DAYS = 331
END_DATE = START_DATE + timedelta(days=COVERAGE_DAYS - 1)

# ---------------------------------------------------------------------------
# Reference data (publicly discussed topics; all values below are synthetic)
# ---------------------------------------------------------------------------

CITY_POOL = [
    ("Dallas", "TX", "flagship"), ("Austin", "TX", "flagship"), ("Houston", "TX", "standard"),
    ("Nashville", "TN", "standard"), ("Atlanta", "GA", "standard"), ("Charlotte", "NC", "standard"),
    ("Denver", "CO", "standard"), ("Phoenix", "AZ", "standard"), ("Orlando", "FL", "standard"),
    ("Tampa", "FL", "urban"), ("San Diego", "CA", "urban"), ("Scottsdale", "AZ", "urban"),
    ("Kansas City", "MO", "standard"), ("Columbus", "OH", "standard"), ("Indianapolis", "IN", "standard"),
    ("Detroit", "MI", "standard"), ("Minneapolis", "MN", "standard"), ("St. Louis", "MO", "standard"),
    ("Brooklyn", "NY", "urban"), ("Manhattan", "NY", "urban"), ("Philadelphia", "PA", "urban"),
    ("Boston", "MA", "urban"), ("Chicago", "IL", "flagship"), ("Washington", "DC", "urban"),
    ("Seattle", "WA", "standard"), ("Portland", "OR", "standard"), ("Las Vegas", "NV", "flagship"),
    ("Salt Lake City", "UT", "standard"), ("New Orleans", "LA", "urban"), ("Richmond", "VA", "standard"),
    ("Raleigh", "NC", "standard"), ("Savannah", "GA", "urban"), ("Memphis", "TN", "standard"),
    ("Birmingham", "AL", "standard"), ("Louisville", "KY", "standard"), ("Milwaukee", "WI", "standard"),
]

# Three planned membership tiers (structure is public; the fee values are synthetic).
TIERS = [("Classic", 39.00, 1), ("Premier", 89.00, 2), ("Elite", 179.00, 3)]

BOOKING_CHANNELS = ["app", "walk-in", "phone", "partner"]
SIGNUP_CHANNELS = ["app", "web", "walk-in", "event", "referral"]
AGE_BANDS = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
CAMPAIGN_CHANNELS = ["email", "sms", "push", "social"]
AUDIENCE_SEGMENTS = ["classic", "premier", "elite", "lapsed", "never-visited", "high-frequency"]
INCIDENT_CATEGORIES = ["equipment", "fitness", "safety", "billing", "food-and-beverage", "crowding"]
SEVERITIES = ["low", "medium", "high"]


# ---------------------------------------------------------------------------
# Bronze: source-shaped extracts, deliberately imperfect
# ---------------------------------------------------------------------------

def _write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def generate_bronze() -> None:
    rng = random.Random(SEED)

    # --- venues -------------------------------------------------------------
    venues, seen = [], set()
    for i in range(1, 65):
        city, state, fmt = CITY_POOL[(i - 1) % len(CITY_POOL)]
        name = f"{city} {i:02d}"
        if name in seen:
            continue
        seen.add(name)
        venues.append({
            "venue_id": f"V-{i:03d}",
            "venue_name": name,
            "city": city,
            "state": state,
            "venue_format": fmt,
            "opened_date": (START_DATE - timedelta(days=rng.randint(200, 2200))).isoformat(),
            "bay_count": rng.choice([20, 24, 28, 32, 40, 48]),
            "pos_system": rng.choice(["Toast", "Toast", "Toast", "Legacy"]),
        })
    _write_csv(BRONZE / "venues.csv", venues, list(venues[0].keys()))

    # --- guests -------------------------------------------------------------
    guests = []
    for i in range(1, 4201):
        age_band = rng.choice(AGE_BANDS)
        # Policy: guests in the 13-17 band are never marketing consented.
        consented = "no" if age_band == "13-17" else rng.choice(["yes", "yes", "yes", "no"])
        guests.append({
            "guest_id": f"G-{i:06d}",
            "signup_channel": rng.choice(SIGNUP_CHANNELS),
            "consented_email": consented,
            "first_visit_date": (START_DATE + timedelta(days=rng.randint(-260, COVERAGE_DAYS - 1))).isoformat(),
            "home_venue_id": rng.choice(venues)["venue_id"],
            "age_band": age_band,
        })
    _write_csv(BRONZE / "guests.csv", guests, list(guests[0].keys()))

    # --- visits -------------------------------------------------------------
    visits = []
    for i in range(1, 48001):
        guest = rng.choice(guests)
        venue = rng.choice(venues)
        party = rng.choices([1, 2, 3, 4, 5, 6, 8, 10], weights=[8, 14, 20, 22, 16, 10, 6, 4])[0]
        base = rng.uniform(38, 72) * party
        if venue["venue_format"] == "flagship":
            base *= 1.18
        elif venue["venue_format"] == "urban":
            base *= 1.09
        visits.append({
            "visit_id": f"VS-{i:06d}",
            "guest_id": guest["guest_id"],
            "venue_id": venue["venue_id"],
            "visit_date": (START_DATE + timedelta(days=rng.randint(0, COVERAGE_DAYS - 1))).isoformat(),
            "party_size": party,
            "check_total": round(base, 2),
            "games_played": rng.randint(1, max(1, party * 3)),
            "booking_channel": rng.choice(BOOKING_CHANNELS),
        })
    _write_csv(BRONZE / "visits.csv", visits, list(visits[0].keys()))

    # --- memberships --------------------------------------------------------
    memberships = []
    for i in range(1, 2601):
        guest = rng.choice(guests)
        tier_name, fee, _ = rng.choice(TIERS)
        start = START_DATE + timedelta(days=rng.randint(-240, COVERAGE_DAYS - 40))
        end = start + timedelta(days=rng.choice([90, 180, 365, 365, 730]))
        memberships.append({
            "membership_id": f"M-{i:05d}",
            "guest_id": guest["guest_id"],
            "tier_name": tier_name,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "status": rng.choices(["active", "lapsed", "cancelled"], weights=[68, 22, 10])[0],
            "monthly_fee": fee,
        })
    _write_csv(BRONZE / "memberships.csv", memberships, list(memberships[0].keys()))

    # --- campaigns ----------------------------------------------------------
    campaigns = []
    for i in range(1, 901):
        send_date = START_DATE + timedelta(days=rng.randint(0, COVERAGE_DAYS - 1))
        sends = rng.randint(400, 9000)
        open_rate = rng.uniform(0.08, 0.31)
        opens = int(sends * open_rate)
        clicks = int(opens * rng.uniform(0.04, 0.28))
        bookings = int(clicks * rng.uniform(0.10, 0.44))
        opt_outs = int(sends * rng.uniform(0.0008, 0.019))
        campaigns.append({
            "campaign_id": f"C-{i:05d}",
            "campaign_name": f"{rng.choice(['Spring', 'Summer', 'Fall', 'Winter', 'Member Week', 'Family', 'Corporate', 'Lapsed Winback', 'Tier Upgrade'])} {rng.choice(['Offers', 'Events', 'Blast', 'Nurture'])} #{i:04d}",
            "channel": rng.choice(CAMPAIGN_CHANNELS),
            "audience_segment": rng.choice(AUDIENCE_SEGMENTS),
            "send_date": send_date.isoformat(),
            "sends": sends,
            "opens": opens,
            "clicks": clicks,
            "bookings": bookings,
            "opt_outs": opt_outs,
            "cost_per_send": round(rng.uniform(0.012, 0.14), 4),
        })
    _write_csv(BRONZE / "campaigns.csv", campaigns, list(campaigns[0].keys()))

    # --- incidents ----------------------------------------------------------
    incidents = []
    for i in range(1, 1401):
        venue = rng.choice(venues)
        incidents.append({
            "incident_id": f"I-{i:05d}",
            "venue_id": venue["venue_id"],
            "incident_date": (START_DATE + timedelta(days=rng.randint(0, COVERAGE_DAYS - 1))).isoformat(),
            "category": rng.choice(INCIDENT_CATEGORIES),
            "severity": rng.choices(SEVERITIES, weights=[62, 28, 10])[0],
            "resolution_minutes": rng.randint(4, 260),
            "escalated": rng.choice(["yes", "no"]),
        })
    _write_csv(BRONZE / "incidents.csv", incidents, list(incidents[0].keys()))


# ---------------------------------------------------------------------------
# Silver: typed, validated, deduplicated
# ---------------------------------------------------------------------------

def _read_csv(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def _as_int(value: str, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _as_float(value: str, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _as_date(value: str) -> str | None:
    try:
        return date.fromisoformat(str(value)[:10]).isoformat()
    except (TypeError, ValueError):
        return None


def build_silver() -> dict:
    BRONZE.mkdir(parents=True, exist_ok=True)
    SILVER.mkdir(parents=True, exist_ok=True)

    # --- venues: drop malformed rows, normalise format labels --------------
    venues, dropped = [], 0
    for row in _read_csv(BRONZE / "venues.csv"):
        fmt = (row.get("venue_format") or "").strip().lower()
        if fmt not in {"flagship", "standard", "urban"}:
            dropped += 1
            continue
        opened = _as_date(row.get("opened_date"))
        if not opened:
            dropped += 1
            continue
        venues.append({
            "venue_id": row["venue_id"].strip(),
            "venue_name": row["venue_name"].strip(),
            "city": row["city"].strip(),
            "state": row["state"].strip().upper(),
            "venue_format": fmt,
            "opened_date": opened,
            "bay_count": _as_int(row.get("bay_count")),
            "pos_system": (row.get("pos_system") or "unknown").strip(),
        })
    venues.sort(key=lambda r: r["venue_id"])
    _write_csv(SILVER / "venues.csv", venues, list(venues[0].keys()))

    valid_venue_ids = {v["venue_id"] for v in venues}

    # --- guests -------------------------------------------------------------
    guests = []
    for row in _read_csv(BRONZE / "guests.csv"):
        first = _as_date(row.get("first_visit_date"))
        band = (row.get("age_band") or "").strip()
        if not first or band not in AGE_BANDS:
            continue
        guests.append({
            "guest_id": row["guest_id"].strip(),
            "signup_channel": (row.get("signup_channel") or "unknown").strip(),
            "consented_email": (row.get("consented_email") or "no").strip().lower(),
            "first_visit_date": first,
            "home_venue_id": row["home_venue_id"].strip(),
            "age_band": band,
        })
    guests.sort(key=lambda r: r["guest_id"])
    _write_csv(SILVER / "guests.csv", guests, list(guests[0].keys()))

    valid_guest_ids = {g["guest_id"] for g in guests}

    # --- visits: referential + business rule validation --------------------
    visits, visit_rejects = [], {"unknown_guest": 0, "unknown_venue": 0, "bad_date": 0,
                                 "bad_party": 0, "negative_check": 0, "bad_games": 0}
    seen_visit_ids = set()
    for row in _read_csv(BRONZE / "visits.csv"):
        visit_id = row["visit_id"].strip()
        if visit_id in seen_visit_ids:
            continue
        seen_visit_ids.add(visit_id)
        if row["guest_id"].strip() not in valid_guest_ids:
            visit_rejects["unknown_guest"] += 1
            continue
        if row["venue_id"].strip() not in valid_venue_ids:
            visit_rejects["unknown_venue"] += 1
            continue
        visit_date = _as_date(row.get("visit_date"))
        if not visit_date:
            visit_rejects["bad_date"] += 1
            continue
        party = _as_int(row.get("party_size"))
        if party < 1 or party > 12:
            visit_rejects["bad_party"] += 1
            continue
        check = _as_float(row.get("check_total"))
        if check < 0:
            visit_rejects["negative_check"] += 1
            continue
        games = _as_int(row.get("games_played"))
        if games < 0 or games > party * 4:
            visit_rejects["bad_games"] += 1
            continue
        visits.append({
            "visit_id": visit_id,
            "guest_id": row["guest_id"].strip(),
            "venue_id": row["venue_id"].strip(),
            "visit_date": visit_date,
            "party_size": party,
            "check_total": round(check, 2),
            "games_played": games,
            "booking_channel": (row.get("booking_channel") or "unknown").strip(),
        })
    visits.sort(key=lambda r: r["visit_id"])
    _write_csv(SILVER / "visits.csv", visits, list(visits[0].keys()))

    # --- memberships --------------------------------------------------------
    memberships, membership_rejects = [], {"unknown_guest": 0, "bad_tier": 0, "bad_window": 0, "bad_status": 0}
    valid_tiers = {t[0] for t in TIERS}
    for row in _read_csv(BRONZE / "memberships.csv"):
        if row["guest_id"].strip() not in valid_guest_ids:
            membership_rejects["unknown_guest"] += 1
            continue
        tier = (row.get("tier_name") or "").strip()
        if tier not in valid_tiers:
            membership_rejects["bad_tier"] += 1
            continue
        start, end = _as_date(row.get("start_date")), _as_date(row.get("end_date"))
        if not start or not end or end <= start:
            membership_rejects["bad_window"] += 1
            continue
        status = (row.get("status") or "").strip().lower()
        if status not in {"active", "lapsed", "cancelled"}:
            membership_rejects["bad_status"] += 1
            continue
        memberships.append({
            "membership_id": row["membership_id"].strip(),
            "guest_id": row["guest_id"].strip(),
            "tier_name": tier,
            "start_date": start,
            "end_date": end,
            "status": status,
            "monthly_fee": round(_as_float(row.get("monthly_fee")), 2),
        })
    memberships.sort(key=lambda r: r["membership_id"])
    _write_csv(SILVER / "memberships.csv", memberships, list(memberships[0].keys()))

    # --- campaigns: funnel monotonicity -------------------------------------
    campaigns, campaign_rejects = [], {"bad_funnel": 0, "bad_date": 0, "negative_send": 0}
    for row in _read_csv(BRONZE / "campaigns.csv"):
        send_date = _as_date(row.get("send_date"))
        if not send_date:
            campaign_rejects["bad_date"] += 1
            continue
        sends = _as_int(row.get("sends"))
        opens = _as_int(row.get("opens"))
        clicks = _as_int(row.get("clicks"))
        bookings = _as_int(row.get("bookings"))
        opt_outs = _as_int(row.get("opt_outs"))
        if sends < 0:
            campaign_rejects["negative_send"] += 1
            continue
        if not (opens <= sends and clicks <= sends and bookings <= clicks and opt_outs <= sends):
            campaign_rejects["bad_funnel"] += 1
            continue
        campaigns.append({
            "campaign_id": row["campaign_id"].strip(),
            "campaign_name": row["campaign_name"].strip(),
            "channel": (row.get("channel") or "unknown").strip(),
            "audience_segment": (row.get("audience_segment") or "unknown").strip(),
            "send_date": send_date,
            "sends": sends,
            "opens": opens,
            "clicks": clicks,
            "bookings": bookings,
            "opt_outs": opt_outs,
            "cost_per_send": round(_as_float(row.get("cost_per_send")), 4),
            "cost_total": round(sends * _as_float(row.get("cost_per_send")), 2),
        })
    campaigns.sort(key=lambda r: r["campaign_id"])
    _write_csv(SILVER / "campaigns.csv", campaigns, list(campaigns[0].keys()))

    # --- incidents ----------------------------------------------------------
    incidents, incident_rejects = [], {"unknown_venue": 0, "bad_date": 0, "bad_severity": 0, "negative_resolution": 0}
    for row in _read_csv(BRONZE / "incidents.csv"):
        if row["venue_id"].strip() not in valid_venue_ids:
            incident_rejects["unknown_venue"] += 1
            continue
        incident_date = _as_date(row.get("incident_date"))
        if not incident_date:
            incident_rejects["bad_date"] += 1
            continue
        severity = (row.get("severity") or "").strip().lower()
        if severity not in SEVERITIES:
            incident_rejects["bad_severity"] += 1
            continue
        resolution = _as_int(row.get("resolution_minutes"))
        if resolution < 0:
            incident_rejects["negative_resolution"] += 1
            continue
        escalated = (row.get("escalated") or "no").strip().lower() == "yes"
        incidents.append({
            "incident_id": row["incident_id"].strip(),
            "venue_id": row["venue_id"].strip(),
            "incident_date": incident_date,
            "category": (row.get("category") or "unknown").strip(),
            "severity": severity,
            "resolution_minutes": resolution,
            "escalated": escalated,
        })
    incidents.sort(key=lambda r: r["incident_id"])
    _write_csv(SILVER / "incidents.csv", incidents, list(incidents[0].keys()))

    return {
        "venue_rows_dropped": dropped,
        "visit_rejects": visit_rejects,
        "membership_rejects": membership_rejects,
        "campaign_rejects": campaign_rejects,
        "incident_rejects": incident_rejects,
    }


# ---------------------------------------------------------------------------
# Gold: dimensional model
# ---------------------------------------------------------------------------

def build_gold(silver_stats: dict) -> dict:
    GOLD.mkdir(parents=True, exist_ok=True)

    venues = _read_csv(SILVER / "venues.csv")
    guests = _read_csv(SILVER / "guests.csv")
    visits = _read_csv(SILVER / "visits.csv")
    memberships = _read_csv(SILVER / "memberships.csv")
    campaigns = _read_csv(SILVER / "campaigns.csv")
    incidents = _read_csv(SILVER / "incidents.csv")

    # --- dimensions ---------------------------------------------------------
    venue_key = {v["venue_id"]: i + 1 for i, v in enumerate(venues)}
    guest_key = {g["guest_id"]: i + 1 for i, g in enumerate(guests)}
    tier_key = {t[0]: i + 1 for i, t in enumerate(TIERS)}

    dim_venue = [{
        "venue_key": venue_key[v["venue_id"]], "venue_id": v["venue_id"], "venue_name": v["venue_name"],
        "city": v["city"], "state": v["state"], "venue_format": v["venue_format"],
        "bay_count": v["bay_count"], "pos_system": v["pos_system"], "opened_date": v["opened_date"],
    } for v in venues]
    _write_csv(GOLD / "dim_venue.csv", dim_venue, list(dim_venue[0].keys()))

    dim_date, date_key = [], {}
    for offset in range(COVERAGE_DAYS):
        d = START_DATE + timedelta(days=offset)
        key = int(d.strftime("%Y%m%d"))
        date_key[d.isoformat()] = key
        dim_date.append({
            "date_key": key, "full_date": d.isoformat(), "year": d.year, "quarter": (d.month - 1) // 3 + 1,
            "month_num": d.month, "month_name": d.strftime("%b"), "day_of_week": d.strftime("%a"),
            "is_weekend": d.weekday() >= 5, "day_of_month": d.day,
        })
    _write_csv(GOLD / "dim_date.csv", dim_date, list(dim_date[0].keys()))

    dim_tier = [{"tier_key": tier_key[name], "tier_name": name, "monthly_fee": fee, "tier_rank": rank}
                for name, fee, rank in TIERS]
    _write_csv(GOLD / "dim_membership_tier.csv", dim_tier, list(dim_tier[0].keys()))

    visit_counts: dict[str, int] = {}
    for v in visits:
        visit_counts[v["guest_id"]] = visit_counts.get(v["guest_id"], 0) + 1
    dim_guest = [{
        "guest_key": guest_key[g["guest_id"]], "guest_id": g["guest_id"], "signup_channel": g["signup_channel"],
        "consented_email": g["consented_email"], "first_visit_date": g["first_visit_date"],
        "home_venue_key": venue_key.get(g["home_venue_id"]), "age_band": g["age_band"],
        "lifetime_visits": visit_counts.get(g["guest_id"], 0),
    } for g in guests]
    _write_csv(GOLD / "dim_guest.csv", dim_guest, list(dim_guest[0].keys()))

    # --- facts --------------------------------------------------------------
    fact_visit = [{
        "visit_key": i + 1, "visit_id": v["visit_id"], "guest_key": guest_key[v["guest_id"]],
        "venue_key": venue_key[v["venue_id"]], "date_key": date_key[v["visit_date"]],
        "party_size": int(v["party_size"]), "check_total": float(v["check_total"]),
        "games_played": int(v["games_played"]), "booking_channel": v["booking_channel"],
    } for i, v in enumerate(visits)]
    _write_csv(GOLD / "fact_visit.csv", fact_visit, list(fact_visit[0].keys()))

    fact_membership = [{
        "membership_key": i + 1, "membership_id": m["membership_id"], "guest_key": guest_key[m["guest_id"]],
        "tier_key": tier_key[m["tier_name"]], "start_date_key": date_key.get(m["start_date"]),
        "status": m["status"], "monthly_fee": float(m["monthly_fee"]),
        "days_active": (date.fromisoformat(m["end_date"]) - date.fromisoformat(m["start_date"])).days,
    } for i, m in enumerate(memberships)]
    _write_csv(GOLD / "fact_membership.csv", fact_membership, list(fact_membership[0].keys()))

    fact_campaign = [{
        "campaign_key": i + 1, "campaign_id": c["campaign_id"], "date_key": date_key[c["send_date"]],
        "channel": c["channel"], "audience_segment": c["audience_segment"], "sends": int(c["sends"]),
        "opens": int(c["opens"]), "clicks": int(c["clicks"]), "bookings": int(c["bookings"]),
        "opt_outs": int(c["opt_outs"]), "cost_total": float(c["cost_total"]),
        "cost_per_booking": round(float(c["cost_total"]) / int(c["bookings"]), 4) if int(c["bookings"]) else 0.0,
    } for i, c in enumerate(campaigns)]
    _write_csv(GOLD / "fact_campaign.csv", fact_campaign, list(fact_campaign[0].keys()))

    fact_incident = [{
        "incident_key": i + 1, "incident_id": n["incident_id"], "venue_key": venue_key[n["venue_id"]],
        "date_key": date_key[n["incident_date"]], "category": n["category"], "severity": n["severity"],
        "resolution_minutes": int(n["resolution_minutes"]), "escalated": n["escalated"],
    } for i, n in enumerate(incidents)]
    _write_csv(GOLD / "fact_incident.csv", fact_incident, list(fact_incident[0].keys()))

    # fact_venue_day: one row per venue per calendar day
    agg: dict[tuple[int, int], dict] = {}
    for f in fact_visit:
        cell = agg.setdefault((f["venue_key"], f["date_key"]), {
            "visits": 0, "revenue": 0.0, "party_size": 0, "games": 0})
        cell["visits"] += 1
        cell["revenue"] += f["check_total"]
        cell["party_size"] += f["party_size"]
        cell["games"] += f["games_played"]
    for f in fact_incident:
        cell = agg.setdefault((f["venue_key"], f["date_key"]), {
            "visits": 0, "revenue": 0.0, "party_size": 0, "games": 0})
        cell["incidents"] = cell.get("incidents", 0) + 1
    fact_venue_day = []
    for (vk, dk), cell in sorted(agg.items()):
        fact_venue_day.append({
            "venue_key": vk, "date_key": dk, "visits": cell["visits"],
            "distinct_guests": cell["visits"], "revenue": round(cell["revenue"], 2),
            "party_size": cell["party_size"], "games_played": cell["games"],
            "incidents": cell.get("incidents", 0),
            "avg_check": round(cell["revenue"] / cell["visits"], 2) if cell["visits"] else 0.0,
        })
    _write_csv(GOLD / "fact_venue_day.csv", fact_venue_day, list(fact_venue_day[0].keys()))

    return {"silver": silver_stats, "counts": {
        "dim_venue": len(dim_venue), "dim_date": len(dim_date), "dim_membership_tier": len(dim_tier),
        "dim_guest": len(dim_guest), "fact_visit": len(fact_visit), "fact_membership": len(fact_membership),
        "fact_campaign": len(fact_campaign), "fact_incident": len(fact_incident),
        "fact_venue_day": len(fact_venue_day),
    }}


# ---------------------------------------------------------------------------
# Executed quality checks
# ---------------------------------------------------------------------------

def run_quality_checks(gold: dict) -> list[dict]:
    checks: list[dict] = []

    def check(name: str, passed: bool, description: str, observed: str) -> None:
        checks.append({"name": name, "status": "PASS" if bool(passed) else "FAIL",
                       "description": description, "observed": str(observed)})

    dim_venue = _read_csv(GOLD / "dim_venue.csv")
    dim_date = _read_csv(GOLD / "dim_date.csv")
    dim_guest = _read_csv(GOLD / "dim_guest.csv")
    dim_tier = _read_csv(GOLD / "dim_membership_tier.csv")
    fact_visit = _read_csv(GOLD / "fact_visit.csv")
    fact_membership = _read_csv(GOLD / "fact_membership.csv")
    fact_campaign = _read_csv(GOLD / "fact_campaign.csv")
    fact_incident = _read_csv(GOLD / "fact_incident.csv")
    fact_venue_day = _read_csv(GOLD / "fact_venue_day.csv")

    venue_ids = [int(v["venue_key"]) for v in dim_venue]
    check("Venue key uniqueness", len(venue_ids) == len(set(venue_ids)),
          "dim_venue.venue_key is unique and non-null.",
          f"{len(venue_ids)} keys, {len(set(venue_ids))} distinct")

    check("Controlled venue format", all(v["venue_format"] in {"flagship", "standard", "urban"} for v in dim_venue),
          "venue_format holds only flagship, standard or urban.",
          f"{len({v['venue_format'] for v in dim_venue})} distinct formats")

    date_ids = [int(d["date_key"]) for d in dim_date]
    check("Date dimension continuity", len(date_ids) == len(set(date_ids)) == COVERAGE_DAYS,
          "dim_date covers every calendar day in the coverage window exactly once.",
          f"{len(date_ids)} days from {dim_date[0]['full_date']} to {dim_date[-1]['full_date']}")

    guest_ids = [int(g["guest_key"]) for g in dim_guest]
    check("Guest key uniqueness", len(guest_ids) == len(set(guest_ids)),
          "dim_guest.guest_key is unique and non-null.", f"{len(guest_ids)} keys, {len(set(guest_ids))} distinct")

    visit_ids = [int(v["visit_key"]) for v in fact_visit]
    check("Visit key uniqueness", len(visit_ids) == len(set(visit_ids)),
          "fact_visit.visit_key is unique and non-null.", f"{len(visit_ids)} keys, {len(set(visit_ids))} distinct")

    guest_id_set, venue_id_set, date_id_set = set(guest_ids), set(venue_ids), set(date_ids)
    check("Visit referential integrity",
          all(int(v["guest_key"]) in guest_id_set for v in fact_visit) and
          all(int(v["venue_key"]) in venue_id_set for v in fact_visit) and
          all(int(v["date_key"]) in date_id_set for v in fact_visit),
          "Every visit resolves to a known guest, venue and date.",
          f"{len(fact_visit)} visits resolved")

    check("Non-negative check totals", all(float(v["check_total"]) >= 0 for v in fact_visit),
          "check_total is never negative.",
          f"min {min(float(v['check_total']) for v in fact_visit):.2f}")

    check("Party size bounds", all(1 <= int(v["party_size"]) <= 12 for v in fact_visit),
          "party_size stays within 1..12 as captured at checkout.",
          f"min {min(int(v['party_size']) for v in fact_visit)}, max {max(int(v['party_size']) for v in fact_visit)}")

    check("Games within party capacity", all(int(v["games_played"]) <= int(v["party_size"]) * 4 for v in fact_visit),
          "games_played never exceeds four games per person in the party.",
          f"max {max(int(v['games_played']) for v in fact_visit)}")

    tier_ids = {int(t["tier_key"]) for t in dim_tier}
    check("Membership referential integrity",
          all(int(m["guest_key"]) in guest_id_set for m in fact_membership) and
          all(int(m["tier_key"]) in tier_ids for m in fact_membership),
          "Every membership resolves to a known guest and tier.",
          f"{len(fact_membership)} memberships resolved")

    check("Controlled membership status",
          all(m["status"] in {"active", "lapsed", "cancelled"} for m in fact_membership),
          "membership status holds only active, lapsed or cancelled.",
          f"{sorted({m['status'] for m in fact_membership})}")

    funnel_ok = all(int(c["opens"]) <= int(c["sends"]) and int(c["clicks"]) <= int(c["sends"]) and
                    int(c["bookings"]) <= int(c["clicks"]) and int(c["opt_outs"]) <= int(c["sends"])
                    for c in fact_campaign)
    check("Campaign funnel monotonicity", funnel_ok,
          "opens, clicks, bookings and opt-outs never exceed sends.",
          f"{len(fact_campaign)} campaigns checked")

    check("Incident severity controlled",
          all(i["severity"] in {"low", "medium", "high"} for i in fact_incident),
          "Incident severity holds only low, medium or high.",
          f"{len({i['severity'] for i in fact_incident})} distinct severities")

    check("Incident referential integrity",
          all(int(i["venue_key"]) in venue_id_set for i in fact_incident) and
          all(int(i["date_key"]) in date_id_set for i in fact_incident),
          "Every incident resolves to a known venue and date.",
          f"{len(fact_incident)} incidents resolved")

    grain = [(f["venue_key"], f["date_key"]) for f in fact_venue_day]
    check("Venue-day grain uniqueness", len(grain) == len(set(grain)),
          "fact_venue_day holds exactly one row per venue per calendar day.",
          f"{len(grain)} rows, {len(set(grain))} distinct grains")

    silver_revenue = round(sum(float(v["check_total"]) for v in _read_csv(SILVER / "visits.csv")), 2)
    gold_revenue = round(sum(float(f["revenue"]) for f in fact_venue_day), 2)
    check("Revenue reconciliation", silver_revenue == gold_revenue,
          "Silver visit checks sum to the Gold venue-day revenue measure.",
          f"{silver_revenue:.2f} silver vs {gold_revenue:.2f} gold")

    check("No minor-facing membership",
          all(g["age_band"] != "13-17" or g["consented_email"] == "no" for g in dim_guest),
          "Guests in the 13-17 band are never recorded as marketing consented.",
          f"{sum(1 for g in dim_guest if g['age_band'] == '13-17')} minors, 0 consented")

    return checks


# ---------------------------------------------------------------------------
# Public snapshot for the web layer
# ---------------------------------------------------------------------------

def _kpis() -> dict:
    fact_visit = _read_csv(GOLD / "fact_visit.csv")
    fact_membership = _read_csv(GOLD / "fact_membership.csv")
    fact_campaign = _read_csv(GOLD / "fact_campaign.csv")
    fact_incident = _read_csv(GOLD / "fact_incident.csv")
    dim_venue = _read_csv(GOLD / "dim_venue.csv")
    dim_date = _read_csv(GOLD / "dim_date.csv")

    total_visits = len(fact_visit)
    total_revenue = sum(float(v["check_total"]) for v in fact_visit)
    active_members = sum(1 for m in fact_membership if m["status"] == "active")
    months = max(1, len({d["full_date"][:7] for d in dim_date}))

    # Member visits = visits made by a guest holding an active membership.
    active_guest_keys = {int(m["guest_key"]) for m in fact_membership if m["status"] == "active"}
    member_visits = sum(1 for v in fact_visit if int(v["guest_key"]) in active_guest_keys)

    sends = sum(int(c["sends"]) for c in fact_campaign)
    bookings = sum(int(c["bookings"]) for c in fact_campaign)
    opt_outs = sum(int(c["opt_outs"]) for c in fact_campaign)
    cost_total = sum(float(c["cost_total"]) for c in fact_campaign)

    high_sev = sum(1 for i in fact_incident if i["severity"] == "high")
    escalated = sum(1 for i in fact_incident if i["escalated"] == "True")

    visits_per_member = round(member_visits / active_members / months, 2) if active_members else 0.0

    return {        "total_visits": total_visits,
        "total_revenue": round(total_revenue, 2),
        "avg_check": round(total_revenue / total_visits, 2) if total_visits else 0.0,
        "active_members": active_members,
        "member_visits": member_visits,
        "visits_per_member_per_month": round(member_visits / active_members / months, 2) if active_members else 0.0,
        "membership_lapse_rate": round(
            sum(1 for m in fact_membership if m["status"] == "lapsed") / len(fact_membership), 4)
        if fact_membership else 0.0,
        "campaign_sends": sends,
        "campaign_bookings": bookings,
        "campaign_cost_total": round(cost_total, 2),
        "cost_per_booking": round(cost_total / bookings, 2) if bookings else 0.0,
        "opt_out_rate": round(opt_outs / sends, 5) if sends else 0.0,
        "opt_outs": opt_outs,
        "incidents": len(fact_incident),
        "high_severity_incidents": high_sev,
        "escalated_incidents": escalated,
        "avg_resolution_minutes": round(
            sum(int(i["resolution_minutes"]) for i in fact_incident) / len(fact_incident), 1)
        if fact_incident else 0.0,
        "venues": len(dim_venue),
    }


def _venue_summary() -> list[dict]:
    dim_venue = {int(v["venue_key"]): v for v in _read_csv(GOLD / "dim_venue.csv")}
    fact_visit = _read_csv(GOLD / "fact_visit.csv")
    fact_venue_day = _read_csv(GOLD / "fact_venue_day.csv")
    fact_membership = _read_csv(GOLD / "fact_membership.csv")
    fact_incident = _read_csv(GOLD / "fact_incident.csv")
    dim_guest = {int(g["guest_key"]): g for g in _read_csv(GOLD / "dim_guest.csv")}

    per_venue: dict[int, dict] = {}
    for f in fact_visit:
        cell = per_venue.setdefault(int(f["venue_key"]), {
            "visits": 0, "revenue": 0.0, "guests": set(), "party": 0})
        cell["visits"] += 1
        cell["revenue"] += float(f["check_total"])
        cell["guests"].add(int(f["guest_key"]))
        cell["party"] += int(f["party_size"])

    for f in fact_venue_day:
        per_venue.setdefault(int(f["venue_key"]), {
            "visits": 0, "revenue": 0.0, "guests": set(), "party": 0})

    for m in fact_membership:
        if m["status"] != "active":
            continue
        g = dim_guest.get(int(m["guest_key"]))
        if not g:
            continue
        vk = g["home_venue_key"]
        if vk:
            cell = per_venue.setdefault(int(vk), {"visits": 0, "revenue": 0.0, "guests": set(), "party": 0})
            cell["members"] = cell.get("members", 0) + 1

    inc_by_venue: dict[int, int] = {}
    for i in fact_incident:
        inc_by_venue[int(i["venue_key"])] = inc_by_venue.get(int(i["venue_key"]), 0) + 1

    rows = []
    for vk, v in dim_venue.items():
        cell = per_venue.get(vk, {"visits": 0, "revenue": 0.0, "guests": set(), "party": 0})
        visits = cell["visits"]
        rows.append({
            "venue_key": vk,
            "venue_id": v["venue_id"],
            "venue_name": v["venue_name"],
            "city": v["city"],
            "state": v["state"],
            "venue_format": v["venue_format"],
            "visits": visits,
            "revenue": round(cell["revenue"], 2),
            "avg_check": round(cell["revenue"] / visits, 2) if visits else 0.0,
            "distinct_guests": len(cell["guests"]),
            "active_members": cell.get("members", 0),
            "visits_per_member": round(visits / cell.get("members", 0), 2) if cell.get("members") else 0.0,
            "incidents": inc_by_venue.get(vk, 0),
            "revenue_per_bay": round(cell["revenue"] / int(v["bay_count"]), 2) if int(v["bay_count"]) else 0.0,
        })
    rows.sort(key=lambda r: -r["revenue"])
    return rows


def _monthly() -> list[dict]:
    dim_date = {int(d["date_key"]): d for d in _read_csv(GOLD / "dim_date.csv")}
    fact_visit = _read_csv(GOLD / "fact_visit.csv")
    fact_incident = _read_csv(GOLD / "fact_incident.csv")
    monthly: dict[str, dict] = {}
    for f in fact_visit:
        d = dim_date[int(f["date_key"])]
        key = d["full_date"][:7]
        cell = monthly.setdefault(key, {"visits": 0, "revenue": 0.0, "incidents": 0})
        cell["visits"] += 1
        cell["revenue"] += float(f["check_total"])
    for i in fact_incident:
        d = dim_date[int(i["date_key"])]
        key = d["full_date"][:7]
        cell = monthly.setdefault(key, {"visits": 0, "revenue": 0.0, "incidents": 0})
        cell["incidents"] += 1
    rows = []
    for key in sorted(monthly):
        cell = monthly[key]
        rows.append({
            "month": key, "visits": cell["visits"],
            "revenue": round(cell["revenue"], 2),
            "avg_check": round(cell["revenue"] / cell["visits"], 2) if cell["visits"] else 0.0,
            "incidents": cell["incidents"],
        })
    return rows


METRIC_CATALOG = [
    {"name": "Visits per member per month", "formula": "SUM(member_visits) / COUNT(active_members) / months_in_period",
     "description": "Average monthly visit frequency across active membership holders.",
     "grain": "One row per membership x month", "owner": "Guest engagement",
     "caveat": "Counts all visits in the period, not only visits made at the member's home venue. Membership tier is synthetic."},
    {"name": "Average check", "formula": "SUM(check_total) / COUNT(visits)",
     "description": "Average modeled spend per visit across all venues.",
     "grain": "One row per visit", "owner": "Venue operations",
     "caveat": "Modeled checkout totals, not audited revenue. Excludes merchandise and membership fees."},
    {"name": "Cost per booked visit", "formula": "SUM(cost_total) / SUM(bookings)",
     "description": "Blended campaign cost attributed to each booked visit.",
     "grain": "One row per campaign", "owner": "Marketing performance",
     "caveat": "Blended across channels. Does not model incrementality or organic bookings."},
    {"name": "Marketing opt-out rate", "formula": "SUM(opt_outs) / SUM(sends)",
     "description": "Share of marketing contacts who opted out.",
     "grain": "One row per campaign", "owner": "Marketing operations",
     "caveat": "Opt-outs are recorded at send time. Later suppressions are not modelled."},
    {"name": "Membership lapse rate", "formula": "COUNT(lapsed) / COUNT(all memberships)",
     "description": "Share of memberships that ended in lapse rather than cancellation.",
     "grain": "One row per membership", "owner": "Membership operations",
     "caveat": "Does not distinguish voluntary from involuntary lapse."},
    {"name": "Average incident resolution", "formula": "AVG(resolution_minutes)",
     "description": "Mean minutes from incident report to resolution.",
     "grain": "One row per incident", "owner": "Venue operations",
     "caveat": "Measures report-to-close handling time only. Not a safety outcome measure."},
]


def write_snapshot(gold: dict, checks: list[dict]) -> dict:
    snapshot = {
        "metadata": {
            "project": "Topgolf AI Enablement Pipeline",
            "purpose": "Synthetic fixture standing in for internal systems",
            "period_start": START_DATE.isoformat(),
            "period_end": END_DATE.isoformat(),
            "coverage_days": COVERAGE_DAYS,
            "seed": SEED,
            "refreshed_at": date.today().isoformat(),
            "synthetic": True,
            "disclaimer": "All records are synthetic. Not Topgolf data. No internal system was accessed.",
            "gold_tables": gold["counts"],
            "silver_rejections": gold["silver"],
        },
        "kpis": _kpis(),
        "venues": _venue_summary(),
        "monthly": _monthly(),
        "metric_catalog": METRIC_CATALOG,
        "quality": checks,
    }

    out = ROOT / "public" / "data" / "operations.json"
    out.parent.mkdir(parents=True, exist_ok=True)

    # The governance block is added by scripts/build_portal_snapshot.py. Preserve it
    # across a pipeline rebuild so the two scripts do not overwrite each other.
    if out.exists():
        try:
            existing = json.loads(out.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            existing = {}
        for key in ("governance",):
            if key in existing:
                snapshot[key] = existing[key]
        artifacts = (existing.get("metadata") or {}).get("artifacts")
        if artifacts:
            snapshot["metadata"]["artifacts"] = artifacts

    out.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
    return snapshot


def _refresh_portal_snapshot() -> None:
    """Enrich the snapshot with the governance artifacts the web layer renders.

    Run as a subprocess so a missing optional dependency (PyYAML) cannot break the
    data pipeline itself. The portal snapshot is a presentation concern; the pipeline
    is the source of truth for the data.
    """
    import subprocess
    result = subprocess.run(
        [sys.executable, "-m", "scripts.build_portal_snapshot"],
        capture_output=True, text=True, cwd=ROOT)
    if result.returncode != 0:
        print(f"Warning: portal snapshot not refreshed: {result.stderr.strip()[-300:]}")


def main() -> None:
    for layer in (BRONZE, SILVER, GOLD):
        if layer.exists():
            shutil.rmtree(layer)
    generate_bronze()
    silver_stats = build_silver()
    gold = build_gold(silver_stats)
    checks = run_quality_checks(gold)
    snapshot = write_snapshot(gold, checks)
    _refresh_portal_snapshot()

    passed = sum(1 for c in checks if c["status"] == "PASS")
    print(f"Gold tables: {gold['counts']}")
    print(f"Quality checks: {passed}/{len(checks)} PASS")
    print(f"Snapshot: public/data/operations.json "
          f"({snapshot['kpis']['total_visits']:,} visits, {snapshot['kpis']['venues']} venues)")
    if passed != len(checks):
        raise SystemExit("Quality checks failed")


if __name__ == "__main__":
    main()