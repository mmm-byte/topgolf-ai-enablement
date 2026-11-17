"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity, ArrowUpRight, BarChart3, Boxes, BriefcaseBusiness, CheckCircle2,
  ChevronRight, CircleHelp, ClipboardList, Code2, Database, Download, Gauge,
  GitBranch, Layers3, Search, ShieldCheck, Wrench, BrainCircuit, BookOpen,
  Target, Workflow, FileCheck2, PackageCheck, Truck, CalendarDays, Info,
  Table2, LockKeyhole, Sparkles, Network, Menu, X, Warehouse, TrendingUp, Compass,
  Copy, ArrowRight, Lightbulb, SlidersHorizontal, AlertTriangle, CircleCheck
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from "recharts";
import data from "../public/data/operations.json";

type WorkOrder = {
  work_order_id: string; equipment_id: string; branch: string; equipment_type: string;
  status: string; priority: string; days_open: number; labor_revenue: number;
  parts_revenue: number; opened_date: string; model: string; year: number;
  service_revenue: number;
};
type PartsOrder = { parts_order_id: string; branch: string; qty_requested: number; qty_fulfilled: number; order_date: string; fill_rate: number };
type Rental = { contract_id: string; branch: string; equipment_id: string; start_date: string; rental_days: number; daily_rate: number; modeled_rental_revenue: number };
type Equipment = { equipment_key: number; equipment_id: string; branch_name: string; equipment_type: string; model: string; model_year: number };
type QualityCheck = { name: string; status: string; description: string; observed: string };
type Metric = { name: string; formula: string; description: string; grain: string; owner: string; caveat: string };
type BranchSummary = { branch: string; service_revenue: number; open_backlog: number; closed_work_orders: number; avg_days_to_close: number; fleet_utilization: number; parts_fill_rate: number; rental_revenue: number; rented_asset_days: number; available_asset_days: number; equipment_count: number };
const snapshot = data as unknown as {
  metadata: { period_start: string; period_end: string; coverage_days: number; source_records: Record<string, number>; refreshed_at: string; layers: Record<string, number>; gold_tables: string[] };
  branches: string[]; work_orders: WorkOrder[]; parts_orders: PartsOrder[]; rental_contracts: Rental[]; equipment: Equipment[];
  kpis: Record<string, number>; branch_summary: BranchSummary[]; monthly: { month: string; work_orders: number }[];
  metric_catalog: Metric[]; quality: QualityCheck[];
};
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
const number = (n: number) => new Intl.NumberFormat("en-US").format(n || 0);
const percent = (n: number) => `${(n || 0).toFixed(1)}%`;
const dateLabel = (s: string) => new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const periodLabel = `${dateLabel(snapshot.metadata.period_start)} – ${dateLabel(snapshot.metadata.period_end)}`;

export default function Home() {
  const [section, setSection] = useState("Overview");
  const [branch, setBranch] = useState("All branches");
  const [explorerTab, setExplorerTab] = useState("Service work orders");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [priority, setPriority] = useState("All priorities");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ title: string; value: string; definition: string; scope: string; formula: string; caveat: string } | null>(null);
  const [showAllMetrics, setShowAllMetrics] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [lineageMetric, setLineageMetric] = useState("Service revenue");
  const [partsTarget, setPartsTarget] = useState(90);
  const [backlogTarget, setBacklogTarget] = useState(20);
  const [fleetTarget, setFleetTarget] = useState(60);
  const [briefCopied, setBriefCopied] = useState(false);
  const [selectedPlaybook, setSelectedPlaybook] = useState("Service queue");
  const [completedPlaybookActions, setCompletedPlaybookActions] = useState<string[]>([]);
  const [playbookCopied, setPlaybookCopied] = useState(false);

  const scopedWork = useMemo(() => snapshot.work_orders.filter(row => branch === "All branches" || row.branch === branch), [branch]);
  const scopedParts = useMemo(() => snapshot.parts_orders.filter(row => branch === "All branches" || row.branch === branch), [branch]);
  const scopedRentals = useMemo(() => snapshot.rental_contracts.filter(row => branch === "All branches" || row.branch === branch), [branch]);
  const scopedEquipment = useMemo(() => snapshot.equipment.filter(row => branch === "All branches" || row.branch_name === branch), [branch]);
  const scopedSummary = useMemo(() => snapshot.branch_summary.filter(row => branch === "All branches" || row.branch === branch), [branch]);
  const kpis = useMemo(() => {
    const closed = scopedWork.filter(row => row.status === "Closed");
    const requested = scopedParts.reduce((sum, row) => sum + row.qty_requested, 0);
    const fulfilled = scopedParts.reduce((sum, row) => sum + row.qty_fulfilled, 0);
    const summary = scopedSummary;
    const rentedDays = summary.reduce((sum, row) => sum + row.rented_asset_days, 0);
    const availableDays = summary.reduce((sum, row) => sum + row.available_asset_days, 0);
    return {
      revenue: closed.reduce((sum, row) => sum + row.service_revenue, 0),
      closed: closed.length,
      backlog: scopedWork.filter(row => row.status !== "Closed").length,
      avgClose: closed.length ? closed.reduce((sum, row) => sum + row.days_open, 0) / closed.length : 0,
      partsFill: requested ? 100 * fulfilled / requested : 0,
      rentalRevenue: scopedRentals.reduce((sum, row) => sum + row.modeled_rental_revenue, 0),
      fleetUtil: availableDays ? 100 * rentedDays / availableDays : 0,
      rentedDays, availableDays, equipmentCount: scopedEquipment.length,
      partsRequested: requested, partsFulfilled: fulfilled,
    };
  }, [scopedWork, scopedParts, scopedRentals, scopedEquipment, scopedSummary]);

  const branchRows = useMemo(() => scopedSummary.slice().sort((a, b) => b.service_revenue - a.service_revenue), [scopedSummary]);
  const monthlyRows = useMemo(() => {
    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return monthOrder.map(month => ({
      month,
      work_orders: scopedWork.filter(row => new Date(`${row.opened_date.slice(0, 10)}T12:00:00`).toLocaleString("en-US", { month: "short" }) === month).length,
    })).filter(row => row.work_orders > 0);
  }, [scopedWork]);

  const filteredWork = useMemo(() => scopedWork.filter(row =>
    (status === "All statuses" || row.status === status) &&
    (priority === "All priorities" || row.priority === priority) &&
    [row.work_order_id, row.equipment_id, row.equipment_type, row.model, row.status, row.priority, row.branch].join(" ").toLowerCase().includes(search.toLowerCase())
  ), [scopedWork, status, priority, search]);
  const filteredParts = useMemo(() => scopedParts.filter(row =>
    [row.parts_order_id, row.branch, row.order_date].join(" ").toLowerCase().includes(search.toLowerCase())
  ), [scopedParts, search]);
  const filteredRentals = useMemo(() => scopedRentals.filter(row =>
    [row.contract_id, row.equipment_id, row.branch, row.start_date].join(" ").toLowerCase().includes(search.toLowerCase())
  ), [scopedRentals, search]);
  const filteredEquipment = useMemo(() => scopedEquipment.filter(row =>
    [row.equipment_id, row.branch_name, row.equipment_type, row.model, String(row.model_year)].join(" ").toLowerCase().includes(search.toLowerCase())
  ), [scopedEquipment, search]);

  const exportRows = () => {
    const rows = (explorerTab === "Service work orders" ? filteredWork : explorerTab === "Parts orders" ? filteredParts : explorerTab === "Rental contracts" ? filteredRentals : filteredEquipment) as unknown as Record<string, unknown>[];
    if (!rows.length) return;
    const columns = Object.keys(rows[0]);
    const csv = [columns.join(","), ...rows.map(row => columns.map(key => JSON.stringify(row[key] ?? "")).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `fieldiq-${explorerTab.toLowerCase().replaceAll(" ", "-")}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  const runAnalyst = () => {
    const q = question.trim().toLowerCase();
    if (!q) return;
    if (q.includes("backlog") || q.includes("open work") || q.includes("work order queue")) setAnswer({ title: "Open service backlog", value: number(kpis.backlog), definition: "Count of service work orders whose status is Open or In Progress.", scope: branch, formula: "COUNT(work_order_id) WHERE status <> 'Closed'", caveat: "A work-order count, not a monetary backlog valuation or SLA breach count." });
    else if (q.includes("revenue") || q.includes("service sales")) setAnswer({ title: "Closed service revenue", value: money(kpis.revenue), definition: "Modeled labor plus parts revenue on closed service work orders.", scope: branch, formula: "SUM(labor_revenue + parts_revenue) WHERE status = 'Closed'", caveat: "Synthetic modeled revenue; not an audited accounting figure." });
    else if (q.includes("average") || q.includes("days to close") || q.includes("cycle time")) setAnswer({ title: "Average days to close", value: `${kpis.avgClose.toFixed(1)} days`, definition: "Average elapsed days recorded for closed service work orders.", scope: branch, formula: "AVG(days_open) WHERE status = 'Closed'", caveat: "Excludes open work orders and uses generated elapsed-day values." });
    else if (q.includes("parts") || q.includes("fill rate")) setAnswer({ title: "Parts fill rate", value: percent(kpis.partsFill), definition: "Weighted share of requested parts units fulfilled.", scope: branch, formula: "SUM(qty_fulfilled) / SUM(qty_requested)", caveat: "Weighted by units; not an order-line on-time fill measure." });
    else if (q.includes("fleet") || q.includes("utilization")) setAnswer({ title: "Fleet utilization", value: percent(kpis.fleetUtil), definition: "Unique rented equipment-days divided by modeled available equipment-days.", scope: branch, formula: "SUM(is_rented) / SUM(is_available)", caveat: "Assumes every asset-day is available; maintenance and out-of-service periods are not modeled." });
    else if (q.includes("rental")) setAnswer({ title: "Modeled rental revenue", value: money(kpis.rentalRevenue), definition: "Synthetic contract revenue calculated from rental days and daily rate.", scope: branch, formula: "SUM(rental_days × daily_rate)", caveat: "Not a ledger, invoice, or recognized accounting amount." });
    else setAnswer({ title: "Question not mapped to an approved metric", value: "Try backlog, service revenue, average days to close, parts fill rate, fleet utilization, or rental revenue.", definition: "This demonstration intentionally answers only from its documented metric catalog.", scope: branch, formula: "No metric executed", caveat: "The analyst is a deterministic prototype, not an LLM or SQL agent." });
  };

  const nav = [
    ["Overview", Gauge], ["Decision Studio", Compass], ["Operations Playbook", ClipboardList], ["Operations Explorer", Search], ["Semantic Model", Layers3],
    ["Data Quality", ShieldCheck], ["Data Lineage", Workflow], ["AI Analyst", BrainCircuit],
    ["Role Alignment", Target], ["Architecture", Boxes],
  ] as const;
  const sectionCopy: Record<string, string> = {
    "Overview": "A business-first introduction to the operational questions, metrics, and engineering decisions behind FIELDIQ.",
    "Decision Studio": "Turn operational signals into a clear, explainable decision brief. Explore scenarios without hiding assumptions.",
    "Operations Playbook": "Turn a signal into a practical team huddle: inspect the evidence, ask the right questions, and agree on the next check.",
    "Operations Explorer": "Inspect the synthetic service, parts, rental, and equipment records behind the scorecard.",
    "Semantic Model": "Explore the fact grains, conformed dimensions, relationships, and governed business calculations.",
    "Data Quality": "Review the checks executed by the reproducible pipeline and the observed results in this build.",
    "Data Lineage": "Trace a business metric from operational source fields through Gold transformations to consumption.",
    "AI Analyst": "Ask questions against a constrained set of documented metrics and inspect the calculation returned.",
    "Role Alignment": "See how the project maps to the Business Intelligence Developer responsibilities—and what remains a design artifact.",
    "Architecture": "Understand the technology, development workflow, deployment boundary, and path toward a production platform.",
  };

  const currentCount = explorerTab === "Service work orders" ? filteredWork.length : explorerTab === "Parts orders" ? filteredParts.length : explorerTab === "Rental contracts" ? filteredRentals.length : filteredEquipment.length;
  const activeBranch = branch === "All branches" ? "All five branches" : branch;
  const highestBacklog = branchRows.slice().sort((a, b) => b.open_backlog - a.open_backlog)[0];
  const lowestFill = branchRows.slice().sort((a, b) => a.parts_fill_rate - b.parts_fill_rate)[0];
  const topRevenue = branchRows[0];
  const partsTargetUnits = Math.max(0, Math.round(kpis.partsRequested * partsTarget / 100));
  const additionalPartsUnits = Math.max(0, partsTargetUnits - kpis.partsFulfilled);
  const backlogReductionCount = Math.round(kpis.backlog * backlogTarget / 100);
  const remainingBacklog = Math.max(0, kpis.backlog - backlogReductionCount);
  const fleetTargetDays = Math.round(kpis.availableDays * fleetTarget / 100);
  const fleetGapDays = Math.max(0, fleetTargetDays - kpis.rentedDays);
  const briefText = `FIELDIQ OPERATIONS BRIEF\nScope: ${branch}\nClosed service revenue: ${money(kpis.revenue)} across ${number(kpis.closed)} closed work orders.\nOpen service backlog: ${number(kpis.backlog)} work orders.\nWeighted parts fill: ${percent(kpis.partsFill)} (${number(kpis.partsFulfilled)} of ${number(kpis.partsRequested)} units).\nFleet utilization: ${percent(kpis.fleetUtil)} (${number(kpis.rentedDays)} of ${number(kpis.availableDays)} asset-days).\nScenario: at ${partsTarget}% parts fill, ${number(additionalPartsUnits)} additional units would need to be fulfilled; a ${backlogTarget}% backlog reduction equals ${number(backlogReductionCount)} work orders; a ${fleetTarget}% utilization target is ${number(fleetGapDays)} rented asset-days above the current level.\nAll data and scenarios are synthetic and illustrative; scenarios are arithmetic targets, not causal forecasts.`;
  const agingOpenWork = scopedWork.filter(row => row.status !== "Closed").slice().sort((a, b) => b.days_open - a.days_open);
  const highPriorityOpen = agingOpenWork.filter(row => row.priority === "Critical" || row.priority === "High");
  const lowestFillOrders = scopedParts.slice().sort((a, b) => a.fill_rate - b.fill_rate);
  const playbooks = {
    "Service queue": {
      eyebrow: "SERVICE FLOW", title: "Find the work that deserves attention first",
      headline: `${number(kpis.backlog)} open work orders`, value: `${highPriorityOpen.length} high / critical priority`,
      summary: "Start with age and priority together. A large queue is not automatically a problem; the team needs to see which open jobs are both aging and operationally important.",
      evidenceTitle: "Oldest open work orders", evidence: agingOpenWork.slice(0, 5).map(row => ({ id: row.work_order_id, branch: row.branch, detail: `${row.priority} priority · ${row.status}`, value: `${number(row.days_open)} days` })),
      actions: ["Review the oldest open and in-progress work orders", "Check high- and critical-priority jobs with the service lead", "Confirm the next update and owner for the oldest jobs", "Recheck queue age after the next operating review"],
      questions: ["Which jobs are waiting on parts, technician capacity, or customer approval?", "Are the oldest jobs also the highest customer-impact jobs?", "Which work orders need an owner or next-update commitment?"],
      caveat: "The synthetic work-order data contains status, priority, and elapsed days, but does not identify the actual blocker, customer impact, technician assignment, or SLA. Treat these as review candidates, not an automated priority decision."
    },
    "Parts fulfillment": {
      eyebrow: "PARTS FLOW", title: "Separate a low fill rate from the reason behind it",
      headline: percent(kpis.partsFill), value: `${number(kpis.partsFulfilled)} of ${number(kpis.partsRequested)} units fulfilled`,
      summary: "A weighted fill rate describes how many requested units were fulfilled. The next step is to inspect the orders with the largest unit shortfalls and validate the cause with the parts team.",
      evidenceTitle: "Lowest-fill parts orders", evidence: lowestFillOrders.slice(0, 5).map(row => ({ id: row.parts_order_id, branch: row.branch, detail: `${number(row.qty_fulfilled)} / ${number(row.qty_requested)} units`, value: percent(row.fill_rate * 100) })),
      actions: ["Review orders with the lowest unit fill rates", "Compare requested and fulfilled quantities by branch", "Ask the parts team to validate stock, replenishment, and supplier status", "Confirm whether open service jobs depend on any unavailable parts"],
      questions: ["Are shortfalls concentrated in a branch, part family, or supplier?", "Are unfilled units backordered, substituted, or cancelled?", "Which service jobs are actually waiting on these parts?"],
      caveat: "The dataset has order-level requested and fulfilled quantities, but no SKU, inventory balance, supplier, promised date, or work-order-to-parts linkage. Do not infer that a low-fill order caused a service delay."
    },
    "Fleet deployment": {
      eyebrow: "RENTAL & FLEET", title: "Understand utilization before changing fleet decisions",
      headline: percent(kpis.fleetUtil), value: `${number(kpis.rentedDays)} rented of ${number(kpis.availableDays)} modeled asset-days`,
      summary: "Utilization is a portfolio signal, not a utilization target by itself. Review rental activity alongside asset mix and confirm true availability before discussing redeployment.",
      evidenceTitle: "Largest modeled rental contracts", evidence: scopedRentals.slice().sort((a, b) => b.modeled_rental_revenue - a.modeled_rental_revenue).slice(0, 5).map(row => ({ id: row.contract_id, branch: row.branch, detail: `${row.equipment_id} · ${number(row.rental_days)} days`, value: money(row.modeled_rental_revenue) })),
      actions: ["Review rental contracts and asset-days by branch", "Compare rental activity across equipment types", "Validate maintenance and out-of-service status with fleet operations", "Discuss redeployment only after confirming demand and availability"],
      questions: ["Which asset classes have the strongest rental demand?", "Are assets marked available actually ready to rent?", "Would a branch transfer create transport or service constraints?"],
      caveat: "The utilization denominator assumes every asset-day is available. Maintenance, transport, reservations, seasonal demand, and out-of-service states are not modeled, so this is not a fleet optimization recommendation."
    }
  };
  const activePlaybook = playbooks[selectedPlaybook as keyof typeof playbooks];
  const playbookBrief = `FIELDIQ TEAM HUDDLE\nPlaybook: ${selectedPlaybook}\nScope: ${branch}\nSignal: ${activePlaybook.headline} (${activePlaybook.value})\n\nEvidence to inspect:\n${activePlaybook.evidence.map(row => `- ${row.id} | ${row.branch} | ${row.detail} | ${row.value}`).join("\n")}\n\nSuggested checks:\n${activePlaybook.actions.map((item, i) => `${i + 1}. ${item}`).join("\n")}\n\nCaveat: ${activePlaybook.caveat}\nSynthetic demonstration data; validate against operational source systems before acting.`;

  return <main className="app-shell">
    <aside className={`sidebar ${mobileNavOpen ? "mobile-open" : ""}`}>
      <div className="brand"><div className="brand-mark">F</div><div><b>FIELDIQ</b><small>OPERATIONS INTELLIGENCE</small></div><button className="mobile-close" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}><X size={18}/></button></div>
      <div className="workspace"><span className="dot"/> INDEPENDENT PRODUCT DEMO <span className="workspace-tag">v4.1</span></div>
      <div className="nav-label">EXPLORE THE PROJECT</div>
      <nav aria-label="Project sections">{nav.map(([label, Icon]) => <button key={label} aria-label={label} title={label} className={`nav-item ${section === label ? "active" : ""}`} onClick={() => { setSection(label); setMobileNavOpen(false); }}><Icon size={17}/><span>{label}</span><ChevronRight className="nav-chevron" size={14}/></button>)}</nav>
      <div className="sidebar-bottom"><div className="status"><span className="green-dot"/> Synthetic snapshot loaded</div><small>Independent BI engineering demonstration · no HOLT system access</small></div>
    </aside>
    {mobileNavOpen && <button className="nav-scrim" aria-label="Close navigation overlay" onClick={() => setMobileNavOpen(false)}/>}

    <section className="main-area">
      <header className="topbar">
        <div className="topbar-title"><button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={19}/></button><div><div className="eyebrow">FIELDIQ / {section.toUpperCase()}</div><h1>{section}</h1></div></div>
        <div className="top-actions"><label className="branch-filter"><span>BRANCH SCOPE</span><select value={branch} onChange={e => setBranch(e.target.value)} aria-label="Filter all project views by branch"><option>All branches</option>{snapshot.branches.map(name => <option key={name}>{name}</option>)}</select></label><div className="avatar" title="Project author">MK</div></div>
      </header>

      <div className="demo-banner"><div className="banner-icon"><Info size={17}/></div><div><b>Independent product demonstration · Synthetic data only</b><span>FIELDIQ is a self-directed operations intelligence experience inspired by heavy-equipment dealership workflows. It is not affiliated with HOLT Group and does not access HOLT systems.</span></div></div>

      <div className="page-intro"><div><div className="eyebrow accent">FIELD OPERATIONS · DECISION INTELLIGENCE</div><h2>{section === "Overview" ? "See the operation. Understand the signal. Decide what matters." : section}</h2><p>{section === "Overview" ? "One connected view of service, parts, rental, and fleet performance — designed to make complex operational data easier to act on." : sectionCopy[section]}</p></div><div className="coverage-card"><CalendarDays size={17}/><div><small>SYNTHETIC DATA COVERAGE</small><b>{periodLabel}</b><span>{number(snapshot.metadata.coverage_days)} calendar days · 5 Texas branches</span></div></div></div>

      {section === "Overview" && <div className="content">
        <div className="story-grid">
          <div className="story-main"><span className="eyebrow">THE BUSINESS PROBLEM</span><h3>Service, parts, and rental decisions depend on the same operational truth.</h3><p>In an equipment dealership, a delayed part can keep a machine in the service bay; a stalled repair can extend downtime; and rental availability affects how effectively a fleet supports customer demand. FIELDIQ models these connected workflows and demonstrates how governed data products can give teams a consistent view of performance.</p><div className="story-tags"><span><Wrench size={14}/> Service operations</span><span><PackageCheck size={14}/> Parts fulfillment</span><span><Truck size={14}/> Rental & fleet</span><span><Warehouse size={14}/> Branch performance</span></div><div className="story-actions"><button className="story-cta" onClick={()=>setSection("Operations Playbook")}>Explore Operations Playbook <ArrowRight size={15}/></button><button className="story-cta story-cta-secondary" onClick={()=>setSection("Decision Studio")}>Open Decision Studio <ArrowRight size={15}/></button></div></div>
          <div className="story-side"><div className="side-head">Modeled synthetic records</div><div className="side-stats"><div className="side-stat"><b>{number(snapshot.metadata.source_records.work_orders)}</b><span>service work orders</span></div><div className="side-stat"><b>{number(snapshot.metadata.source_records.rental_contracts)}</b><span>rental contracts</span></div><div className="side-stat"><b>{number(snapshot.metadata.source_records.parts_orders)}</b><span>parts orders</span></div><div className="side-stat"><b>{number(snapshot.metadata.source_records.equipment)}</b><span>equipment assets</span></div></div><small>Seeded synthetic records · {snapshot.branches.length} Texas branches</small></div>
        </div>

        <div className="section-heading"><div><span className="eyebrow">EXECUTIVE OPERATIONS SCORECARD</span><h3>What is happening across {activeBranch.toLowerCase()}?</h3><p>Change the branch selector above. Every KPI, chart, explorer, and metric answer uses the same branch scope.</p></div><span className="scope-pill">{branch}</span></div>
        <div className="kpi-grid">
          <Kpi label="Closed service revenue" value={money(kpis.revenue)} detail={`${number(kpis.closed)} closed work orders`} icon={<BriefcaseBusiness/>} note="Modeled revenue · USD"/>
          <Kpi label="Open service backlog" value={number(kpis.backlog)} detail="Open + in-progress orders" icon={<ClipboardList/>} note="Count, not backlog value"/>
          <Kpi label="Fleet utilization" value={percent(kpis.fleetUtil)} detail={`${number(kpis.rentedDays)} / ${number(kpis.availableDays)} asset-days`} icon={<Gauge/>} note="Unique rented asset-days"/>
          <Kpi label="Parts fill rate" value={percent(kpis.partsFill)} detail={`${number(kpis.partsFulfilled)} / ${number(kpis.partsRequested)} units`} icon={<Boxes/>} note="Weighted by requested units"/>
          <Kpi label="Modeled rental revenue" value={money(kpis.rentalRevenue)} detail={`${number(scopedRentals.length)} rental contracts`} icon={<Truck/>} note="Contract days × daily rate"/>
        </div>

        <div className="signal-grid">
          <div className="signal-card"><div className="signal-icon gold"><TrendingUp size={17}/></div><div><small>HIGHEST CLOSED SERVICE REVENUE</small><b>{topRevenue?.branch ?? "—"}</b><span>{money(topRevenue?.service_revenue ?? 0)} modeled</span></div></div>
          <div className="signal-card"><div className="signal-icon blue"><ClipboardList size={17}/></div><div><small>LARGEST OPEN SERVICE QUEUE</small><b>{highestBacklog?.branch ?? "—"}</b><span>{number(highestBacklog?.open_backlog ?? 0)} work orders</span></div></div>
          <div className="signal-card"><div className="signal-icon green"><PackageCheck size={17}/></div><div><small>LOWEST PARTS FILL RATE</small><b>{lowestFill?.branch ?? "—"}</b><span>{percent(lowestFill?.parts_fill_rate ?? 0)} weighted fill</span></div></div>
        </div>
        <p className="signal-disclaimer">These are descriptive signals from generated records, not findings about HOLT Group or recommendations based on live operations.</p>

        <div className="grid-two">
          <Panel title="Closed service revenue by branch" subtitle="Modeled USD · closed work orders" icon={<BarChart3 size={18}/> }><div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={branchRows} margin={{top:8,right:10,left:4,bottom:0}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf2"/><XAxis dataKey="branch" tick={{fontSize:11,fill:"#667487"}} axisLine={false} tickLine={false}/><YAxis tickFormatter={v=>`$${Math.round(v/1000)}k`} tick={{fontSize:11,fill:"#667487"}} axisLine={false} tickLine={false} width={48}/><Tooltip formatter={(v:any)=>money(Number(v))}/><Bar dataKey="service_revenue" name="Service revenue" fill="#d9a526" radius={[5,5,0,0]} maxBarSize={52}/></BarChart></ResponsiveContainer></div></Panel>
          <Panel title="Service queue composition" subtitle="Current branch scope" icon={<Wrench size={18}/>}><div className="queue-list"><Queue label="Open + in progress" value={kpis.backlog} total={scopedWork.length} color="gold"/><Queue label="Closed work orders" value={kpis.closed} total={scopedWork.length} color="green"/><div className="queue-foot"><span>Average days to close</span><b>{kpis.avgClose.toFixed(1)} days</b></div></div><div className="insight-note"><Sparkles size={15}/><span>Use the explorer to inspect the records behind these service measures.</span></div></Panel>
        </div>
        <div className="grid-two">
          <Panel title="Service work order intake" subtitle="Monthly records opened · selected branch" icon={<Activity size={18}/>}><div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={monthlyRows} margin={{top:8,right:12,left:0,bottom:0}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf2"/><XAxis dataKey="month" tick={{fontSize:11,fill:"#667487"}} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{fontSize:11,fill:"#667487"}} axisLine={false} tickLine={false}/><Tooltip/><Line type="monotone" dataKey="work_orders" name="Work orders" stroke="#24374b" strokeWidth={2.5} dot={{r:3,fill:"#d9a526"}} activeDot={{r:5}}/></LineChart></ResponsiveContainer></div></Panel>
          <Panel title="Branch performance scorecard" subtitle="Revenue, backlog, parts, and fleet" icon={<Target size={18}/>}><div className="table-wrap"><table><thead><tr><th>BRANCH</th><th>REVENUE</th><th>BACKLOG</th><th>PARTS</th></tr></thead><tbody>{branchRows.map(row=><tr key={row.branch}><td>{row.branch}</td><td>{money(row.service_revenue)}</td><td><span className="count-pill">{row.open_backlog}</span></td><td>{percent(row.parts_fill_rate)}</td></tr>)}</tbody></table></div></Panel>
        </div>

        <div className="reviewer-guide"><div className="reviewer-guide-head"><div><span className="eyebrow">A QUICK TOUR FOR REVIEWERS</span><h3>What to explore next</h3><p>Each section answers a different question a BI engineering team would ask.</p></div><BookOpen size={22}/></div><div className="guide-steps"><GuideStep n="01" title="What should the team do next?" body="Explore a guided service, parts, or fleet huddle with evidence and suggested checks." action="Operations Playbook" onClick={()=>setSection("Operations Playbook")}/><GuideStep n="02" title="Can I trust the numbers?" body="Inspect metric definitions, table grains, and executed quality checks." action="Semantic Model" onClick={()=>setSection("Semantic Model")}/><GuideStep n="03" title="Can I trace the calculation?" body="Follow a measure from source fields through Gold transformations to consumption." action="Data Lineage" onClick={()=>setSection("Data Lineage")}/><GuideStep n="04" title="Does this map to the role?" body="See the implementation evidence and honest platform boundaries." action="Role Alignment" onClick={()=>setSection("Role Alignment")}/></div></div>
        <div className="explain-strip"><div><BookOpen size={18}/><b>How to interpret this scorecard</b></div><p>Revenue is modeled only for closed work orders. Backlog counts work orders not yet closed. Parts fill rate is weighted by requested units. Fleet utilization counts unique rented asset-days over assumed available asset-days; maintenance downtime is not modeled. All values are synthetic.</p></div>
      </div>}

      {section === "Decision Studio" && <div className="content">
        <div className="decision-hero">
          <div className="decision-hero-copy"><span className="eyebrow">THE OPERATING PICTURE</span><h3>From scattered signals to a shared next step.</h3><p>FIELDIQ brings service workload, parts fulfillment, and fleet activity into one decision workspace. Start with the signal, inspect the evidence, then test a target before you discuss an action.</p><div className="decision-tags"><span><CircleCheck size={14}/> Shared metric definitions</span><span><Network size={14}/> Connected workflows</span><span><SlidersHorizontal size={14}/> Transparent scenarios</span></div></div>
          <div className="decision-hero-side"><div className="pulse-label"><span className="pulse-dot"/> CURRENT DEMO SCOPE</div><strong>{number(kpis.backlog)}</strong><b>open work orders</b><small>{branch} · {periodLabel}</small><div className="pulse-rule"><span style={{width:`${kpis.backlog + kpis.closed ? kpis.backlog/(kpis.backlog+kpis.closed)*100 : 0}%`}}/></div><small>{percent(kpis.backlog + kpis.closed ? 100*kpis.backlog/(kpis.backlog+kpis.closed) : 0)} of service work is still open or in progress</small></div>
        </div>

        <div className="decision-section-head"><div><span className="eyebrow">01 / SIGNALS</span><h3>Where should the conversation start?</h3><p>These are descriptive indicators from the selected scope, not automated diagnoses.</p></div><span className="scope-pill">{branch}</span></div>
        <div className="decision-signal-grid">
          <div className="decision-signal"><div className="decision-signal-top"><span className="decision-icon amber"><PackageCheck size={17}/></span><span className="signal-chip">FULFILLMENT</span></div><small>PARTS FILL RATE</small><strong>{percent(kpis.partsFill)}</strong><p>{number(kpis.partsFulfilled)} fulfilled of {number(kpis.partsRequested)} requested units. A weighted measure across the selected scope.</p><button onClick={()=>{setSection("Operations Explorer");setExplorerTab("Parts orders");}}>Inspect parts records <ArrowRight size={14}/></button></div>
          <div className="decision-signal"><div className="decision-signal-top"><span className="decision-icon blue"><ClipboardList size={17}/></span><span className="signal-chip">SERVICE</span></div><small>OPEN SERVICE QUEUE</small><strong>{number(kpis.backlog)}</strong><p>{number(scopedWork.length)} total work orders in scope. Open and in-progress records are counted as backlog.</p><button onClick={()=>{setSection("Operations Explorer");setExplorerTab("Service work orders");setStatus("Open");}}>Inspect service queue <ArrowRight size={14}/></button></div>
          <div className="decision-signal"><div className="decision-signal-top"><span className="decision-icon green"><Truck size={17}/></span><span className="signal-chip">FLEET</span></div><small>FLEET UTILIZATION</small><strong>{percent(kpis.fleetUtil)}</strong><p>{number(kpis.rentedDays)} rented asset-days against {number(kpis.availableDays)} modeled available asset-days.</p><button onClick={()=>{setSection("Operations Explorer");setExplorerTab("Equipment");}}>Inspect equipment <ArrowRight size={14}/></button></div>
        </div>

        <div className="decision-section-head"><div><span className="eyebrow">02 / SCENARIO WORKBENCH</span><h3>What would a target look like?</h3><p>Adjust the targets to quantify the operational gap. These controls calculate arithmetic scenarios — they do not predict that one metric causes another.</p></div><span className="scope-pill">INTERACTIVE WHAT-IF</span></div>
        <div className="scenario-layout"><div className="scenario-controls">
          <div className="scenario-control"><div><b>Parts fill-rate target</b><strong>{partsTarget}%</strong></div><p>How many additional requested units would need to be fulfilled to reach this target?</p><input type="range" min="70" max="100" step="1" value={partsTarget} onChange={e=>setPartsTarget(Number(e.target.value))}/><div className="range-labels"><span>70%</span><span>100%</span></div></div>
          <div className="scenario-control"><div><b>Backlog reduction target</b><strong>{backlogTarget}%</strong></div><p>How many open or in-progress work orders represent the selected reduction?</p><input type="range" min="0" max="60" step="5" value={backlogTarget} onChange={e=>setBacklogTarget(Number(e.target.value))}/><div className="range-labels"><span>0%</span><span>60%</span></div></div>
          <div className="scenario-control"><div><b>Fleet utilization target</b><strong>{fleetTarget}%</strong></div><p>How many additional rented asset-days would reach this utilization target?</p><input type="range" min="20" max="90" step="1" value={fleetTarget} onChange={e=>setFleetTarget(Number(e.target.value))}/><div className="range-labels"><span>20%</span><span>90%</span></div></div>
          <button className="scenario-reset" onClick={()=>{setPartsTarget(90);setBacklogTarget(20);setFleetTarget(60);}}>Reset scenario</button>
        </div><div className="scenario-results"><div className="scenario-results-head"><div><span className="eyebrow">TARGET GAP ANALYSIS</span><h4>Your scenario at a glance</h4></div><Sparkles size={20}/></div>
          <div className="scenario-result-row"><div><span>Additional parts units to fulfill</span><small>At {partsTarget}% weighted fill rate</small></div><strong>{number(additionalPartsUnits)}</strong></div>
          <div className="scenario-result-row"><div><span>Work orders in reduction target</span><small>{backlogTarget}% of current backlog</small></div><strong>{number(backlogReductionCount)}</strong></div>
          <div className="scenario-result-row"><div><span>Remaining backlog after target</span><small>Illustrative count, not a schedule</small></div><strong>{number(remainingBacklog)}</strong></div>
          <div className="scenario-result-row"><div><span>Additional rented asset-days</span><small>To reach {fleetTarget}% utilization</small></div><strong>{number(fleetGapDays)}</strong></div>
          <div className="scenario-footnote"><Info size={14}/> Targets are independent. No causal relationship, revenue uplift, customer impact, or completion date is inferred from this synthetic dataset.</div>
        </div></div>

        <div className="decision-section-head"><div><span className="eyebrow">03 / LEADERSHIP HANDOFF</span><h3>A concise brief your team can discuss.</h3><p>Convert the current operating picture and scenario assumptions into a portable meeting note.</p></div><span className="scope-pill">EXPLAINABLE OUTPUT</span></div>
        <div className="brief-panel"><div className="brief-copy"><div className="brief-mark"><Lightbulb size={19}/></div><div><b>Operations review brief</b><p>Includes current measures, branch scope, and scenario targets with explicit assumptions.</p><small>Generated from the same metrics used across FIELDIQ</small></div></div><button className="primary-btn" onClick={()=>{(navigator.clipboard ? navigator.clipboard.writeText(briefText) : Promise.reject()).then(()=>{setBriefCopied(true);setTimeout(()=>setBriefCopied(false),1800);}).catch(()=>setBriefCopied(false));}}><Copy size={15}/>{briefCopied ? "Copied" : "Copy briefing"}</button><pre>{briefText}</pre></div>

        <div className="decision-principle"><AlertTriangle size={17}/><p><b>Decision quality starts with honest definitions.</b> Parts fill is weighted by units; backlog is a work-order count, not a financial valuation; fleet utilization assumes modeled available asset-days. All values are synthetic and intended to demonstrate how an operations team could frame a discussion.</p></div>
      </div>}

      {section === "Operations Playbook" && <div className="content">
        <div className="playbook-hero">
          <div><span className="eyebrow">TEAM HUDDLE · SIGNAL TO ACTION</span><h3>Make the next operating conversation more useful.</h3><p>Choose a workflow. FIELDIQ assembles the relevant synthetic evidence, suggests questions for the right team, and gives you a practical huddle checklist. It does not make the decision for the team.</p></div>
          <div className="playbook-hero-stat"><span>ACTIVE SCOPE</span><strong>{branch}</strong><small>{periodLabel} · synthetic records</small></div>
        </div>
        <div className="playbook-tabs" role="tablist" aria-label="Choose an operations playbook">{Object.keys(playbooks).map(name=><button key={name} role="tab" aria-selected={selectedPlaybook===name} className={selectedPlaybook===name?"active":""} onClick={()=>{setSelectedPlaybook(name);setCompletedPlaybookActions([]);}}>{name}</button>)}</div>
        <div className="playbook-overview"><div className="playbook-overview-copy"><span className="eyebrow">{activePlaybook.eyebrow}</span><h3>{activePlaybook.title}</h3><p>{activePlaybook.summary}</p><div className="playbook-signal"><strong>{activePlaybook.headline}</strong><span>{activePlaybook.value}</span></div></div><div className="playbook-questions"><span className="eyebrow">QUESTIONS TO BRING TO THE HUDDLE</span>{activePlaybook.questions.map((item,i)=><div key={item}><b>0{i+1}</b><span>{item}</span></div>)}</div></div>
        <div className="playbook-grid">
          <div className="panel playbook-evidence"><div className="panel-head"><div><h3>{activePlaybook.evidenceTitle}</h3><p>Record-level evidence in the current branch scope</p></div><span className="panel-icon"><Search size={18}/></span></div>{activePlaybook.evidence.length ? <div className="playbook-records">{activePlaybook.evidence.map(row=><div className="playbook-record" key={row.id}><div><b>{row.id}</b><span>{row.branch} · {row.detail}</span></div><strong>{row.value}</strong></div>)}</div> : <p className="playbook-empty">No records are available in this scope.</p>}<button className="text-btn" onClick={()=>{setSection("Operations Explorer");setExplorerTab(selectedPlaybook==="Service queue"?"Service work orders":selectedPlaybook==="Parts fulfillment"?"Parts orders":"Rental contracts");setSearch("");}}>Open underlying records <ArrowRight size={14}/></button></div>
          <div className="panel playbook-checklist"><div className="panel-head"><div><h3>Suggested team checks</h3><p>Mark items as your huddle works through them</p></div><span className="scope-pill">{completedPlaybookActions.length}/{activePlaybook.actions.length} DONE</span></div><div className="playbook-actions">{activePlaybook.actions.map((item,i)=><label className={`playbook-action ${completedPlaybookActions.includes(item)?"done":""}`} key={item}><input type="checkbox" checked={completedPlaybookActions.includes(item)} onChange={e=>setCompletedPlaybookActions(current=>e.target.checked?[...current,item]:current.filter(x=>x!==item))}/><span className="action-index">0{i+1}</span><span>{item}</span></label>)}</div><div className="playbook-progress"><span style={{width:`${completedPlaybookActions.length/activePlaybook.actions.length*100}%`}}/></div><button className="primary-btn" onClick={()=>{(navigator.clipboard?navigator.clipboard.writeText(playbookBrief):Promise.reject()).then(()=>{setPlaybookCopied(true);setTimeout(()=>setPlaybookCopied(false),1800);}).catch(()=>setPlaybookCopied(false));}}><Copy size={15}/>{playbookCopied?"Huddle brief copied":"Copy team huddle brief"}</button></div>
        </div>
        <div className="playbook-caveat"><Info size={16}/><p><b>Use this as a conversation starter, not an automated instruction.</b> {activePlaybook.caveat} All records are synthetic and must be validated against real operational systems before any action is taken.</p></div>
      </div>}

      {section === "Operations Explorer" && <div className="content">
        <div className="section-heading"><div><span className="eyebrow">OPERATIONAL RECORD INSPECTION</span><h3>Explore the records behind the metrics</h3><p>Move across service, parts, rental, and equipment entities. The global branch scope is applied to every tab.</p></div><button className="primary-btn" onClick={exportRows}><Download size={15}/> Export current view</button></div>
        <div className="explorer-tabs" role="tablist" aria-label="Operational entity"><ExplorerTab active={explorerTab === "Service work orders"} onClick={()=>{setExplorerTab("Service work orders");setSearch("");}}>Service work orders <span>{number(scopedWork.length)}</span></ExplorerTab><ExplorerTab active={explorerTab === "Parts orders"} onClick={()=>{setExplorerTab("Parts orders");setSearch("");}}>Parts orders <span>{number(scopedParts.length)}</span></ExplorerTab><ExplorerTab active={explorerTab === "Rental contracts"} onClick={()=>{setExplorerTab("Rental contracts");setSearch("");}}>Rental contracts <span>{number(scopedRentals.length)}</span></ExplorerTab><ExplorerTab active={explorerTab === "Equipment"} onClick={()=>{setExplorerTab("Equipment");setSearch("");}}>Equipment <span>{number(scopedEquipment.length)}</span></ExplorerTab></div>
        <div className="filter-bar"><div className="searchbox"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${explorerTab.toLowerCase()}…`} aria-label={`Search ${explorerTab.toLowerCase()}`}/></div>{explorerTab === "Service work orders" && <><select value={status} onChange={e=>setStatus(e.target.value)} aria-label="Filter work order status"><option>All statuses</option><option>Open</option><option>In Progress</option><option>Closed</option></select><select value={priority} onChange={e=>setPriority(e.target.value)} aria-label="Filter work order priority"><option>All priorities</option><option>Critical</option><option>High</option><option>Normal</option><option>Low</option></select></>}<span className="result-count">{number(currentCount)} matching records</span></div>
        <div className="panel"><div className="table-wrap data-table">
          {explorerTab === "Service work orders" && <table><thead><tr><th>WORK ORDER</th><th>BRANCH</th><th>EQUIPMENT</th><th>STATUS</th><th>PRIORITY</th><th>OPENED</th><th>DAYS</th><th>REVENUE</th></tr></thead><tbody>{filteredWork.slice(0,150).map(row=><tr key={row.work_order_id}><td className="mono">{row.work_order_id}</td><td>{row.branch}</td><td>{row.equipment_type}<small className="cell-sub">{row.model} · {row.equipment_id}</small></td><td><span className={`status-pill ${row.status.toLowerCase().replace(" ", "-")}`}>{row.status}</span></td><td>{row.priority}</td><td>{dateLabel(row.opened_date)}</td><td>{row.days_open}</td><td>{money(row.service_revenue)}</td></tr>)}</tbody></table>}
          {explorerTab === "Parts orders" && <table><thead><tr><th>PARTS ORDER</th><th>BRANCH</th><th>ORDER DATE</th><th>REQUESTED</th><th>FULFILLED</th><th>FILL RATE</th></tr></thead><tbody>{filteredParts.slice(0,150).map(row=><tr key={row.parts_order_id}><td className="mono">{row.parts_order_id}</td><td>{row.branch}</td><td>{dateLabel(row.order_date)}</td><td>{number(row.qty_requested)}</td><td>{number(row.qty_fulfilled)}</td><td>{percent(row.fill_rate*100)}</td></tr>)}</tbody></table>}
          {explorerTab === "Rental contracts" && <table><thead><tr><th>CONTRACT</th><th>BRANCH</th><th>EQUIPMENT</th><th>START DATE</th><th>RENTAL DAYS</th><th>DAILY RATE</th><th>MODELED REVENUE</th></tr></thead><tbody>{filteredRentals.slice(0,150).map(row=><tr key={row.contract_id}><td className="mono">{row.contract_id}</td><td>{row.branch}</td><td>{row.equipment_id}</td><td>{dateLabel(row.start_date)}</td><td>{number(row.rental_days)}</td><td>{money(row.daily_rate)}</td><td>{money(row.modeled_rental_revenue)}</td></tr>)}</tbody></table>}
          {explorerTab === "Equipment" && <table><thead><tr><th>ASSET</th><th>BRANCH</th><th>EQUIPMENT TYPE</th><th>MODEL</th><th>MODEL YEAR</th><th>DIMENSION KEY</th></tr></thead><tbody>{filteredEquipment.slice(0,150).map(row=><tr key={row.equipment_id}><td className="mono">{row.equipment_id}</td><td>{row.branch_name}</td><td>{row.equipment_type}</td><td>{row.model}</td><td>{row.model_year}</td><td>{row.equipment_key}</td></tr>)}</tbody></table>}
          {currentCount === 0 && <div className="empty-state"><Search size={20}/><b>No matching records</b><span>Try a different search term or clear the filters.</span></div>}
        </div><div className="table-foot">Showing up to {Math.min(150, currentCount)} of {currentCount} matching records. Export includes every matching row in the active tab.</div></div>
        <div className="callout"><Info size={17}/><p>These are generated sample records. They are included to demonstrate operational data exploration and traceability—not to represent actual HOLT equipment, customers, work orders, or financial performance.</p></div>
      </div>}

      {section === "Semantic Model" && <div className="content">
        <div className="section-heading"><div><span className="eyebrow">GOVERNED BUSINESS DEFINITIONS</span><h3>A reusable enterprise-style semantic model</h3><p>Separate business processes into fact tables, share conformed dimensions, declare grain, and define measures once for reuse.</p></div><span className="scope-pill">STAR SCHEMA DESIGN</span></div>
        <div className="model-intro"><div><Database size={22}/><div><b>Conformed dimensions</b><span>dim_branch · dim_equipment · dim_date</span></div></div><div className="model-facts"><div><Table2/><b>fact_work_order</b><small>1 row / work order</small></div><div><Table2/><b>fact_parts_order</b><small>1 row / parts order</small></div><div><Table2/><b>fact_rental_contract</b><small>1 row / contract</small></div><div><Table2/><b>fact_fleet_day</b><small>1 row / asset / date</small></div></div><p>Single-direction, one-to-many filtering from dimensions to facts. No fact-to-fact joins.</p></div>
        <div className="model-table-wrap"><table><thead><tr><th>TABLE</th><th>TYPE</th><th>DECLARED GRAIN</th><th>PRIMARY KEY</th><th>BUSINESS PURPOSE</th></tr></thead><tbody>
          <ModelTable name="dim_branch" type="Dimension" grain="One row per operating branch" keyName="branch_key" purpose="Shared branch context and regional rollups."/><ModelTable name="dim_equipment" type="Dimension" grain="One row per equipment asset" keyName="equipment_key" purpose="Equipment type, model, year, and branch context."/><ModelTable name="dim_date" type="Dimension" grain="One row per calendar date" keyName="date_key" purpose="Consistent date filtering and period analysis."/><ModelTable name="fact_work_order" type="Fact" grain="One row per service work order" keyName="work_order_id" purpose="Service status, priority, elapsed days, and modeled revenue."/><ModelTable name="fact_parts_order" type="Fact" grain="One row per parts order" keyName="parts_order_id" purpose="Requested and fulfilled quantities for weighted fill rate."/><ModelTable name="fact_rental_contract" type="Fact" grain="One row per rental contract" keyName="contract_id" purpose="Contract duration, rate, and modeled rental revenue."/><ModelTable name="fact_fleet_day" type="Fact" grain="One row per equipment asset per calendar day" keyName="equipment_key + date_key" purpose="Unique rented asset-days and modeled available asset-days."/>
        </tbody></table></div>
        <div className="relationship-panel"><div className="panel-title"><div><h3>Relationship contract</h3><p>Expected Power BI relationship direction and cardinality.</p></div><span className="scope-pill">1 → MANY</span></div><div className="relationship-grid"><Relationship from="dim_branch.branch_key" to="fact_work_order.branch_key"/><Relationship from="dim_branch.branch_key" to="fact_parts_order.branch_key"/><Relationship from="dim_branch.branch_key" to="fact_rental_contract.branch_key"/><Relationship from="dim_branch.branch_key" to="fact_fleet_day.branch_key"/><Relationship from="dim_equipment.equipment_key" to="fact_work_order.equipment_key"/><Relationship from="dim_equipment.equipment_key" to="fact_rental_contract.equipment_key"/><Relationship from="dim_equipment.equipment_key" to="fact_fleet_day.equipment_key"/><Relationship from="dim_date.date_key" to="fact_work_order.opened_date_key"/><Relationship from="dim_date.date_key" to="fact_parts_order.order_date_key"/><Relationship from="dim_date.date_key" to="fact_rental_contract.start_date_key"/><Relationship from="dim_date.date_key" to="fact_fleet_day.date_key"/></div><p className="model-note">Use single-direction filtering from dimensions to facts. Validate role-playing date dimensions and active/inactive relationships when implementing the model in Power BI.</p></div>
        <div className="panel metric-panel"><div className="panel-title"><div><h3>Approved metric catalog</h3><p>Business owner, formula, grain, and interpretation caveat are explicit.</p></div><span className="scope-pill">{snapshot.metric_catalog.length} METRICS</span></div><div className="metric-grid">{snapshot.metric_catalog.slice(0, showAllMetrics ? undefined : 4).map(metric=><div className="metric-card" key={metric.name}><div className="metric-owner">{metric.owner}</div><b>{metric.name}</b><code>{metric.formula}</code><p>{metric.description}</p><small>GRAIN · {metric.grain}</small><div className="metric-caveat"><Info size={13}/>{metric.caveat}</div></div>)}</div><button className="text-btn" onClick={()=>setShowAllMetrics(v=>!v)}>{showAllMetrics ? "Show fewer metrics" : "Show all metric definitions"}<ChevronRight size={14}/></button></div>
        <div className="callout"><Info size={17}/><p><b>Implementation boundary:</b> the Gold dimensional CSVs and metric definitions are implemented. The DAX library and model specification are starter assets; a published Microsoft Fabric / Power BI semantic model is not included.</p></div>
      </div>}

      {section === "Data Quality" && <div className="content">
        <div className="section-heading"><div><span className="eyebrow">VALIDATE BEFORE CONSUME</span><h3>Data quality & reconciliation</h3><p>The Python pipeline executes these checks during a deterministic build and embeds the observed results in the web snapshot.</p></div><span className={`quality-summary ${snapshot.quality.every(check=>check.status === "PASS") ? "good" : "bad"}`}><CheckCircle2 size={16}/>{snapshot.quality.filter(check=>check.status === "PASS").length} / {snapshot.quality.length} passed</span></div>
        <div className="quality-overview"><div><b>{snapshot.quality.filter(check=>check.status === "PASS").length}</b><span>checks passed</span></div><div><b>{snapshot.quality.filter(check=>check.status !== "PASS").length}</b><span>checks failed</span></div><div><b>{number(snapshot.metadata.source_records.work_orders)}</b><span>work orders evaluated</span></div><div><b>{number(snapshot.metadata.source_records.equipment)}</b><span>equipment assets</span></div></div>
        <div className="panel quality-panel"><div className="panel-title"><div><h3>Executed validation checks</h3><p>Observed output from the latest committed deterministic build · seed 58.</p></div><span className="scope-pill">{snapshot.metadata.refreshed_at}</span></div><div className="quality-list">{snapshot.quality.map(check=><div className="quality-row" key={check.name}><div className={`quality-icon ${check.status.toLowerCase()}`}>{check.status === "PASS" ? <CheckCircle2 size={18}/> : <CircleHelp size={18}/>}</div><div className="quality-copy"><b>{check.name}</b><p>{check.description}</p><small>OBSERVED · {check.observed}</small></div><span className={`quality-status ${check.status.toLowerCase()}`}>{check.status}</span></div>)}</div></div>
        <div className="callout"><Code2 size={17}/><p>Reproduce locally with <code>python scripts/build_pipeline.py</code>, then run <code>pytest -q</code>. The page shows the latest committed pipeline run; it is not a live monitoring service.</p></div>
      </div>}

      {section === "Data Lineage" && <div className="content">
        <div className="section-heading"><div><span className="eyebrow">TRACEABILITY & BUSINESS CONTEXT</span><h3>Follow a KPI from source to consumption</h3><p>Select a measure to inspect its source fields, transformations, Gold grain, and reporting use.</p></div><span className="scope-pill">END-TO-END LINEAGE</span></div>
        <div className="lineage-select">{["Service revenue", "Parts fill rate", "Fleet utilization"].map(item=><button key={item} className={lineageMetric === item ? "selected" : ""} onClick={()=>setLineageMetric(item)}>{item}</button>)}</div>
        <div className="lineage-flow">{(lineageMetric === "Service revenue" ? [
          ["01","Synthetic source","work_orders.csv","work_order_id · status · labor_revenue · parts_revenue","Source record"],["02","Bronze","bronze/work_orders.csv","Source-shaped extract; no business aggregation","Raw layer"],["03","Silver","silver/work_orders.csv","Typed fields; equipment attributes joined by equipment_id","Standardized"],["04","Gold","fact_work_order","Conformed keys; service_revenue = labor + parts","Fact grain"],["05","Semantic measure","Service Revenue","Sum service_revenue for Closed work orders","Governed metric"],["06","Consumption","FIELDIQ scorecard","Branch-scoped KPI and branch comparison","Dashboard"]
        ] : lineageMetric === "Parts fill rate" ? [
          ["01","Synthetic source","parts_orders.csv","parts_order_id · qty_requested · qty_fulfilled · branch","Source record"],["02","Bronze","bronze/parts_orders.csv","Source-shaped parts order extract","Raw layer"],["03","Silver","silver/parts_orders.csv","Numeric validation; requested quantity must be positive","Standardized"],["04","Gold","fact_parts_order","Conformed branch/date keys; row fill ratio retained","Fact grain"],["05","Semantic measure","Parts Fill Rate","SUM(qty_fulfilled) / SUM(qty_requested)","Weighted metric"],["06","Consumption","FIELDIQ scorecard","Branch-scoped weighted fill rate, not average row ratio","Dashboard"]
        ] : [
          ["01","Synthetic source","rental_contracts.csv","contract_id · equipment_id · start_date · rental_days","Source record"],["02","Bronze","bronze/rental_contracts.csv","Source-shaped contract extract","Raw layer"],["03","Silver","silver/rental_contracts.csv","Typed dates and duration; equipment reference validated","Standardized"],["04","Gold","fact_fleet_day","One row per equipment per date; overlapping rentals counted once","Daily fact"],["05","Semantic measure","Fleet Utilization","SUM(is_rented) / SUM(is_available)","Asset-day metric"],["06","Consumption","FIELDIQ scorecard","Unique rented asset-days over assumed available asset-days","Dashboard"]
        ]).map((step,i)=><div className="lineage-step" key={step[0]}><div className="lineage-icon">{[<Database/>,<Layers3/>,<FileCheck2/>,<Table2/>,<Network/>,<Gauge/>][i]}</div><div className="lineage-copy"><small>{step[0]} / {step[2]}</small><b>{step[1]}</b><p>{step[3]}</p><span>{step[4]}</span></div>{i<5&&<ChevronRight className="lineage-arrow" size={17}/>}</div>)}</div>
        <div className="grid-two"><Panel title="Transformation and validation contract" subtitle={lineageMetric}><ul className="detail-list">{(lineageMetric === "Service revenue" ? ["Join work orders to equipment using equipment_id.","Resolve branch_key, equipment_key, and opened_date_key.","Calculate service_revenue = labor_revenue + parts_revenue.","Recognize modeled service revenue only for Closed work orders.","Reconcile the Silver component sum to the Gold measure input."] : lineageMetric === "Parts fill rate" ? ["Validate qty_requested > 0.","Validate 0 ≤ qty_fulfilled ≤ qty_requested.","Resolve branch_key and order_date_key.","Aggregate units before dividing; do not average row percentages."] : ["Expand each contract into its active asset-date range.","Create one row per equipment_key + date_key.","Count an asset-day as rented if one or more contracts overlap.","Use assumed available asset-days as denominator; exclude no maintenance time because none is modeled."]).map(item=><li key={item}>{item}</li>)}</ul></Panel><Panel title="Current scoped result" subtitle={`${lineageMetric} · ${branch}`}><div className="recon-number">{lineageMetric === "Service revenue" ? money(kpis.revenue) : lineageMetric === "Parts fill rate" ? percent(kpis.partsFill) : percent(kpis.fleetUtil)}</div><p className="muted">Calculated from the same branch-scoped synthetic records used in the overview.</p><div className="recon-rule"><CheckCircle2 size={16}/> Definition and grain are documented in the metric catalog.</div><small className="muted">This is a demonstration result, not an audited operational KPI.</small></Panel></div>
      </div>}

      {section === "AI Analyst" && <div className="content">
        <div className="section-heading"><div><span className="eyebrow">GOVERNED ANALYTICS CONSUMPTION</span><h3>Ask the approved metric layer</h3><p>Questions are mapped to documented measures, then calculated against the same branch scope as the scorecard.</p></div><span className="scope-pill">DETERMINISTIC PROTOTYPE</span></div>
        <div className="analyst-layout"><div className="panel analyst-main"><div className="analyst-icon"><BrainCircuit size={24}/></div><h3>What would you like to understand?</h3><p>Try a question about service backlog, service revenue, parts fulfillment, fleet utilization, or rental revenue.</p><div className="prompt-row"><input value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>e.key === "Enter" && runAnalyst()} placeholder="e.g. Which branch has the largest service backlog?" aria-label="Ask about a governed metric"/><button onClick={runAnalyst}>Run metric</button></div><div className="suggestions">{["Show service backlog", "What is service revenue?", "Average days to close", "What is parts fill rate?", "Show fleet utilization", "Show rental revenue"].map(text=><button key={text} onClick={()=>setQuestion(text)}>{text}</button>)}</div>{answer && <div className="answer"><div className="answer-label">APPROVED METRIC RESULT <span>{answer.scope}</span></div><h2>{answer.value}</h2><b>{answer.title}</b><p>{answer.definition}</p><code>{answer.formula}</code><small>{answer.caveat}</small></div>}</div>
          <div className="panel analyst-side"><h3>How this analyst works</h3><div className="analyst-step"><span>01</span><div><b>Intent mapping</b><p>Question text is matched to a small supported metric vocabulary.</p></div></div><div className="analyst-step"><span>02</span><div><b>Governed calculation</b><p>The metric is computed from local synthetic records using the documented formula.</p></div></div><div className="analyst-step"><span>03</span><div><b>Explain the result</b><p>Definition, formula, branch scope, and caveat are shown with the answer.</p></div></div><div className="callout compact"><Info size={15}/><p>No LLM, arbitrary SQL generation, external data access, or Fabric integration is configured. This is a transparent rules-based prototype illustrating how governed measures can be consumed by an AI experience.</p></div></div></div>
      </div>}

      {section === "Role Alignment" && <div className="content">
        <div className="section-heading"><div><span className="eyebrow">HOLT GROUP · BUSINESS INTELLIGENCE DEVELOPER</span><h3>Job responsibility → project evidence</h3><p>This evidence map uses the responsibilities and skills in the supplied job description. It distinguishes implemented work from starter assets and production capabilities not deployed.</p></div><span className="scope-pill">REVIEWER EVIDENCE MAP</span></div>
        <div className="alignment-summary"><div><b>Implemented</b><strong>Core data pipeline, dashboard, source exploration, metric definitions, and validation.</strong></div><div><b>Starter / design</b><strong>SQL, DAX, semantic model specification, and RLS design pattern.</strong></div><div><b>Not deployed</b><strong>Fabric workspace, published Power BI model, identity security, and Azure DevOps release pipeline.</strong></div></div>
        <div className="alignment-list">{[
          ["Translate business requirements into technical models","Operational questions are converted into KPI definitions, table grains, business ownership, formulas, and caveats.","Implemented in demo","Semantic Model"],
          ["Collaborate with Data Engineering on source mapping and transformation rules","Five synthetic source entities are typed, enriched, validated, and transformed through Bronze, Silver, and Gold.","Implemented as a reproducible local pipeline","Architecture"],
          ["Define Gold data products for semantic and downstream consumption","Seven Gold tables include conformed dimensions and service, parts, rental, and fleet-day facts.","Implemented as CSV dimensional outputs","Semantic Model"],
          ["Validate Gold data against business requirements and source logic","Ten executable checks cover uniqueness, controlled values, measures, referential integrity, reconciliation, and fleet-day grain.","Executed in pipeline · results embedded","Data Quality"],
          ["Design dimensional and reusable semantic models","Three conformed dimensions connect to four fact tables with declared grain and relationship guidance.","Model artifacts implemented · not published to Fabric","Semantic Model"],
          ["Develop standardized DAX measures and business calculations","DAX starter library includes service revenue, backlog, cycle time, weighted parts fill, rental revenue, and fleet utilization.","Starter measures · not validated in a Power BI model","Architecture"],
          ["Add metadata, descriptions, hierarchies, and business definitions","Metric catalog includes formula, owner, grain, description, and limitations; model specification documents relationships.","Implemented as documentation and metadata","Semantic Model"],
          ["Support specialized downstream models and multiple consumption experiences","Separate fact tables and conformed dimensions are designed for reuse; web overview and analyst prototype consume common metrics.","Design demonstrated · no deployed downstream Power BI reports","Architecture"],
          ["Optimize for performance, scalability, usability, and maintainability","The model avoids fact-to-fact joins and uses a daily fact for fleet utilization; current dataset is intentionally small.","Foundational design · no Fabric performance benchmark","Semantic Model"],
          ["Implement RLS, OLS, and access control","A branch-level RLS pattern and identity mapping considerations are documented.","Design only · no identity enforcement in public demo","Architecture"],
          ["Document lineage, transformation logic, dependencies, and standards","Interactive lineage traces service, parts, and fleet metrics through each layer.","Implemented for three representative KPIs","Data Lineage"],
          ["Use Git, code review, and CI/CD across environments","GitHub Actions runs Python tests and a Next.js production build on pushes and pull requests.","GitHub Actions included · Azure DevOps not configured","Architecture"],
          ["Enable AI and advanced analytics consumption","A constrained analyst prototype consumes governed metrics and exposes formulas and caveats.","Rules-based prototype · no LLM or data-science integration","AI Analyst"],
          ["Communicate technical concepts to business users","Each section explains business context, calculation logic, evidence, and production limitations.","Demonstrated in project documentation and UI","Overview"],
        ].map((row,i)=><div className="alignment-row" key={row[0]}><div className="alignment-num">{String(i+1).padStart(2,"0")}</div><div className="alignment-copy"><b>{row[0]}</b><p>{row[1]}</p><small>{row[2]}</small></div><button onClick={()=>setSection(row[3])}>{row[3]} <ChevronRight size={14}/></button></div>)}</div>
        <div className="callout"><Target size={17}/><p><b>Why this project exists:</b> to demonstrate how operational business language becomes a governed, reusable analytical product—not just a collection of dashboard visuals. The project is tailored to the role's architecture and modeling responsibilities while being explicit about platform capabilities not deployed.</p></div>
      </div>}

      {section === "Architecture" && <div className="content">
        <div className="section-heading"><div><span className="eyebrow">ENGINEERING WORKFLOW</span><h3>How FIELDIQ is built and how it could mature</h3><p>A reproducible local data-engineering pipeline, explicit model contracts, and a deployed web consumption layer.</p></div><span className="scope-pill">MEDALLION ARCHITECTURE</span></div>
        <div className="architecture-stack">{[
          {title:"Operational source generator",tag:"PYTHON · DETERMINISTIC SEED 58",desc:"Creates synthetic branches, equipment assets, service work orders, rental contracts, and parts orders."},
          {title:"Bronze · source-shaped extracts",tag:"5 CSV ENTITIES",desc:"Persists source-shaped records before business transformations, retaining an inspectable starting point."},
          {title:"Silver · standardized entities",tag:"PANDAS · TYPING / ENRICHMENT",desc:"Parses dates and numeric values, enriches work orders with equipment context, and validates entity relationships."},
          {title:"Gold · dimensional data products",tag:"3 DIMENSIONS · 4 FACTS",desc:"Builds conformed branch, equipment, and date dimensions plus service, parts, rental-contract, and fleet-day facts."},
          {title:"Semantic & consumption layer",tag:"DAX STARTER · NEXT.JS",desc:"Defines reusable measures and exposes operational views, source exploration, metric lineage, and a constrained analyst prototype."},
        ].map((step,i)=><div className="architecture-step" key={step.title}><div className="architecture-index">0{i+1}</div><div className="architecture-copy"><b>{step.title}</b><p>{step.desc}</p></div><span>{step.tag}</span></div>)}</div>
        <div className="grid-two"><Panel title="Implemented technology" subtitle="Included in this repository"><div className="stack-tags">{["Python 3.10+", "Pandas", "PostgreSQL-style SQL", "Next.js 14", "React 18", "TypeScript", "Recharts", "Pytest", "GitHub Actions", "DAX starter"].map(item=><span key={item}>{item}</span>)}</div></Panel><Panel title="Fabric / Power BI implementation path" subtitle="A practical production extension plan"><ol className="detail-list numbered"><li>Land source extracts in a Fabric Lakehouse Bronze zone.</li><li>Use Fabric notebooks or Dataflows to standardize Silver entities and apply data contracts.</li><li>Materialize Gold dimensions and facts, including the daily fleet availability fact.</li><li>Publish a certified semantic model with documented measures, descriptions, hierarchies, and date roles.</li><li>Configure RLS / OLS, workspace permissions, and deployment pipelines for Dev → Test → Prod.</li><li>Connect Power BI reports and approved AI experiences to the governed model.</li></ol></Panel></div>
        <div className="implementation-grid"><div><CheckCircle2/><b>Implemented</b><p>Python pipeline, seven Gold tables, ten executed quality checks, web dashboard, metric catalog, data lineage, tests, and GitHub Actions workflow.</p></div><div><Info/><b>Starter / design</b><p>SQL examples, DAX measure library, semantic model relationship specification, and branch RLS pattern.</p></div><div><LockKeyhole/><b>Not claimed</b><p>No live HOLT data, Microsoft Fabric workspace, published Power BI model, production identity security, or LLM service.</p></div></div>
        <div className="repo-panel"><div><GitBranch size={20}/><div><b>Source-controlled engineering project</b><span>Includes reproducible pipeline code, SQL, DAX, tests, workflow configuration, and setup instructions.</span></div></div><div className="repo-links"><a href="https://github.com/mmm-byte/holt-fieldiq-operations-intelligence" target="_blank" rel="noreferrer">GitHub repository <ArrowUpRight size={14}/></a><a href="https://vercel.com" target="_blank" rel="noreferrer">Vercel deployment <ArrowUpRight size={14}/></a></div></div>
      </div>}

      <footer className="site-footer"><div><b>FIELDIQ</b><span>INDEPENDENT OPERATIONS INTELLIGENCE PRODUCT DEMO</span></div><span>SYNTHETIC DATA · NOT HOLT SYSTEMS · {periodLabel}</span></footer>
    </section>
  </main>;
}

function Kpi({label,value,detail,icon,note}: {label:string;value:string;detail:string;icon:ReactNode;note:string}) { return <div className="kpi-card"><div className="kpi-head"><span>{label}</span><div className="kpi-icon">{icon}</div></div><strong>{value}</strong><p>{detail}</p><small>{note}</small></div>; }
function Panel({title,subtitle,icon,children}: {title:string;subtitle:string;icon?:ReactNode;children:ReactNode}) { return <div className="panel"><div className="panel-head"><div><h3>{title}</h3><p>{subtitle}</p></div>{icon && <span className="panel-icon">{icon}</span>}</div>{children}</div>; }
function Queue({label,value,total,color}: {label:string;value:number;total:number;color:string}) { const width=total?value/total*100:0; return <div className="queue-item"><div><span>{label}</span><b>{number(value)}</b></div><div className="track"><div className={color} style={{width:`${width}%`}}/></div></div>; }
function ExplorerTab({active,onClick,children}: {active:boolean;onClick:()=>void;children:ReactNode}) { return <button role="tab" aria-selected={active} className={`explorer-tab ${active?"active":""}`} onClick={onClick}>{children}</button>; }
function ModelTable({name,type,grain,keyName,purpose}: {name:string;type:string;grain:string;keyName:string;purpose:string}) { return <tr><td><b className="mono">{name}</b></td><td><span className={`type-tag ${type.toLowerCase()}`}>{type}</span></td><td>{grain}</td><td className="mono">{keyName}</td><td>{purpose}</td></tr>; }
function Relationship({from,to}: {from:string;to:string}) { return <div className="relationship-row"><span className="mono">{from}</span><span className="relationship-arrow">1 → *</span><span className="mono">{to}</span></div>; }
function GuideStep({n,title,body,action,onClick}: {n:string;title:string;body:string;action:string;onClick:()=>void}) { return <div className="guide-step"><span>{n}</span><div><b>{title}</b><p>{body}</p><button onClick={onClick}>{action} <ChevronRight size={14}/></button></div></div>; }
