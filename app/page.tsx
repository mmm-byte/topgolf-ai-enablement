"use client";

import { useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, BookOpen, Boxes, ChevronRight,
  CircleHelp, ClipboardList, Database, FileCheck2, Gauge, Plug, ShieldCheck,
  Table2, Target, Users, Workflow,
} from "lucide-react";
import ArchitectureGraph from "./architecture/ArchitectureGraph";
import DataModelExplorer from "./architecture/DataModelExplorer";
import McpInspector from "./architecture/McpInspector";
import PipelineFlow from "./architecture/PipelineFlow";
import TraceExplorer from "./architecture/TraceExplorer";
import data from "../public/data/operations.json";

type Usage = {
  period: string; requests: number; weekly_avg: number; human_rewrite_rate: number;
  gate_failure_rate: number; support_questions: number;
};
type Health = {
  prompt_bytes: number; baseline_prompt_bytes: number; drift_flag: boolean;
  adversarial_pass_rate: number | null;
};
type Archetype = {
  name: string; title: string; path: string; status: string; version: string;
  data_class: string; connector: string; owner: string; data_owner: string;
  steward: string; last_reviewed: string; next_review: string | null;
  description: string; usage: Usage; health: Health;
  decision: string; decision_reason: string;
  decision_accepted_by?: string; decision_date?: string;
  retired_on?: string; superseded_by?: string; retirement_reason?: string;
};
type Connector = {
  id: string; title: string; system: string; data_class: string; steward: string;
  data_owner: string; auth: string; runtime: string; status: string;
  exposes: string[]; never_exposes: string[]; allowed_archetypes: string[]; notes: string;
};
type Declined = { name: string; requester: string; reason: string; route: string };
type PendingConnector = { id: string; requester: string; requested: string; status: string; reason: string; route: string };
type HealthRow = {
  name: string; title: string; status: string; weekly_avg: number; rewrite_rate: number;
  gate_failure_rate: number; support_questions: number; drift_pct: number;
  recommended_action: string; rationale: string; signals: string[];
  reconciliation: string; reconciliation_note: string; catalog_decision: string;
  prompt_bytes: number; baseline_prompt_bytes: number;
};
type AdvResult = {
  id: string; taxonomy: string; rule: string; expected: string; status: string;
  defence_in_depth: boolean; severity_if_missed: string; matched_rules: string[];
};
type Topology = {
  layers: { id: string; label: string; order: number; description: string }[];
  nodes: {
    id: string; layer: string; label: string; kind: string; detail: string;
    source: string; persona?: string; constraint?: string; protocol?: string;
    tools?: number; checks?: number; cases?: number; taxonomies?: number;
    corpus?: number; count?: number; declined?: number; version?: string;
    registry_unit?: string;
    tables?: number; data_class?: string; steward?: string; connector_id?: string;
  }[];
  edges: {
    id: string; source: string; target: string; label: string; kind: "flow" | "blocked";
    detail: string; payload: string; guarded_by: string;
  }[];
  tables: {
    name: string; layer: string; grain: string; purpose: string;
    key: string; rows?: number; joins: string[];
  }[];
  mcp_tools: {
    name: string; connector: string; data_class: string; description: string;
    arguments: Record<string, string>; returns: string; guards: string[];
  }[];
  mcp_protocol: {
    protocol_version: string; transport: string; methods: string[]; server: string;
  };
  stats: { nodes: number; edges: number; gold_tables: number; mcp_tools: number };
};
type QualityCheck = { name: string; status: string; description: string; observed: string };
type Metric = { name: string; formula: string; description: string; grain: string; owner: string; caveat: string };
type Venue = {
  venue_key: number; venue_name: string; city: string; state: string; venue_format: string;
  visits: number; revenue: number; avg_check: number; distinct_guests: number;
  active_members: number; visits_per_member: number; incidents: number; revenue_per_bay: number;
};

const snapshot = data as unknown as {
  metadata: {
    period_start: string; period_end: string; coverage_days: number; seed: number;
    refreshed_at: string; synthetic: boolean; disclaimer: string;
    gold_tables: Record<string, number>; artifacts: Record<string, number>;
  };
  kpis: Record<string, number>;
  venues: Venue[];
  monthly: { month: string; visits: number; revenue: number; avg_check: number; incidents: number }[];
  metric_catalog: Metric[];
  quality: QualityCheck[];
  governance: {
    archetype_catalog: { version: string; updated: string; archetypes: Archetype[]; declined: Declined[] };
    connector_catalog: { version: string; updated: string; connectors: Connector[]; pending: PendingConnector[]; policy: string[] };
    health: { archetypes: HealthRow[]; action_counts: Record<string, number>; drifted: string[]; policy: string };
    adversarial: { total: number; passed: number; missed: number; defence_in_depth: number; taxonomies: string[]; results: AdvResult[] };
    catalog_validation: { valid: boolean; errors: string[]; warnings: string[]; archetypes: number };
    topology: Topology;
  };
};

const number = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n || 0));
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
const pct = (n: number, digits = 1) => `${(n || 0).toFixed(digits)}%`;

const SECTIONS = [
  { id: "Overview", label: "Overview", icon: Gauge },
  { id: "Architecture", label: "Architecture", icon: Workflow },
  { id: "Trace", label: "Request traces", icon: ArrowRight },
  { id: "Pipeline", label: "Pipeline & gates", icon: Workflow },
  { id: "Archetypes", label: "Archetypes", icon: Boxes },
  { id: "Connectors", label: "Connectors & MCP", icon: Plug },
  { id: "McpTools", label: "MCP inspector", icon: Plug },
  { id: "DataModel", label: "Data model", icon: Table2 },
  { id: "Guardrails", label: "Guardrails", icon: ShieldCheck },
  { id: "Health", label: "Health & drift", icon: Activity },
  { id: "Enablement", label: "Enablement", icon: Users },
  { id: "Evidence", label: "Evidence map", icon: Target },
  { id: "Data", label: "Data & metrics", icon: Database },
];

export default function Home() {
  const [section, setSection] = useState("Overview");
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);

  const go = (id: string) => {
    setSection(id);
    setSelectedArchetype(null);
    setSelectedConnector(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const gov = snapshot.governance;

  return (
    <div>
      <header className="site-head">
        <div className="wrap">
          <a className="brand" href="#overview" onClick={(e) => { e.preventDefault(); go("Overview"); }}>
            <span className="brand-mark" aria-hidden="true" />
            <span><b>AI Enablement</b><span>Topgolf · AI-SDLC pipeline</span></span>
          </a>
          <nav className="nav" aria-label="Main">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id.toLowerCase()}`}
                aria-current={section === s.id ? "page" : undefined}
                onClick={(e) => { e.preventDefault(); go(s.id); }}
              >
                {s.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main>
        <header className="page-head">
          <div className="wrap">
            <p className="eyebrow">Independent portfolio project · Not affiliated with Topgolf</p>
            <h1>Reusable archetypes and governed integrations, so business teams build safe AI applications inside the pipeline.</h1>
            <p className="lede">
              This is the working implementation of the Topgolf AI Enablement Engineer role
              (JR2023-23049). It contains the building blocks the role is named after: a
              catalog of archetypes with real <code>SKILL.md</code> files, a governed connector
              catalog with a working MCP server, executable guardrail hooks, an adversarial
              suite, and a drift monitor that retires archetypes on evidence. Every number on
              this page is generated by the pipeline in this repository, and every claim is
              traceable to a file.
            </p>
          </div>
        </header>

        {section === "Overview" && <Overview go={go} />}
        {section === "Architecture" && (
          <ArchitectureSection topology={gov.topology} />
        )}
        {section === "Trace" && (
          <TraceSection topology={gov.topology} />
        )}
        {section === "Pipeline" && <PipelineSection />}
        {section === "Archetypes" && (
          <ArchetypesSection
            archetypes={gov.archetype_catalog.archetypes}
            declined={gov.archetype_catalog.declined}
            selected={selectedArchetype}
            setSelected={setSelectedArchetype}
            version={gov.archetype_catalog.version}
          />
        )}
        {section === "Connectors" && (
          <ConnectorsSection
            connectors={gov.connector_catalog.connectors}
            pending={gov.connector_catalog.pending}
            policy={gov.connector_catalog.policy}
            selected={selectedConnector}
            setSelected={setSelectedConnector}
            version={gov.connector_catalog.version}
          />
        )}
        {section === "Guardrails" && <GuardrailsSection adversarial={gov.adversarial} />}
        {section === "McpTools" && (
          <McpSection
            tools={gov.topology.mcp_tools}
            protocol={gov.topology.mcp_protocol}
            connectors={gov.connector_catalog.connectors}
          />
        )}
        {section === "DataModel" && (
          <DataModelSection tables={gov.topology.tables} />
        )}
        {section === "Health" && <HealthSection health={gov.health} />}
        {section === "Enablement" && <EnablementSection />}
        {section === "Evidence" && <EvidenceSection go={go} />}
        {section === "Data" && <DataSection />}
      </main>

      <footer className="site-foot">
        <div className="wrap">
          <p>
            An independent portfolio project built for a job application. Not affiliated with,
            endorsed by, or connected to Topgolf Entertainment Group or Callaway Brands. It has
            no access to any internal system, and every venue, guest, membership, campaign and
            incident record in this project is synthetic.
          </p>
          <p>
            The platform artifacts are real and runnable: the pipeline, the guardrail engine,
            the adversarial suite, the MCP server, the catalog validator and the drift monitor
            are all executable in this repository and run on every pull request.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Overview({ go }: { go: (id: string) => void }) {
  const a = snapshot.metadata.artifacts;
  const k = snapshot.kpis;

  const pillars = [
    {
      icon: Boxes,
      title: "Archetypes, not ad-hoc prompts",
      body: `SKILL.md files that package engineering standards, governance and intake into reusable building blocks. ${a.archetypes} shipped, ${a.archetypes_declined} deliberately declined, one retired and merged on usage evidence.`,
      action: "Archetypes",
    },
    {
      icon: Plug,
      title: "Governed connectors",
      body: `${a.connectors} approved connectors, each with a data class, a steward, an explicit never-exposes list, and the archetypes allowed to use it. ${a.connectors_pending} requests are blocked with a stated reason.`,
      action: "Connectors",
    },
    {
      icon: ShieldCheck,
      title: "Guardrails that execute",
      body: `A deterministic guardrail engine covering scope, output structure and data-class policy. ${a.adversarial_passed} of ${a.adversarial_cases} adversarial cases caught across six attack taxonomies.`,
      action: "Guardrails",
    },
    {
      icon: Activity,
      title: "The catalog evolves on evidence",
      body: "Usage, rewrite rate, gate failure rate and prompt drift drive a weekly health report. The monitor proposes; the steward decides and records the decision.",
      action: "Health",
    },
  ];

  return (
    <>
      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">What this repository contains</p>
              <h2>The role is named after archetypes. These are the archetypes.</h2>
            </div>
            <p>Every count below is generated by the pipeline, the catalog, or the test suite.</p>
          </div>
          <div className="grid g-4">
            <div className="stat">
              <div className="l">Archetypes shipped</div>
              <div className="v">{a.archetypes}</div>
              <div className="s">{a.archetypes_declined} requests declined with a reason, 1 retired and merged</div>
            </div>
            <div className="stat">
              <div className="l">Approved connectors</div>
              <div className="v">{a.connectors}</div>
              <div className="s">{a.connectors_pending} requests blocked, each with a stated reason</div>
            </div>
            <div className="stat">
              <div className="l">Adversarial cases caught</div>
              <div className="v">{a.adversarial_passed}/{a.adversarial_cases}</div>
              <div className="s">Six attack taxonomies, run on every pull request</div>
            </div>
            <div className="stat">
              <div className="l">Data quality checks</div>
              <div className="v">{a.quality_passed}/{a.quality_checks}</div>
              <div className="s">Executed against the Gold layer on every build</div>
            </div>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">How the work is organised</p>
              <h2>Four things the role asks for, made concrete</h2>
            </div>
            <p>Not a description of these ideas. Executable artifacts that produce the numbers.</p>
          </div>
          <div className="grid g-2">
            {pillars.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.title}
                  className="card"
                  onClick={() => go(p.action)}
                  style={{ textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "inherit" }}
                >
                  <div className="row" style={{ marginBottom: 8 }}>
                    <Icon size={18} color="var(--accent)" />
                    <h3 style={{ margin: 0 }}>{p.title}</h3>
                  </div>
                  <p>{p.body}</p>
                  <div className="row" style={{ marginTop: 12, color: "var(--accent)", fontSize: 13, fontWeight: 600 }}>
                    Open <ArrowRight size={14} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Where the data comes from</p>
              <h2>A synthetic fixture standing in for internal systems</h2>
            </div>
            <p>Deterministic, seeded, and reconciled at every layer.</p>
          </div>
          <div className="split">
            <div className="panel">
              <h3>Why synthetic data, and why it matters here</h3>
              <p style={{ color: "var(--ink-2)", fontSize: 14, lineHeight: 1.65, marginTop: 8 }}>
                The archetypes, connectors, guardrails and MCP server need something real-shaped
                to run against. That something is this fixture: {number(k.total_visits)} visits
                across {k.venues} venues, {number(k.active_members)} active members,{" "}
                {number(k.campaign_sends)} marketing sends and {number(k.incidents)} incidents
                over {snapshot.metadata.coverage_days} days, generated from seed{" "}
                {snapshot.metadata.seed} and rebuilt identically on every run.
              </p>
              <p style={{ color: "var(--ink-2)", fontSize: 14, lineHeight: 1.65, marginTop: 12 }}>
                It is a fixture, not a claim about Topgolf&apos;s business. It exists so that
                every governance control in this repository can be demonstrated against a real
                dataset with real grain, real referential integrity, and real violations to
                catch.
              </p>
            </div>
            <div className="panel">
              <h3>What the pipeline produces</h3>
              <div className="tag-row" style={{ marginTop: 12 }}>
                {Object.entries(snapshot.metadata.gold_tables).map(([name, count]) => (
                  <span className="tag" key={name}>{name} · {number(count)}</span>
                ))}
              </div>
              <ul className="checks" style={{ marginTop: 16 }}>
                <li className="pass"><span className="mk">✓</span><span>Bronze keeps the source-shaped extract for inspection.</span></li>
                <li className="pass"><span className="mk">✓</span><span>Silver types, validates and rejects malformed rows, and records why.</span></li>
                <li className="pass"><span className="mk">✓</span><span>Gold conforms the dimensions and facts the archetypes read.</span></li>
                <li className="pass"><span className="mk">✓</span><span>{a.quality_passed} executed checks, results embedded in this snapshot.</span></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">What success looks like</p>
              <h2>Stated as the role states it, with the evidence attached</h2>
            </div>
            <p>The role&apos;s own success criteria, mapped to what is actually built.</p>
          </div>
          <div className="scroll">
            <table className="tbl">
              <thead>
                <tr><th>Criterion from the role</th><th>What is built here</th><th>Where</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><b>Business teams build safe, working applications inside the pipeline instead of routing every idea to engineering.</b></td>
                  <td>An intake questionnaire, a spec template, and a scaffold path that a non-technical builder can follow end to end. The archetype is the reusable unit, not a conversation with engineering.</td>
                  <td><span className="pill accent">archetypes/references/</span></td>
                </tr>
                <tr>
                  <td><b>The archetypes you maintain stay current, well scoped, and easy for non-technical builders to use without guessing.</b></td>
                  <td>Each SKILL.md declares its data class, connector, owner, steward and review date. The catalog validator fails the build when an archetype is missing any of them.</td>
                  <td><span className="pill accent">monitoring/validate_catalog.py</span></td>
                </tr>
                <tr>
                  <td><b>What ships has already been checked against good software development practice, because you caught what the automated gates could not.</b></td>
                  <td>The review rubric is written around one question: what did the gates miss? It separates the classes a machine can catch from the ones only a person can.</td>
                  <td><span className="pill accent">review/</span></td>
                </tr>
                <tr>
                  <td><b>The archetype catalog and the tools you connect evolve based on evidence: what teams actually need, and what keeps showing up in questions and escalations.</b></td>
                  <td>One archetype retired and merged because usage showed 71% overlap. One archetype flagged for review because support questions and gate failures crossed threshold. Three requests declined with a recorded route.</td>
                  <td><span className="pill accent">monitoring/health_report.py</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}

function ArchetypesSection({
  archetypes, declined, selected, setSelected, version,
}: {
  archetypes: Archetype[]; declined: Declined[]; selected: string | null;
  setSelected: (v: string | null) => void; version: string;
}) {
  const active = selected ? archetypes.find((a) => a.name === selected) : null;

  return (
    <>
      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Archetype catalog v{version}</p>
              <h2>The reusable building blocks</h2>
            </div>
            <p>
              Each archetype is a real <code>SKILL.md</code> with frontmatter, preconditions,
              hard rules, refusal behaviour and an escalation route.
            </p>
          </div>
          <div className="grid g-2">
            {archetypes.map((arch) => {
              const statusPill =
                arch.status === "active" ? "ok" : arch.status === "pilot" ? "accent" :
                arch.status === "retired" ? "bad" : "warn";
              const decisionPill =
                arch.decision === "keep" ? "ok" : arch.decision === "retire" ? "bad" :
                arch.decision === "extend" ? "info" : "warn";
              return (
                <button
                  key={arch.name}
                  className="card archetype-card"
                  onClick={() => setSelected(arch.name)}
                  style={{ textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "inherit" }}
                >
                  <div className="head">
                    <div>
                      <h3 style={{ marginBottom: 4 }}>{arch.title}</h3>
                      <span className="mono muted">{arch.name} · v{arch.version}</span>
                    </div>
                    <span className={`pill ${statusPill}`}>{arch.status}</span>
                  </div>
                  <p>{arch.description}</p>
                  <div className="meta">
                    <span className="pill">{arch.data_class}</span>
                    <span className="pill">{arch.connector}</span>
                    <span className={`pill ${decisionPill}`}>decision: {arch.decision}</span>
                  </div>
                  <div className="kv">
                    <dt>Requests / week</dt><dd>{number(arch.usage.weekly_avg)}</dd>
                    <dt>Human rewrite rate</dt><dd>{pct(arch.usage.human_rewrite_rate * 100, 0)}</dd>
                    <dt>Gate failure rate</dt><dd>{pct(arch.usage.gate_failure_rate * 100, 0)}</dd>
                    <dt>Steward</dt><dd>{arch.steward}</dd>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {active && (
        <section className="block">
          <div className="wrap">
            <div className="block-head">
              <div>
                <p className="eyebrow">{active.path}</p>
                <h2>{active.title}</h2>
              </div>
              <button className="btn" onClick={() => setSelected(null)}>Close</button>
            </div>
            <div className="split">
              <div className="panel">
                <h3>Ownership and contract</h3>
                <dl className="kv" style={{ marginTop: 12 }}>
                  <dt>Status</dt><dd>{active.status} · v{active.version}</dd>
                  <dt>Data class</dt><dd>{active.data_class}</dd>
                  <dt>Connector</dt><dd>{active.connector}</dd>
                  <dt>Owner</dt><dd>{active.owner}</dd>
                  <dt>Data owner</dt><dd>{active.data_owner}</dd>
                  <dt>App steward</dt><dd>{active.steward}</dd>
                  <dt>Last reviewed</dt><dd>{active.last_reviewed}</dd>
                  <dt>Next review</dt><dd>{active.next_review ?? "closed"}</dd>
                </dl>
                {active.retirement_reason && (
                  <div className="callout" style={{ marginTop: 18 }}>
                    <AlertTriangle size={17} />
                    <p><b>Retired {active.retired_on}.</b> {active.retirement_reason}</p>
                  </div>
                )}
              </div>
              <div className="panel">
                <h3>Decision and evidence</h3>
                <div className="row" style={{ marginTop: 12, marginBottom: 12 }}>
                  <span className="pill accent">decision: {active.decision}</span>
                  {active.decision_accepted_by && <span className="pill">accepted by {active.decision_accepted_by}</span>}
                  {active.decision_date && <span className="pill">{active.decision_date}</span>}
                </div>
                <p style={{ color: "var(--ink-2)", fontSize: 14, lineHeight: 1.65 }}>{active.decision_reason}</p>
                <div className="kv" style={{ marginTop: 16 }}>
                  <dt>Usage period</dt><dd>{active.usage.period}</dd>
                  <dt>Total requests</dt><dd>{number(active.usage.requests)}</dd>
                  <dt>Support questions</dt><dd>{number(active.usage.support_questions)}</dd>
                  <dt>Prompt size</dt><dd>{number(active.health.prompt_bytes)} bytes (baseline {number(active.health.baseline_prompt_bytes)})</dd>
                  <dt>Adversarial pass rate</dt>
                  <dd>{active.health.adversarial_pass_rate === null ? "not applicable" : pct(active.health.adversarial_pass_rate * 100, 0)}</dd>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Declined on purpose</p>
              <h2>Requests that were not built</h2>
            </div>
            <p>Recorded so they are not re-proposed every quarter, and routed to whoever owns the decision.</p>
          </div>
          <div className="scroll">
            <table className="tbl">
              <thead><tr><th>Request</th><th>Requested by</th><th>Why it was declined</th><th>Routed to</th></tr></thead>
              <tbody>
                {declined.map((d) => (
                  <tr key={d.name}>
                    <td><b>{d.name}</b></td>
                    <td>{d.requester}</td>
                    <td>{d.reason}</td>
                    <td><span className="pill warn">{d.route}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}

function ConnectorsSection({
  connectors, pending, policy, selected, setSelected, version,
}: {
  connectors: Connector[]; pending: PendingConnector[]; policy: string[];
  selected: string | null; setSelected: (v: string | null) => void; version: string;
}) {
  const active = selected ? connectors.find((c) => c.id === selected) : null;

  return (
    <>
      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Connector catalog v{version}</p>
              <h2>The only way an archetype reaches a system</h2>
            </div>
            <p>If it is not in this catalog, an archetype cannot use that system, and the scope check fails.</p>
          </div>
          <div className="scroll">
            <table className="tbl">
              <thead>
                <tr><th>Connector</th><th>System</th><th>Data class</th><th>Exposes / never exposes</th><th>Permitted archetypes</th><th>Steward</th></tr>
              </thead>
              <tbody>
                {connectors.map((c) => (
                  <tr key={c.id} onClick={() => setSelected(c.id)} style={{ cursor: "pointer" }}>
                    <td><b>{c.title}</b><br /><span className="mono muted">{c.id}</span></td>
                    <td>{c.system}</td>
                    <td><span className="pill">{c.data_class}</span></td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        {c.exposes.slice(0, 3).map((f) => <span className="pill ok" key={f}>{f}</span>)}
                        {c.exposes.length > 3 && <span className="pill">+{c.exposes.length - 3}</span>}
                      </div>
                      <div className="row" style={{ gap: 4, marginTop: 5 }}>
                        {c.never_exposes.slice(0, 2).map((f) => <span className="pill bad" key={f}>{f}</span>)}
                        {c.never_exposes.length > 2 && <span className="pill bad">+{c.never_exposes.length - 2} blocked</span>}
                      </div>
                    </td>
                    <td>{c.allowed_archetypes.map((x) => <span className="pill info" key={x} style={{ marginRight: 4 }}>{x}</span>)}</td>
                    <td>{c.steward}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {active && (
        <section className="block">
          <div className="wrap">
            <div className="block-head">
              <div>
                <p className="eyebrow">Connector contract</p>
                <h2>{active.title}</h2>
              </div>
              <button className="btn" onClick={() => setSelected(null)}>Close</button>
            </div>
            <div className="split">
              <div className="panel">
                <h3>Contract</h3>
                <dl className="kv" style={{ marginTop: 12 }}>
                  <dt>System</dt><dd>{active.system}</dd>
                  <dt>Data class</dt><dd>{active.data_class}</dd>
                  <dt>Auth</dt><dd>{active.auth}</dd>
                  <dt>Runtime</dt><dd>{active.runtime}</dd>
                  <dt>Steward</dt><dd>{active.steward}</dd>
                  <dt>Data owner</dt><dd>{active.data_owner}</dd>
                </dl>
                <p style={{ color: "var(--ink-2)", fontSize: 13.5, lineHeight: 1.6, marginTop: 14 }}>{active.notes}</p>
              </div>
              <div className="panel">
                <h3>Field exposure</h3>
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-3)", fontWeight: 700, marginBottom: 8 }}>May expose</p>
                  <div className="tag-row">{active.exposes.map((f) => <span className="pill ok" key={f}>{f}</span>)}</div>
                  <p style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-3)", fontWeight: 700, margin: "16px 0 8px" }}>Never exposes</p>
                  <div className="tag-row">{active.never_exposes.map((f) => <span className="pill bad" key={f}>{f}</span>)}</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Blocked requests</p>
              <h2>Connector requests that were not approved</h2>
            </div>
            <p>Adding a connector is a platform request, not an archetype request.</p>
          </div>
          <div className="grid g-2">
            {pending.map((p) => (
              <div className="card" key={p.id}>
                <div className="row" style={{ marginBottom: 8 }}>
                  <span className="pill bad">{p.status}</span>
                  <span className="mono muted">{p.id}</span>
                </div>
                <p>{p.reason}</p>
                <div className="row" style={{ marginTop: 12 }}>
                  <span className="pill warn">route: {p.route}</span>
                  <span className="pill">requested by {p.requester}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="panel" style={{ marginTop: 18 }}>
            <h3>Policy for adding a connector</h3>
            <ul className="checks" style={{ marginTop: 12 }}>
              {policy.map((rule, i) => (
                <li className="pass" key={i}><span className="mk">{i + 1}</span><span>{rule}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}

function GuardrailsSection({ adversarial }: { adversarial: {
  total: number; passed: number; missed: number; defence_in_depth: number;
  taxonomies: string[]; results: AdvResult[];
} }) {
  const byTaxonomy = useMemo(() => {
    const map = new Map<string, { total: number; passed: number }>();
    adversarial.results.forEach((r) => {
      const entry = map.get(r.taxonomy) ?? { total: 0, passed: 0 };
      entry.total += 1;
      if (r.status === "PASS") entry.passed += 1;
      map.set(r.taxonomy, entry);
    });
    return Array.from(map.entries());
  }, [adversarial]);

  return (
    <>
      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Guardrail engine</p>
              <h2>Rules that execute, not rules that are written</h2>
            </div>
            <p>A rule nobody can check is a wish. The engine covers three classes and states honestly which rules stay human.</p>
          </div>
          <div className="grid g-3">
            <div className="card">
              <div className="row" style={{ marginBottom: 8 }}><Table2 size={17} color="var(--accent)" /><h3 style={{ margin: 0 }}>Scope</h3></div>
              <p>Compares the fields an archetype actually touched against the fields it declared. Checks both directions: a declared-but-unreachable field is a spec bug, an undeclared field is a scope violation.</p>
              <div className="row" style={{ marginTop: 12 }}><span className="pill bad">never-read list is absolute</span></div>
            </div>
            <div className="card">
              <div className="row" style={{ marginBottom: 8 }}><FileCheck2 size={17} color="var(--accent)" /><h3 style={{ margin: 0 }}>Output</h3></div>
              <p>Validates structure, length bounds and prohibited content against the source data&apos;s own identifier list. A guest name is caught because it is in the guest dimension, not because it looks like a name.</p>
              <div className="row" style={{ marginTop: 12 }}><span className="pill bad">severity S1 at personal class</span></div>
            </div>
            <div className="card">
              <div className="row" style={{ marginBottom: 8 }}><ShieldCheck size={17} color="var(--accent)" /><h3 style={{ margin: 0 }}>Policy</h3></div>
              <p>Checks the output set against data-class policy independently of the output text. A policy violation is often invisible in the words, so it is checked over the records.</p>
              <div className="row" style={{ marginTop: 12 }}><span className="pill bad">minors never targeted</span></div>
            </div>
          </div>
          <div className="callout" style={{ marginTop: 18 }}>
            <CircleHelp size={17} />
            <p>
              <b>What the gates do not prove.</b> A green gate means the output is structurally
              safe. It does not mean the output is right. Rules that require judgment about
              operational usefulness, tone, legal approval, or business intent stay human, and
              that is why the pipeline keeps a human review stage instead of pretending the
              machine covers it.
            </p>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Adversarial suite</p>
              <h2>{adversarial.passed} of {adversarial.total} cases caught</h2>
            </div>
            <p>
              {adversarial.defence_in_depth} cases are caught twice: once by the policy layer and
              again by the content layer running the real guardrail engine.
            </p>
          </div>
          <div className="grid g-3" style={{ marginBottom: 24 }}>
            {byTaxonomy.map(([taxonomy, counts]) => (
              <div className="stat" key={taxonomy}>
                <div className="l">{taxonomy}</div>
                <div className="v">{counts.passed}/{counts.total}</div>
                <div className="s">
                  <div className="bar" style={{ marginTop: 6 }}>
                    <i className="good" style={{ width: `${(counts.passed / counts.total) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="scroll">
            <table className="tbl">
              <thead>
                <tr><th>Case</th><th>Taxonomy</th><th>Rule it attacks</th><th>Severity if missed</th><th>Expected behaviour</th><th>Status</th></tr>
              </thead>
              <tbody>
                {adversarial.results.map((r) => (
                  <tr key={r.id}>
                    <td><b className="mono">{r.id}</b></td>
                    <td><span className="pill">{r.taxonomy}</span></td>
                    <td>{r.rule}</td>
                    <td><span className={`pill ${r.severity_if_missed === "S1" ? "bad" : "warn"}`}>{r.severity_if_missed}</span></td>
                    <td className="mono" style={{ fontSize: 12 }}>{r.expected}</td>
                    <td>
                      <span className={`pill ${r.status === "PASS" ? "ok" : "bad"}`}>{r.status}</span>
                      {r.defence_in_depth && <span className="pill info" style={{ marginLeft: 4 }}>2 layers</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="callout" style={{ marginTop: 18 }}>
            <AlertTriangle size={17} />
            <p>
              <b>What this suite honestly is.</b> A regression suite. Its value is that
              removing a rule flips the matching case to <code>MISSED</code> and the build
              fails. It is not proof that no attack exists, and it does not use a live language
              model. That gap is why the pipeline keeps a human review stage and an
              adversarial step that runs against the deployed archetype, not only against
              this fixture.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

function PipelineSection() {
  const stages = [
    { n: "01", t: "Intake", b: "The builder answers the intake questionnaire. The request is matched to an existing archetype or sent for a new one. Data class is set here, before any code exists." },
    { n: "02", t: "Build", b: "The app is built from the archetype's scaffold. Standards, guardrails and output contract are already wired in, not added afterwards." },
    { n: "03", t: "Automated gates", b: "Unit tests, output schema, secrets scan, and a scope check that compares what the app can reach against what it declared." },
    { n: "04", t: "Adversarial tests", b: "The archetype is run against injection, jailbreak, exfiltration and policy cases. Any case that gets through blocks release." },
    { n: "05", t: "Human review", b: "A reviewer applies the rubric and answers one question: what did the automated gates miss? Personal-data apps need a second reviewer." },
    { n: "06", t: "Staging", b: "The app runs against recorded or synthetic data for a full week with output logged for review." },
    { n: "07", t: "Release and monitor", b: "Released with a steward and a review date. Usage, rewrite rate, gate failures and prompt drift are tracked. A drop triggers review." },
  ];

  const classes = [
    { c: "Public", ex: "Venue hours, published offers, public FAQ", tools: "Approved assistants", req: "Marketing review" },
    { c: "Internal, aggregated", ex: "Totals by venue, campaign funnel totals", tools: "Approved assistants, governed connectors", req: "Standard gates and human review" },
    { c: "Internal, personal", ex: "Guest names, bookings, incident narratives", tools: "Only tools that keep data in the company environment", req: "Standard gates, second reviewer, data owner sign-off" },
    { c: "Restricted", ex: "Minors, payments, safety records", tools: "None without written approval", req: "Legal, security and the data owner" },
  ];

  return (
    <>
      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">The path to production</p>
              <h2>Seven stages, three of them human</h2>
            </div>
            <p>Automated checks catch mistakes that repeat. People catch the rest, so review is the point rather than a formality.</p>
          </div>
          <PipelineFlow />
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Stage summary</p>
              <h2>What each stage is for</h2>
            </div>
            <p>The same seven stages in prose. Select any stage in the diagram above for its gates and implementation file.</p>
          </div>
          <ol className="steps">
            {stages.map((s) => (
              <li key={s.n}>
                <div>
                  <b>{s.t}</b>
                  <span>{s.b}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Data classes</p>
              <h2>The data an app touches sets its rules</h2>
            </div>
            <p>When in doubt, the app takes the higher class until a data owner confirms otherwise.</p>
          </div>
          <div className="scroll">
            <table className="tbl">
              <thead><tr><th>Class</th><th>Examples</th><th>AI tools allowed</th><th>Required before release</th></tr></thead>
              <tbody>
                {classes.map((r) => (
                  <tr key={r.c}>
                    <td><b>{r.c}</b></td>
                    <td>{r.ex}</td>
                    <td>{r.tools}</td>
                    <td>{r.req}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="callout" style={{ marginTop: 18 }}>
            <ShieldCheck size={17} />
            <p>
              <b>Enforced in code, not in prose.</b> The class is declared in the archetype
              frontmatter, the connector declares what it may and may not expose, and the
              guardrail engine checks the output set against policy independently of the words.
              Three of the four data-class rules in this table have an executable check
              attached; the fourth is a review-stage rule and is documented as such.
            </p>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Finding triage</p>
              <h2>Every finding routes to a named owner and a clock</h2>
            </div>
            <p>A finding without a route is a note in a log, and notes in logs do not prevent the next incident.</p>
          </div>
          <div className="grid g-2">
            <div className="panel">
              <h3>Routing</h3>
              <ul className="checks" style={{ marginTop: 12 }}>
                <li className="bad"><span className="mk">1</span><span><b>Security</b> — guest safety, data exposure, or a decision made without a human. Immediate.</span></li>
                <li className="warn"><span className="mk">2</span><span><b>Data owner</b> — wrong data class, missing consent, minor targeted, unclear source. Same business day.</span></li>
                <li className="pass"><span className="mk">3</span><span><b>App steward</b> — scope, correctness, contract breach, gate failure. Next working day.</span></li>
                <li className="pass"><span className="mk">4</span><span><b>AI Enablement</b> — ambiguous or spans destinations. Same business day, then routed.</span></li>
              </ul>
            </div>
            <div className="panel">
              <h3>Severity</h3>
              <ul className="checks" style={{ marginTop: 12 }}>
                <li className="bad"><span className="mk">S1</span><span>Guest safety, data exposure, or a decision made without a human. Release blocker.</span></li>
                <li className="warn"><span className="mk">S2</span><span>Wrong in a way that affects a business decision. Ship only after the fix.</span></li>
                <li className="pass"><span className="mk">S3</span><span>Wrong but caught before use, or quality degrades. Fix before the next release.</span></li>
                <li className="pass"><span className="mk">S4</span><span>Cosmetic or documentation. Backlog.</span></li>
              </ul>
              <p style={{ color: "var(--ink-3)", fontSize: 13, lineHeight: 1.6, marginTop: 14 }}>
                An S1 is a release blocker even if the output was never sent, because the
                capability exists and will be used.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function HealthSection({ health }: { health: {
  archetypes: HealthRow[]; action_counts: Record<string, number>;
  drifted: string[]; policy: string;
} }) {
  return (
    <>
      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Archetype health monitor</p>
              <h2>The catalog evolves because something is watching it</h2>
            </div>
            <p>Usage, rewrite rate, gate failures, support load and prompt drift drive a weekly report.</p>
          </div>
          <div className="scroll">
            <table className="tbl">
              <thead>
                <tr><th>Archetype</th><th>Status</th><th className="num">Req/wk</th><th className="num">Rewrite</th><th className="num">Gate fail</th><th className="num">Prompt drift</th><th>Monitor proposes</th><th>Catalog says</th></tr>
              </thead>
              <tbody>
                {health.archetypes.map((r) => (
                  <tr key={r.name}>
                    <td><b>{r.title}</b><br /><span className="mono muted">{r.name}</span></td>
                    <td>
                      <span className={`pill ${r.status === "active" ? "ok" : r.status === "pilot" ? "accent" : r.status === "retired" ? "bad" : "warn"}`}>{r.status}</span>
                    </td>
                    <td className="num">{number(r.weekly_avg)}</td>
                    <td className="num">{pct(r.rewrite_rate * 100, 0)}</td>
                    <td className="num">{pct(r.gate_failure_rate * 100, 0)}</td>
                    <td className="num" style={{ color: r.drift_pct >= 15 ? "var(--warn)" : undefined }}>
                      {r.drift_pct > 0 ? "+" : ""}{r.drift_pct.toFixed(1)}%
                    </td>
                    <td><span className="pill accent">{r.recommended_action}</span></td>
                    <td>
                      <span className="pill">{r.catalog_decision}</span>
                      <div className="mono muted" style={{ fontSize: 11, marginTop: 5 }}>{r.reconciliation}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="callout" style={{ marginTop: 18 }}>
            <AlertTriangle size={17} />
            <p>
              <b>A disagreement is the point of having a monitor.</b> The machine sees the
              signal, the steward sees the context and decides. What must not happen is a
              silent divergence, so the report states both the proposal and the recorded
              decision, and flags the archetypes where they disagree.
            </p>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Why drift is tracked separately</p>
              <h2>Prompt bloat is how an archetype quietly degrades</h2>
            </div>
            <p>Every rule added makes the prompt longer. Past a threshold the model starts skipping rules rather than following all of them.</p>
          </div>
          <div className="split">
            <div className="panel">
              <h3>What the monitor watches</h3>
              <ul className="detail-list" style={{ marginTop: 12 }}>
                <li>Prompt size against a recorded baseline, per archetype.</li>
                <li>Human rewrite rate: how often a person rewrote the output before using it.</li>
                <li>Gate failure rate: how often a release gate blocked the output.</li>
                <li>Support questions: what kept coming up in office hours.</li>
                <li>Request volume: whether anyone is using it at all.</li>
                <li>Adversarial pass rate: whether the rules still hold against attack.</li>
              </ul>
            </div>
            <div className="panel">
              <h3>What it recommends</h3>
              <ul className="checks" style={{ marginTop: 12 }}>
                <li className="pass"><span className="mk">keep</span><span>Within every threshold. No change.</span></li>
                <li className="pass"><span className="mk">extend</span><span>Still useful but not landing cleanly. Add to the archetype rather than creating a new one.</span></li>
                <li className="warn"><span className="mk">merge</span><span>Another archetype covers the same ground. Fold them together so there is one answer per question.</span></li>
                <li className="warn"><span className="mk">review</span><span>Drift or a failure rate crossed threshold. A review before the next release.</span></li>
                <li className="bad"><span className="mk">retire</span><span>Usage collapsed or the request moved elsewhere. Retire it and record why.</span></li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function EnablementSection() {
  const areas = [
    { id: "access", name: "Access and tools", q: ["I have access to an approved AI assistant for work.", "I have used it for a real task this month."], path: "Book the first session for your role and bring one routine task from this week." },
    { id: "prompting", name: "Prompting", q: ["I can say what I want, the context, and the format I need.", "I check the output against the source before I use it."], path: "Use the context, task and format pattern on a task you have already done, then compare results." },
    { id: "data", name: "Data safety", q: ["I know which data must never go into a prompt.", "I know who to ask when I am unsure what I can share."], path: "Complete the data-safety session before any other use. It takes 20 minutes." },
    { id: "review", name: "Review habit", q: ["I read AI output before it reaches a guest or a colleague.", "I flag output that looks wrong instead of fixing it quietly."], path: "Pair with a champion for two weeks. Check every output against its source before using it." },
    { id: "sharing", name: "Sharing", q: ["I have shared a prompt or method with a colleague.", "I know where reviewed prompts live."], path: "Add one prompt that worked for you as a draft. A reviewer takes it from there." },
  ];
  const scale = ["Not yet", "A little", "Often", "Yes, routinely"];
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const scores = areas.map((a) => {
    const values = a.q.map((_, i) => answers[`${a.id}${i}`] ?? 0);
    const score = (values.reduce((x, y) => x + y, 0) / (a.q.length * 3)) * 100;
    return { ...a, score };
  });
  const lowest = scores.reduce((a, b) => (b.score < a.score ? b : a), scores[0]);

  const roles = [
    ["Venue team lead", "Shift handover notes", "Turn the incident log into a three-line handover", "Venue operations", "Shift start, 45 min"],
    ["Guest services", "Reply drafting", "Draft a reply from the approved response library", "Guest services", "Hands-on, 60 min"],
    ["Marketing", "Campaign briefs", "Build a brief from an approved audience, then run the claims check", "Marketing operations", "Hands-on, 90 min"],
    ["Finance", "Variance commentary", "Explain a revenue variance in plain language, using the numbers from the report", "Finance", "Hands-on, 60 min"],
    ["Engineering", "Review and tests", "Write a test plan for a change, then review the output against the gates", "Platform engineering", "Pairing session, 90 min"],
    ["Data and digital", "Metric definitions", "Trace a measure from source field to Gold transformation to the dashboard", "Data platform", "Walkthrough, 60 min"],
  ];

  return (
    <>
      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Readiness check</p>
              <h2>Where do you start?</h2>
            </div>
            <p>Answer honestly. Nothing is stored or sent anywhere. The result suggests a starting point.</p>
          </div>
          <div className="split">
            <div className="panel">
              {areas.map((a) => (
                <div key={a.id} style={{ marginBottom: 18 }}>
                  <h3 style={{ fontSize: 14, marginBottom: 10 }}>{a.name}</h3>
                  {a.q.map((q, i) => (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <label htmlFor={`${a.id}${i}`} style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 5 }}>{q}</label>
                      <select
                        id={`${a.id}${i}`}
                        value={answers[`${a.id}${i}`] ?? 0}
                        onChange={(e) => setAnswers({ ...answers, [`${a.id}${i}`]: Number(e.target.value) })}
                        style={{
                          width: "100%", padding: "8px 10px", background: "var(--surface-2)",
                          border: "1px solid var(--line-2)", borderRadius: 8, color: "var(--ink)",
                          fontSize: 13.5, fontFamily: "inherit",
                        }}
                      >
                        {scale.map((s, v) => <option key={s} value={v}>{s}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="panel">
              <h3>Your result</h3>
              <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
                {scores.map((s) => (
                  <div key={s.id}>
                    <div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
                      <span>{s.name}</span>
                      <span className="mono muted">{Math.round(s.score)}%</span>
                    </div>
                    <div className="bar" style={{ marginTop: 6 }}>
                      <i className={s.score < 34 ? "bad" : s.score < 67 ? "" : "good"} style={{ width: `${Math.round(s.score)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: "1px solid var(--line-2)", paddingTop: 14, marginTop: 16 }}>
                <p className="eyebrow" style={{ marginBottom: 6 }}>Suggested next step</p>
                <h3 style={{ fontSize: 15, marginBottom: 6 }}>Start with {lowest.name.toLowerCase()}</h3>
                <p style={{ color: "var(--ink-2)", fontSize: 13.5, lineHeight: 1.6 }}>{lowest.path}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Role paths</p>
              <h2>What each role does with AI first</h2>
            </div>
            <p>Each path starts with one task the role already does every week, and a first session of about an hour.</p>
          </div>
          <div className="scroll">
            <table className="tbl">
              <thead><tr><th>Role</th><th>First task</th><th>Ask an AI assistant to</th><th>Owner</th><th>First session</th></tr></thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r[0]}>
                    <td><b>{r[0]}</b></td>
                    <td>{r[1]}</td>
                    <td>{r[2]}</td>
                    <td>{r[3]}</td>
                    <td>{r[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Office hours</p>
              <h2>Raising the baseline, not just shipping the tool</h2>
            </div>
            <p>The role asks for documentation, examples and light training. These are the formats that work.</p>
          </div>
          <div className="grid g-3">
            <div className="card">
              <div className="row" style={{ marginBottom: 8 }}><BookOpen size={17} color="var(--accent)" /><h3 style={{ margin: 0 }}>Walkthrough, not a lecture</h3></div>
              <p>One archetype, end to end, in 45 minutes. Bring your own task. The session ends with you having produced something you can reuse.</p>
            </div>
            <div className="card">
              <div className="row" style={{ marginBottom: 8 }}><Users size={17} color="var(--accent)" /><h3 style={{ margin: 0 }}>Office hours</h3></div>
              <p>Thirty minutes, in a venue, on a Friday. The questions that arrive are the signal: three people asking the same thing means it belongs in the archetype.</p>
            </div>
            <div className="card">
              <div className="row" style={{ marginBottom: 8 }}><ClipboardList size={17} color="var(--accent)" /><h3 style={{ margin: 0 }}>Reviewed prompt library</h3></div>
              <p>A prompt appears only after a reviewer has checked it for accuracy, data handling and tone. Drafts stay visible but labelled, so learning is not blocked.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function EvidenceSection({ go }: { go: (id: string) => void }) {
  const rows: [string, string, string, string][] = [
    ["Design and build archetypes and skills (SKILL.md files, intake questionnaires, spec templates, code scaffolds)",
      "A versioned archetype catalog with four real SKILL.md files, a shared intake questionnaire, a spec template and a guardrails reference. A catalog validator fails the build when an archetype is missing an owner, steward, data class, connector or review date.",
      "Built and enforced", "Archetypes"],
    ["Connect agents to internal systems through governed connectors and MCP-style integrations",
      "Five approved connectors with data class, steward, never-exposes list and permitted archetypes. A working MCP server over stdio JSON-RPC that refuses any call where the named archetype may not use the named connector, and strips never-exposes fields from every row.",
      "Built and running", "Connectors"],
    ["Monitor archetypes and agents for model drift, prompt bloat and other degradation",
      "A weekly health report that measures prompt size against a recorded baseline, human rewrite rate, gate failure rate, support load and adversarial pass rate, then proposes keep, extend, merge, review or retire. It reconciles its proposal against the recorded steward decision and flags disagreement rather than silently diverging.",
      "Built and running", "Health"],
    ["Review AI agent-produced code, specs and gate results before production",
      "A review rubric organised around one question: what did the automated gates miss? Separate sections for code, specs and gate results, a severity scale tied to release disposition, and a required review record format.",
      "Built as documentation", "Pipeline"],
    ["Test archetypes and agents against adversarial prompting and implement guardrail hooks",
      "Eighteen cases across six taxonomies, executed on every pull request. A deterministic guardrail engine covering scope, output structure and data-class policy, with eleven self-test cases proving the engine catches what it claims.",
      "Built and executable", "Guardrails"],
    ["Build documentation, examples and light training to raise teams' baseline capability",
      "A readiness check that routes people to a starting point, six role paths with a first task and a first session, and three enablement formats with the reasoning for each.",
      "Built", "Enablement"],
    ["Retire, merge or extend archetypes based on usage and escalation patterns",
      "One archetype retired and merged into another because usage showed 71 percent overlap and two conflicting output formats. Three requests declined with a recorded reason and route. A recurring-finding policy turns repeated findings into archetype or platform changes.",
      "Built with recorded decisions", "Health"],
    ["Triage escalations and route findings to security, data owners or app stewards",
      "A four-way routing table with severity definitions, a written triage decision tree, a required finding format, response windows, and an escalation path when a route does not respond.",
      "Built as documentation", "Pipeline"],
    ["Explain technical tradeoffs to non-technical stakeholders in plain language",
      "Every section of this portal states what a control does, what it does not prove, and where a human decision remains. The retrieval decision document exists specifically to answer when the simple tool beats the sophisticated one.",
      "Demonstrated throughout", "Overview"],
  ];

  return (
    <>
      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Responsibility to evidence</p>
              <h2>Every responsibility in the role description, and what answers it</h2>
            </div>
            <p>Stated plainly, including where the answer is documentation rather than a running system.</p>
          </div>
          <div className="scroll">
            <table className="tbl">
              <thead><tr><th>Responsibility</th><th>What is built</th><th>State</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r[0]}>
                    <td style={{ width: "26%" }}><b>{r[0]}</b></td>
                    <td>{r[1]}</td>
                    <td>
                      <span className={`pill ${r[2].startsWith("Built and") || r[2] === "Built" ? "ok" : "accent"}`}>{r[2]}</span>
                    </td>
                    <td>
                      <button className="btn" onClick={() => go(r[3])}>
                        Open <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Honest boundaries</p>
              <h2>What this project does not do</h2>
            </div>
            <p>A reviewer should be able to check the limits as easily as the claims.</p>
          </div>
          <div className="grid g-2">
            <div className="panel">
              <h3>Implemented and executable</h3>
              <ul className="checks" style={{ marginTop: 12 }}>
                <li className="pass"><span className="mk">✓</span><span>Deterministic Python pipeline, Gold layer, 17 executed quality checks.</span></li>
                <li className="pass"><span className="mk">✓</span><span>Archetype catalog with real SKILL.md files and a validator that fails the build.</span></li>
                <li className="pass"><span className="mk">✓</span><span>MCP server over stdio with enforced connector governance and field redaction.</span></li>
                <li className="pass"><span className="mk">✓</span><span>Guardrail engine, adversarial suite, secrets scan, health monitor.</span></li>
                <li className="pass"><span className="mk">✓</span><span>Thirty-seven tests and a CI workflow that runs all of it on every pull request.</span></li>
              </ul>
            </div>
            <div className="panel">
              <h3>Documented design, not deployed systems</h3>
              <ul className="checks" style={{ marginTop: 12 }}>
                <li className="warn"><span className="mk">!</span><span>The review rubric and triage rules are guidance for a human, not enforcement in code.</span></li>
                <li className="warn"><span className="mk">!</span><span>The constrained runtime, connector auth and identity model are described, not built.</span></li>
                <li className="warn"><span className="mk">!</span><span>Archetype usage figures are synthetic, and exist to demonstrate the lifecycle logic.</span></li>
                <li className="warn"><span className="mk">!</span><span>The adversarial suite is a regression suite over a fixture, not a live red-team of a deployed archetype.</span></li>
                <li className="bad"><span className="mk">×</span><span>No Topgolf internal system was accessed. No real guest, venue, membership or campaign record exists here.</span></li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function DataSection() {
  const k = snapshot.kpis;
  const top = snapshot.venues.slice(0, 10);

  return (
    <>
      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">The fixture</p>
              <h2>What the pipeline actually produced</h2>
            </div>
            <p>
              {snapshot.metadata.coverage_days} days from {snapshot.metadata.period_start} to{" "}
              {snapshot.metadata.period_end}, seed {snapshot.metadata.seed}, rebuilt identically
              on every run.
            </p>
          </div>
          <div className="grid g-4">
            <div className="stat">
              <div className="l">Visits</div>
              <div className="v">{number(k.total_visits)}</div>
              <div className="s">Average check {money(k.avg_check)}</div>
            </div>
            <div className="stat">
              <div className="l">Active members</div>
              <div className="v">{number(k.active_members)}</div>
              <div className="s">{k.visits_per_member_per_month} visits per member per month</div>
            </div>
            <div className="stat">
              <div className="l">Campaign sends</div>
              <div className="v">{number(k.campaign_sends)}</div>
              <div className="s">Cost per booked visit {money(k.cost_per_booking)}</div>
            </div>
            <div className="stat">
              <div className="l">Incidents</div>
              <div className="v">{number(k.incidents)}</div>
              <div className="s">{number(k.high_severity_incidents)} high severity, average {k.avg_resolution_minutes} minutes to resolve</div>
            </div>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Metric catalog</p>
              <h2>Every measure, with its formula and its limitation</h2>
            </div>
            <p>A measure that will be quoted in a decision has to reconcile, and it has to say what it does not capture.</p>
          </div>
          <div className="scroll">
            <table className="tbl">
              <thead><tr><th>Metric</th><th>Formula</th><th>Grain</th><th>Owner</th><th>Limitation</th></tr></thead>
              <tbody>
                {snapshot.metric_catalog.map((m) => (
                  <tr key={m.name}>
                    <td><b>{m.name}</b><br /><span className="muted" style={{ fontSize: 12 }}>{m.description}</span></td>
                    <td className="mono" style={{ fontSize: 11.5 }}>{m.formula}</td>
                    <td>{m.grain}</td>
                    <td>{m.owner}</td>
                    <td>{m.caveat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Quality checks</p>
              <h2>{snapshot.quality.filter((q) => q.status === "PASS").length} of {snapshot.quality.length} executed and passing</h2>
            </div>
            <p>Results are embedded in the snapshot the portal renders, so the page cannot show a number that failed its own check.</p>
          </div>
          <div className="scroll">
            <table className="tbl">
              <thead><tr><th>Check</th><th>What it asserts</th><th>Observed</th><th>Status</th></tr></thead>
              <tbody>
                {snapshot.quality.map((q) => (
                  <tr key={q.name}>
                    <td><b>{q.name}</b></td>
                    <td>{q.description}</td>
                    <td className="mono" style={{ fontSize: 11.5 }}>{q.observed}</td>
                    <td><span className={`pill ${q.status === "PASS" ? "ok" : "bad"}`}>{q.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Venue performance</p>
              <h2>Top ten venues by modelled revenue</h2>
            </div>
            <p>Synthetic. Not a claim about any real venue.</p>
          </div>
          <div className="scroll">
            <table className="tbl">
              <thead>
                <tr><th>Venue</th><th>Format</th><th className="num">Visits</th><th className="num">Revenue</th><th className="num">Avg check</th><th className="num">Active members</th><th className="num">Visits/member</th><th className="num">Incidents</th></tr>
              </thead>
              <tbody>
                {top.map((v) => (
                  <tr key={v.venue_key}>
                    <td><b>{v.venue_name}</b><br /><span className="muted" style={{ fontSize: 12 }}>{v.city}, {v.state}</span></td>
                    <td><span className="pill">{v.venue_format}</span></td>
                    <td className="num">{number(v.visits)}</td>
                    <td className="num">{money(v.revenue)}</td>
                    <td className="num">{money(v.avg_check)}</td>
                    <td className="num">{number(v.active_members)}</td>
                    <td className="num">{v.visits_per_member}</td>
                    <td className="num">{number(v.incidents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}

/* ======================================================================== */
/* Architecture                                                              */
/* ======================================================================== */

function ArchitectureSection({ topology }: { topology: Topology }) {
  const byKind = useMemo(() => {
    const counts: Record<string, number> = {};
    topology.nodes.forEach((n) => {
      counts[n.kind] = (counts[n.kind] ?? 0) + 1;
    });
    return counts;
  }, [topology]);

  return (
    <>
      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Platform architecture</p>
              <h2>Every component, every connection, and who owns it</h2>
            </div>
            <p>
              {topology.stats.nodes} nodes and {topology.stats.edges} connections, generated
              from the files in this repository rather than drawn by hand.
            </p>
          </div>

          <div className="grid g-4" style={{ marginBottom: 24 }}>
            <div className="stat">
              <div className="l">Components</div>
              <div className="v">{topology.stats.nodes}</div>
              <div className="s">
                {byKind.person ?? 0} people · {byKind.registry ?? 0} registries ·{" "}
                {byKind.process ?? 0} processes · {byKind.table ?? 0} data ·{" "}
                {byKind.system ?? 0} systems
              </div>
            </div>
            <div className="stat">
              <div className="l">Connections</div>
              <div className="v">{topology.stats.edges}</div>
              <div className="s">Every one carries a payload and a named guard</div>
            </div>
            <div className="stat">
              <div className="l">MCP tools</div>
              <div className="v">{topology.stats.mcp_tools}</div>
              <div className="s">Each bound to exactly one approved connector</div>
            </div>
            <div className="stat">
              <div className="l">Gold tables</div>
              <div className="v">{topology.stats.gold_tables}</div>
              <div className="s">Four dimensions, five facts, declared grain on every one</div>
            </div>
          </div>

          <ArchitectureGraph
            nodes={topology.nodes as never}
            edges={topology.edges as never}
            layers={topology.layers as never}
          />
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">How to read the diagram</p>
              <h2>Six layers, and the rule that holds them together</h2>
            </div>
            <p>Reading order is top to bottom: the request enters at the top and the governed output leaves at the bottom.</p>
          </div>
          <div className="grid g-3">
            {topology.layers.map((layer) => {
              const members = topology.nodes.filter((n) => n.layer === layer.id);
              if (members.length === 0) return null;
              return (
                <div className="card" key={layer.id}>
                  <div className="row" style={{ marginBottom: 8 }}>
                    <span className="pill accent">{String(layer.order + 1).padStart(2, "0")}</span>
                    <h3 style={{ margin: 0 }}>{layer.label}</h3>
                    <span className="muted" style={{ marginLeft: "auto", fontSize: 12 }}>
                      {members.length} component{members.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p>{layer.description}</p>
                  <div className="tag-row" style={{ marginTop: 12 }}>
                    {members.map((m) => (
                      <span className="pill" key={m.id}>{m.label}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="callout" style={{ marginTop: 18 }}>
            <ShieldCheck size={17} />
            <p>
              <b>The rule that holds it together.</b> An archetype reaches a system only
              through a connector that is in the catalog, and only by calling an MCP tool
              that is bound to that connector. Every path from an agent to a guest is
              therefore traceable, and every one of them passes a scope check and a
              data-class check. The dashed red connections are the ones that are blocked
              by design.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

/* ======================================================================== */
/* Trace explorer                                                            */
/* ======================================================================== */

function TraceSection({ topology }: { topology: Topology }) {
  return (
    <>
      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">End-to-end request traces</p>
              <h2>Follow one request through the whole system</h2>
            </div>
            <p>
              Each step names the actor, what moved, which guard checked it, and what the
              outcome was. This is the answer to "how does everything connect".
            </p>
          </div>
          <TraceExplorer nodes={topology.nodes as never} edges={topology.edges as never} />
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Connection inventory</p>
              <h2>Every connection, and the guard that sits on it</h2>
            </div>
            <p>A connection without a guard is a place the platform can be bypassed.</p>
          </div>
          <div className="scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>From</th><th>To</th><th>Relationship</th><th>Payload</th>
                  <th>Guarded by</th><th>Kind</th>
                </tr>
              </thead>
              <tbody>
                {topology.edges.map((e) => {
                  const from = topology.nodes.find((n) => n.id === e.source);
                  const to = topology.nodes.find((n) => n.id === e.target);
                  return (
                    <tr key={e.id}>
                      <td><b>{from?.label ?? e.source}</b></td>
                      <td><b>{to?.label ?? e.target}</b></td>
                      <td>
                        {e.label}
                        <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{e.detail}</div>
                      </td>
                      <td className="mono" style={{ fontSize: 11.5 }}>{e.payload || "—"}</td>
                      <td>
                        {e.guarded_by ? (
                          <span className="pill warn">{e.guarded_by}</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <span className={`pill ${e.kind === "blocked" ? "bad" : "ok"}`}>
                          {e.kind}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}

/* ======================================================================== */
/* MCP section                                                              */
/* ======================================================================== */

function McpSection({
  tools, protocol, connectors,
}: {
  tools: Topology["mcp_tools"];
  protocol: Topology["mcp_protocol"];
  connectors: Connector[];
}) {
  return (
    <>
      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Model Context Protocol</p>
              <h2>The exact contract between an agent and a governed system</h2>
            </div>
            <p>
              A dependency-free JSON-RPC server over stdio, built so it runs inside the
              constrained runtime rather than beside it.
            </p>
          </div>
          <McpInspector tools={tools as never} protocol={protocol as never} />
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Connector to tool binding</p>
              <h2>Which archetype may call which tool</h2>
            </div>
            <p>Access is not implicit. The server checks the caller's archetype before it serves anything.</p>
          </div>
          <div className="scroll">
            <table className="tbl">
              <thead>
                <tr><th>Connector</th><th>Data class</th><th>Tools bound to it</th><th>Permitted archetypes</th><th>Never exposes</th></tr>
              </thead>
              <tbody>
                {connectors.map((c) => {
                  const bound = tools.filter((t) => t.connector === c.id);
                  return (
                    <tr key={c.id}>
                      <td><b>{c.title}</b><br /><span className="mono muted">{c.id}</span></td>
                      <td><span className="pill">{c.data_class}</span></td>
                      <td>
                        {bound.length === 0 ? (
                          <span className="muted">No tool bound</span>
                        ) : (
                          bound.map((t) => (
                            <div key={t.name} className="mono" style={{ fontSize: 12, marginBottom: 3 }}>
                              {t.name}
                            </div>
                          ))
                        )}
                      </td>
                      <td>
                        {c.allowed_archetypes.map((a) => (
                          <span className="pill info" key={a} style={{ marginRight: 4 }}>{a}</span>
                        ))}
                      </td>
                      <td>
                        {c.never_exposes.map((f) => (
                          <span className="pill bad" key={f} style={{ marginRight: 4 }}>{f}</span>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}

/* ======================================================================== */
/* Data model section                                                       */
/* ======================================================================== */

function DataModelSection({ tables }: { tables: Topology["tables"] }) {
  return (
    <>
      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Data model</p>
              <h2>Every table, its grain, and what it joins to</h2>
            </div>
            <p>
              A fact table with an ambiguous grain cannot be aggregated safely. Declaring
              the grain is what makes the numbers reconcilable.
            </p>
          </div>
          <DataModelExplorer tables={tables as never} />
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <p className="eyebrow">Medallion layers</p>
              <h2>Bronze, Silver and Gold, and what each one is for</h2>
            </div>
            <p>The layers exist so that a bad row can be traced to the point where it entered the system.</p>
          </div>
          <div className="grid g-3">
            <div className="card">
              <div className="row" style={{ marginBottom: 8 }}>
                <span className="pill" style={{ color: "#ff8f6b", borderColor: "rgba(255,143,107,0.35)" }}>Bronze</span>
              </div>
              <h3>The source-shaped extract</h3>
              <p>
                Kept exactly as it arrived, including the malformed rows. It is the
                starting point a reviewer inspects when a number looks wrong, and it is
                what makes a Silver rejection explainable.
              </p>
            </div>
            <div className="card">
              <div className="row" style={{ marginBottom: 8 }}>
                <span className="pill" style={{ color: "#b18ce8", borderColor: "rgba(177,140,232,0.35)" }}>Silver</span>
              </div>
              <h3>The typed and validated layer</h3>
              <p>
                Dates parsed, numbers typed, referential integrity enforced, duplicates
                removed. Every rejection is counted by reason, so a drop in row count is
                explainable rather than mysterious.
              </p>
            </div>
            <div className="card">
              <div className="row" style={{ marginBottom: 8 }}>
                <span className="pill" style={{ color: "#3ddc97", borderColor: "rgba(61,220,151,0.35)" }}>Gold</span>
              </div>
              <h3>The conformed dimensional model</h3>
              <p>
                Dimensions and facts with conformed keys and declared grain. This is the
                only layer the archetypes, the connectors and the analyst read, which
                means there is exactly one definition of every metric.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
