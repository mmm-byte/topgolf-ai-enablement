"use client";

import { useMemo, useState } from "react";
import type { TableSpec } from "./types";

const LAYER_COLOR: Record<string, string> = {
  Bronze: "#ff8f6b",
  Silver: "#b18ce8",
  Gold: "#3ddc97",
};

export default function DataModelExplorer({ tables }: { tables: TableSpec[] }) {
  const [selected, setSelected] = useState<TableSpec>(tables[0]);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      t.purpose.toLowerCase().includes(q) ||
      t.grain.toLowerCase().includes(q));
  }, [tables, query]);

  const relations = useMemo(() => {
    const incoming = tables.filter((t) => t.joins.includes(selected.name));
    const outgoing = selected.joins;
    return { incoming, outgoing };
  }, [selected, tables]);

  return (
    <div className="data-model">
      <div className="data-model-toolbar">
        <div className="data-search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tables, grain or purpose"
            aria-label="Search the data model"
          />
        </div>
        <div className="data-layer-legend">
          {Object.entries(LAYER_COLOR).map(([layer, color]) => (
            <span key={layer} className="arch-legend-item">
              <i style={{ background: color }} /> {layer}
            </span>
          ))}
        </div>
      </div>

      <div className="data-model-layout">
        <div className="data-table-grid">
          {filtered.map((table) => {
            const color = LAYER_COLOR[table.layer] ?? "#4a6076";
            const isSelected = table.name === selected.name;
            return (
              <button
                key={table.name}
                className={`data-table-card ${isSelected ? "active" : ""}`}
                onClick={() => setSelected(table)}
                style={{ borderColor: isSelected ? color : undefined }}
              >
                <div className="data-table-card-head">
                  <span className="data-table-dot" style={{ background: color }} />
                  <code className="mono">{table.name}</code>
                </div>
                <div className="data-table-grain">{table.grain}</div>
                <div className="data-table-rows">
                  {table.rows !== undefined && (
                    <span>{table.rows.toLocaleString()} rows</span>
                  )}
                  <span className="muted">{table.layer}</span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="muted" style={{ gridColumn: "1 / -1", padding: 20 }}>
              No table matches that search.
            </p>
          )}
        </div>

        <div className="data-detail">
          <div className="data-detail-head">
            <div>
              <span className="eyebrow">{selected.layer} table</span>
              <h3><code className="mono">{selected.name}</code></h3>
            </div>
            {selected.rows !== undefined && (
              <span className="pill accent">{selected.rows.toLocaleString()} rows</span>
            )}
          </div>

          <dl className="kv" style={{ marginTop: 14 }}>
            <dt>Grain</dt><dd>{selected.grain}</dd>
            <dt>Primary key</dt><dd><code className="mono">{selected.key}</code></dd>
            <dt>Purpose</dt><dd>{selected.purpose}</dd>
          </dl>

          <div className="data-relations">
            <h4>Joins to this table</h4>
            {relations.incoming.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>No other table joins to this one.</p>
            ) : (
              <div className="tag-row">
                {relations.incoming.map((t) => (
                  <button className="pill info" key={t.name} onClick={() => setSelected(t)}>
                    {t.name}
                  </button>
                ))}
              </div>
            )}

            <h4 style={{ marginTop: 18 }}>This table joins to</h4>
            <div className="tag-row">
              {relations.outgoing.map((t) => (
                <button className="pill" key={t} onClick={() => {
                  const target = tables.find((x) => x.name === t);
                  if (target) setSelected(target);
                }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="data-contract">
            <h4>Why the grain is enforced</h4>
            <p>
              A fact table with an ambiguous grain cannot be aggregated safely. If a row
              could represent either a visit or a party, then a count and a sum will
              disagree and nobody can tell which is right. Declaring the grain in the
              model, and checking it in the pipeline, is what makes the published
              numbers reconcilable.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
