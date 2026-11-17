"use client";

import { useState } from "react";
import {
  Boxes, Database, Plug, ShieldCheck, Users, Workflow,
} from "lucide-react";
import type { Topology } from "./types";

type Domain = {
  id: string;
  title: string;
  question: string;
  icon: "boxes" | "plug" | "shield" | "database" | "users" | "workflow";
  layer: string;
  files: { path: string; what: string }[];
  facts: { label: string; value: string }[];
  covers: string[];
};

const ICONS = {
  boxes: Boxes, plug: Plug, shield: ShieldCheck,
  database: Database, users: Users, workflow: Workflow,
};

export default function PlatformMap({
  topology, domains,
}: {
  topology: Topology;
  domains: Domain[];
}) {
  const [active, setActive] = useState<string>(domains[0].id);
  const current = domains.find((d) => d.id === active) ?? domains[0];
  const Icon = ICONS[current.icon];

  const relatedNodes = topology.nodes.filter((n) => n.layer === current.layer);

  return (
    <div className="platform-map">
      <div className="platform-map-tabs">
        {domains.map((d) => {
          const DIcon = ICONS[d.icon];
          return (
            <button
              key={d.id}
              className={`platform-map-tab ${active === d.id ? "active" : ""}`}
              onClick={() => setActive(d.id)}
            >
              <DIcon size={16} />
              <span>{d.title}</span>
            </button>
          );
        })}
      </div>

      <div className="platform-map-body">
        <div className="platform-map-panel">
          <div className="platform-map-head">
            <span className="platform-map-icon"><Icon size={18} /></span>
            <div>
              <span className="eyebrow">{current.layer}</span>
              <h3>{current.title}</h3>
            </div>
          </div>
          <p className="platform-map-question">{current.question}</p>

          <div className="platform-map-facts">
            {current.facts.map((f) => (
              <div key={f.label}>
                <span>{f.label}</span>
                <strong>{f.value}</strong>
              </div>
            ))}
          </div>

          <h4 className="platform-map-subhead">What it answers</h4>
          <ul className="checks">
            {current.covers.map((c) => (
              <li className="pass" key={c}><span className="mk">✓</span><span>{c}</span></li>
            ))}
          </ul>
        </div>

        <div className="platform-map-side">
          <h4 className="platform-map-subhead">Files that implement it</h4>
          <div className="platform-map-files">
            {current.files.map((f) => (
              <div key={f.path}>
                <code className="mono">{f.path}</code>
                <span>{f.what}</span>
              </div>
            ))}
          </div>

          <h4 className="platform-map-subhead" style={{ marginTop: 20 }}>
            Components in this layer
          </h4>
          <div className="tag-row">
            {relatedNodes.map((n) => (
              <span className="pill" key={n.id}>{n.label}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
