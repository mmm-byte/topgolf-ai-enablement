# Synthetic data layers

These CSVs are deterministic synthetic examples generated with seed `58` by `scripts/build_pipeline.py`.

- `bronze/`: source-shaped input extracts.
- `silver/`: standardized, typed entities.
- `gold/`: conformed dimensions and facts, including the equipment-day fact.

They are included so reviewers can inspect the Medallion layers directly. Regenerate them with `python scripts/build_pipeline.py`. They contain no HOLT or real customer data.
