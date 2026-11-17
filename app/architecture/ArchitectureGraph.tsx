"use client";

import { useMemo, useState } from "react";
import type { TopoEdge, TopoLayer, TopoNode } from "./types";
import { EDGE_STYLE, NODE_STYLE } from "./types";

type Positioned = TopoNode & { x: number; y: number; w: number; h: number };

const NODE_W = 150;
const NODE_H = 50;
const COL_GAP = 198;
const ROW_GAP = 68;
const PAD_X = 30;
const PAD_Y = 58;

const LAYER_LABELS: Record<string, string> = {
  experience: "EXPERIENCE",
  catalog: "CATALOGS",
  runtime: "RUNTIME",
  data: "DATA LAYER",
  source: "SOURCE SYSTEMS",
  control: "CONTROL PLANE",
};

/**
 * Computes a deterministic layered layout. Nodes are grouped by layer into columns,
 * and within a layer they are ordered by their id so the graph does not reshuffle
 * between renders.
 */
function layout(nodes: TopoNode[], layers: TopoLayer[]) {
  const ordered = [...layers].sort((a, b) => a.order - b.order);
  const byLayer = new Map<string, TopoNode[]>();
  for (const node of nodes) {
    const list = byLayer.get(node.layer) ?? [];
    list.push(node);
    byLayer.set(node.layer, list);
  }

  const columns = ordered.map((layer) => ({
    layer,
    members: (byLayer.get(layer.id) ?? []).slice().sort((a, b) => a.id.localeCompare(b.id)),
  }));

  const maxRows = Math.max(...columns.map((c) => c.members.length), 1);
  const contentHeight = maxRows * ROW_GAP;

  const positioned: Positioned[] = [];
  const layerColumns: { layer: TopoLayer; x: number; nodes: Positioned[] }[] = [];

  columns.forEach(({ layer, members }, colIndex) => {
    const x = PAD_X + colIndex * COL_GAP;
    // Centre this column vertically against the tallest one so short columns do not
    // leave the bottom of the diagram empty.
    const offset = (contentHeight - members.length * ROW_GAP) / 2;
    const colNodes: Positioned[] = [];

    members.forEach((node, rowIndex) => {
      const p: Positioned = {
        ...node,
        x, y: PAD_Y + offset + rowIndex * ROW_GAP, w: NODE_W, h: NODE_H,
      };
      colNodes.push(p);
      positioned.push(p);
    });

    layerColumns.push({ layer, x, nodes: colNodes });
  });

  const width = PAD_X * 2 + ordered.length * COL_GAP;
  const height = PAD_Y * 2 + contentHeight;

  return { positioned, layerColumns, width, height };
}

function edgePath(from: Positioned, to: Positioned) {
  const x1 = from.x + from.w;
  const y1 = from.y + from.h / 2;
  const x2 = to.x;
  const y2 = to.y + to.h / 2;
  const mid = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
}

export default function ArchitectureGraph({
  nodes, edges, layers,
}: {
  nodes: TopoNode[];
  edges: TopoEdge[];
  layers: TopoLayer[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [showLabels, setShowLabels] = useState(true);

  const { positioned, layerColumns, width, height } = useMemo(
    () => layout(nodes, layers), [nodes, layers]);

  const positionMap = useMemo(() => {
    const map = new Map<string, Positioned>();
    positioned.forEach((p) => map.set(p.id, p));
    return map;
  }, [positioned]);

  const activeId = hovered ?? selected;

  const connectedEdges = useMemo(() => {
    if (!activeId) return new Set<string>();
    const set = new Set<string>();
    edges.forEach((e) => {
      if (e.source === activeId) set.add(e.id);
      if (e.target === activeId) set.add(e.id);
    });
    return set;
  }, [activeId, edges]);

  // Rendered edge geometry. Labels are suppressed when they would collide with one
  // already placed, so the diagram stays readable instead of turning into overlapping
  // text. Active edges always keep their label.
  const renderedEdges = useMemo(() => {
    const slots: { x: number; y: number }[] = [];
    const result: {
      edge: TopoEdge; from: Positioned; to: Positioned; isActive: boolean;
      faded: boolean; stroke: string; midX: number; midY: number; drawLabel: boolean;
    }[] = [];

    for (const edge of edges) {
      const from = positionMap.get(edge.source);
      const to = positionMap.get(edge.target);
      if (!from || !to) continue;
      const isActive = activeId
        ? edge.source === activeId || edge.target === activeId
        : false;
      const midX = (from.x + from.w + to.x) / 2;
      const midY = (from.y + from.h / 2 + to.y + to.h / 2) / 2 - 5;
      const collides = slots.some(
        (slot) => Math.abs(slot.x - midX) < 78 && Math.abs(slot.y - midY) < 14);
      const drawLabel = showLabels && !collides && (isActive || !activeId);
      if (drawLabel) slots.push({ x: midX, y: midY });
      result.push({
        edge, from, to, isActive,
        faded: activeId ? !isActive : false,
        stroke: isActive ? "#f5c518" : EDGE_STYLE[edge.kind].stroke,
        midX, midY, drawLabel,
      });
    }
    return result;
  }, [edges, positionMap, activeId, showLabels]);

  const visibleNode = useMemo(() => {
    if (filter === "all") return null;
    return new Set(nodes.filter((n) => n.layer === filter).map((n) => n.id));
  }, [filter, nodes]);

  const dim = (id: string) => {
    if (activeId) return id !== activeId && !connectedEdges.has(
      edges.find((e) => e.source === id || e.target === id)?.id ?? ""
    );
    if (visibleNode) return !visibleNode.has(id);
    return false;
  };

  const selectedNode = selected ? positionMap.get(selected) : null;
  const selectedEdges = selected
    ? edges.filter((e) => e.source === selected || e.target === selected)
    : [];
  const selectedConnections = selectedEdges.map((e) => ({
    edge: e,
    other: positionMap.get(e.source === selected ? e.target : e.source),
    direction: e.source === selected ? "outbound" : "inbound",
  }));

  return (
    <div className="arch-wrap">
      <div className="arch-toolbar">
        <div className="arch-filters">
          <button
            className={`btn ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All layers
          </button>
          {layers.map((l) => (
            <button
              key={l.id}
              className={`btn ${filter === l.id ? "active" : ""}`}
              onClick={() => setFilter(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="arch-legend">
          {Object.entries(NODE_STYLE).map(([kind, style]) => (
            <span className="arch-legend-item" key={kind}>
              <i style={{ background: style.stroke }} /> {style.label}
            </span>
          ))}
          <span className="arch-legend-item">
            <i className="dash" /> Blocked path
          </span>
          <label className="arch-toggle">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
            />
            Edge labels
          </label>
        </div>
      </div>

      <div className="arch-canvas">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          style={{ minWidth: width, height: "auto" }}
          role="img"
          aria-label="Platform architecture graph"
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#4a6076" />
            </marker>
            <marker
              id="arrow-blocked"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#ff6b6b" />
            </marker>
            <marker
              id="arrow-active"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f5c518" />
            </marker>
          </defs>

          {layerColumns.map(({ layer, x, nodes: colNodes }) => {
            const lastBottom = colNodes.length
              ? Math.max(...colNodes.map((n) => n.y + n.h))
              : PAD_Y;
            const columnHeight = Math.max(lastBottom - PAD_Y + 24, 40);
            return (
              <g key={layer.id}>
                <rect
                  x={x - 14}
                  y={PAD_Y - 34}
                  width={NODE_W + 28}
                  height={columnHeight}
                  rx="14"
                  fill="rgba(255,255,255,0.018)"
                  stroke="rgba(255,255,255,0.05)"
                  strokeDasharray="3 5"
                />
                <text
                  x={x}
                  y={PAD_Y - 44}
                  className="arch-layer-label"
                  fill="#7c8fa2"
                >
                  {LAYER_LABELS[layer.id] ?? layer.label.toUpperCase()}
                </text>
              </g>
            );
          })}

          <g>
            {renderedEdges.map(({ edge, from, to, isActive, faded, stroke, midX, midY, drawLabel }) => (
              <g key={edge.id} opacity={faded ? 0.14 : 0.85}>
                <path
                  d={edgePath(from, to)}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={isActive ? 2 : 1.2}
                  strokeDasharray={EDGE_STYLE[edge.kind].dash}
                  markerEnd={isActive ? "url(#arrow-active)" :
                    edge.kind === "blocked" ? "url(#arrow-blocked)" : "url(#arrow)"}
                />
                {drawLabel && (
                  <text
                    x={midX}
                    y={midY}
                    textAnchor="middle"
                    className="arch-edge-label"
                    fill={isActive ? "#f5c518" : "#5c7185"}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            ))}
          </g>

          <g>
            {positioned.map((n) => {
              const style = NODE_STYLE[n.kind];
              const isActive = activeId === n.id;
              const isConnected = activeId
                ? edges.some((e) =>
                    (e.source === n.id || e.target === n.id) &&
                    (e.source === activeId || e.target === activeId))
                : false;
              const faded = dim(n.id);
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x}, ${n.y})`}
                  opacity={faded ? 0.2 : 1}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setSelected(selected === n.id ? null : n.id)}
                  style={{ cursor: "pointer" }}
                >
                  <rect
                    width={n.w}
                    height={n.h}
                    rx="10"
                    fill={style.fill}
                    stroke={isActive ? "#f5c518" : isConnected ? style.stroke : "#26364a"}
                    strokeWidth={isActive ? 2 : 1}
                  />
                  <rect
                    width="3"
                    height={n.h}
                    rx="1.5"
                    fill={style.stroke}
                    opacity={0.9}
                  />
                  <text x="13" y="22" className="arch-node-label" fill="#e8eef5">
                    {n.label.length > 20 ? `${n.label.slice(0, 19)}…` : n.label}
                  </text>
                  <text x="13" y="38" className="arch-node-sub" fill="#7c8fa2">
                    {n.kind === "person" ? n.persona :
                      n.kind === "registry"
                        ? (n.count !== undefined
                            ? `registry · ${n.count} ${n.registry_unit ?? "entries"}`
                            : "governed registry")
                        : n.kind === "process" ? "executable process" :
                          n.kind === "table" ? `${n.tables ?? 0} ${n.tables === 1 ? "artifact" : "tables"}` :
                          n.data_class ?? "source system"}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {selectedNode && (
        <div className="arch-inspector">
          <div className="arch-inspector-head">
            <div>
              <span className="arch-inspector-kind" style={{ color: NODE_STYLE[selectedNode.kind].stroke }}>
                {NODE_STYLE[selectedNode.kind].label} · {selectedNode.layer}
              </span>
              <h3>{selectedNode.label}</h3>
            </div>
            <button className="btn" onClick={() => setSelected(null)}>Close</button>
          </div>
          <p className="arch-inspector-detail">{selectedNode.detail}</p>

          {selectedNode.source && (
            <div className="arch-inspector-source">
              <span className="muted">Implemented in</span>
              <code className="mono">{selectedNode.source}</code>
            </div>
          )}

          <div className="arch-inspector-grid">
            {selectedNode.kind === "person" && selectedNode.persona && (
              <div><dt>Role</dt><dd>{selectedNode.persona}</dd></div>
            )}
            {selectedNode.kind === "registry" && (
              <>
                <div><dt>Entries</dt><dd>{selectedNode.count ?? 0}</dd></div>
                <div><dt>Declined</dt><dd>{selectedNode.declined ?? 0}</dd></div>
                <div><dt>Version</dt><dd>{selectedNode.version}</dd></div>
              </>
            )}
            {selectedNode.kind === "process" && selectedNode.protocol && (
              <div><dt>Protocol</dt><dd>{selectedNode.protocol}</dd></div>
            )}
            {selectedNode.kind === "process" && selectedNode.tools !== undefined && (
              <div><dt>Tools exposed</dt><dd>{selectedNode.tools}</dd></div>
            )}
            {selectedNode.kind === "process" && selectedNode.checks !== undefined && (
              <div><dt>Check classes</dt><dd>{selectedNode.checks}</dd></div>
            )}
            {selectedNode.kind === "process" && selectedNode.cases !== undefined && (
              <>
                <div><dt>Cases</dt><dd>{selectedNode.cases}</dd></div>
                <div><dt>Taxonomies</dt><dd>{selectedNode.taxonomies}</dd></div>
              </>
            )}
            {selectedNode.kind === "process" && selectedNode.corpus !== undefined && (
              <div><dt>Corpus documents</dt><dd>{selectedNode.corpus}</dd></div>
            )}
            {selectedNode.kind === "process" && selectedNode.constraint && (
              <div><dt>Runtime</dt><dd>{selectedNode.constraint}</dd></div>
            )}
            {selectedNode.kind === "table" && (
              <div><dt>Tables</dt><dd>{selectedNode.tables}</dd></div>
            )}
            {selectedNode.kind === "system" && (
              <>
                <div><dt>Data class</dt><dd>{selectedNode.data_class}</dd></div>
                <div><dt>Steward</dt><dd>{selectedNode.steward}</dd></div>
              </>
            )}
          </div>

          <div className="arch-connections">
            <h4>{selectedConnections.length} connection{selectedConnections.length === 1 ? "" : "s"}</h4>
            {selectedConnections.map(({ edge, other, direction }) => (
              <div className="arch-connection" key={edge.id}>
                <div className="arch-connection-head">
                  <span className={`pill ${edge.kind === "blocked" ? "bad" : "ok"}`}>
                    {direction}
                  </span>
                  <b>{other?.label ?? edge.target}</b>
                  <span className="muted">{edge.label}</span>
                </div>
                <p>{edge.detail}</p>
                <div className="arch-connection-meta">
                  <span className="mono">payload: {edge.payload || "none"}</span>
                  {edge.guarded_by && <span className="mono">guarded by: {edge.guarded_by}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!selectedNode && (
        <p className="arch-hint">
          Select any node to see what it is, which file implements it, and every
          connection that flows through it.
        </p>
      )}
    </div>
  );
}
