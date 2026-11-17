"use client";

import { useState } from "react";
import type { McpTool, Topology } from "./types";

const EXAMPLE_CALL = `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_incidents","arguments":{"severity":"high","__archetype":"shift-handover"}}}`;

export default function McpInspector({
  tools, protocol,
}: {
  tools: McpTool[];
  protocol: Topology["mcp_protocol"];
}) {
  const [selected, setSelected] = useState<McpTool>(tools[0]);
  const [showCall, setShowCall] = useState(false);

  return (
    <div className="mcp-inspector">
      <div className="mcp-protocol-bar">
        <div className="mcp-protocol-item">
          <span>Protocol version</span>
          <code className="mono">{protocol.protocol_version}</code>
        </div>
        <div className="mcp-protocol-item">
          <span>Transport</span>
          <code className="mono">{protocol.transport}</code>
        </div>
        <div className="mcp-protocol-item">
          <span>Server</span>
          <code className="mono">{protocol.server}</code>
        </div>
        <div className="mcp-protocol-item">
          <span>Methods</span>
          <div className="tag-row">
            {protocol.methods.map((m) => <span className="pill" key={m}>{m}</span>)}
          </div>
        </div>
      </div>

      <div className="mcp-layout">
        <div className="mcp-tool-list">
          {tools.map((tool) => (
            <button
              key={tool.name}
              className={`mcp-tool ${selected.name === tool.name ? "active" : ""}`}
              onClick={() => setSelected(tool)}
            >
              <div className="mcp-tool-name">
                <code className="mono">{tool.name}</code>
                <span className={`pill ${tool.data_class === "internal-personal" ? "warn" : "ok"}`}>
                  {tool.data_class}
                </span>
              </div>
              <p>{tool.description}</p>
              <span className="mcp-tool-connector mono">{tool.connector}</span>
            </button>
          ))}
        </div>

        <div className="mcp-tool-detail">
          <div className="mcp-detail-head">
            <div>
              <span className="eyebrow">Tool contract</span>
              <h3><code className="mono">{selected.name}</code></h3>
            </div>
            <span className={`pill ${selected.data_class === "internal-personal" ? "warn" : "ok"}`}>
              {selected.data_class}
            </span>
          </div>

          <p className="mcp-detail-desc">{selected.description}</p>

          <div className="mcp-detail-block">
            <h4>Bound connector</h4>
            <div className="mcp-connector-binding">
              <code className="mono">{selected.connector}</code>
              <Arrow />
              <span>
                The server refuses this call if the calling archetype is not in the
                connector&apos;s permitted list.
              </span>
            </div>
          </div>

          <div className="mcp-detail-block">
            <h4>Input schema</h4>
            <table className="tbl">
              <thead><tr><th>Argument</th><th>Type and constraint</th></tr></thead>
              <tbody>
                {Object.entries(selected.arguments).map(([key, desc]) => (
                  <tr key={key}><td><b className="mono">{key}</b></td><td>{desc}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mcp-detail-block">
            <h4>Return payload</h4>
            <div className="tag-row">
              {selected.returns.split(", ").map((f) => (
                <span className="pill ok" key={f}>{f}</span>
              ))}
            </div>
          </div>

          <div className="mcp-detail-block">
            <h4>Guards applied to every call</h4>
            <ul className="checks">
              {selected.guards.map((g) => (
                <li className="pass" key={g}><span className="mk">✓</span><span>{g}</span></li>
              ))}
            </ul>
          </div>

          <div className="mcp-detail-block">
            <h4>What it does not expose</h4>
            <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
              Every connector declares a <code>never_exposes</code> list. The server
              strips those fields from every row before the payload leaves it, so a
              field the connector is forbidden to return cannot appear in a response
              even if the underlying table contains it.
            </p>
          </div>

          <button className="btn" onClick={() => setShowCall((v) => !v)}>
            {showCall ? "Hide" : "Show"} the raw JSON-RPC call
          </button>
          {showCall && (
            <pre className="code mcp-call">{EXAMPLE_CALL}</pre>
          )}
        </div>
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden="true">
      <line x1="0" y1="5" x2="16" y2="5" stroke="#4a6076" strokeWidth="1.4" />
      <path d="M 15 1.5 L 21 5 L 15 8.5 z" fill="#4a6076" />
    </svg>
  );
}
