"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck, Sparkles, User, Users } from "lucide-react";
import type { TopoEdge, TopoNode } from "./types";

type Step = {
  hop: number;
  actor: string;
  actorKind: "person" | "system";
  action: string;
  detail: string;
  payload: string;
  guard: string;
  outcome: string;
  nodeId?: string;
};

const SCENARIOS: { id: string; label: string; question: string; steps: Step[] }[] = [
  {
    id: "handover",
    label: "Shift handover request",
    question: "A venue team lead asks for a handover at the end of a shift. What happens, step by step?",
    steps: [
      {
        hop: 1, actor: "Venue team lead", actorKind: "person",
        action: "Asks for a handover",
        detail: "The request names the venue and the shift. It does not name a guest, because the archetype is not designed to accept one.",
        payload: "shift context", guard: "none", outcome: "Request accepted", nodeId: "exp.builder",
      },
      {
        hop: 2, actor: "Archetype catalog", actorKind: "system",
        action: "Matches the request to an archetype",
        detail: "The shift-handover archetype is the active match. The catalog also records its data class, connector binding, steward and the last decision taken on it.",
        payload: "shift-handover v1.4.0", guard: "catalog validator", outcome: "Archetype selected", nodeId: "cat.archetypes",
      },
      {
        hop: 3, actor: "Agent runtime", actorKind: "system",
        action: "Loads the archetype",
        detail: "The runtime loads the SKILL.md instructions and the guardrail manifest. The manifest declares the five fields this archetype may read and the four it must never read.",
        payload: "SKILL.md + guardrails.json", guard: "scope check", outcome: "Archetype loaded", nodeId: "rt.agent",
      },
      {
        hop: 4, actor: "MCP server", actorKind: "system",
        action: "Authorises the connector",
        detail: "The archetype declares ops.readonly. The server confirms that archetype is in that connector's permitted list before it will serve the call.",
        payload: "ops.readonly", guard: "connector permission", outcome: "Connector authorised", nodeId: "rt.mcp",
      },
      {
        hop: 5, actor: "Gold metric layer", actorKind: "system",
        action: "Returns the shift incident log",
        detail: "Read-only. The server strips every field on the connector's never_exposes list from each row before the payload leaves it, so guest names cannot reach the model even if the table contains them.",
        payload: "incident_id, category, severity, resolution_minutes, escalated", guard: "never_exposes redaction", outcome: "Log returned", nodeId: "data.gold",
      },
      {
        hop: 6, actor: "Guardrail engine", actorKind: "system",
        action: "Checks the generated output",
        detail: "Three checks. Scope: only declared fields were read. Output: three lines, forty words each, no prohibited pattern. Policy: the output set respects the data class.",
        payload: "output + touched fields", guard: "scope, output, policy", outcome: "No blocking finding", nodeId: "rt.guard",
      },
      {
        hop: 7, actor: "Adversarial suite", actorKind: "system",
        action: "Confirms the rules still hold",
        detail: "The archetype's rules are exercised against injection, jailbreak and exfiltration cases. A rule that stopped holding would flip a case to missed and block the pipeline.",
        payload: "18 cases", guard: "regression suite", outcome: "18 of 18 caught", nodeId: "rt.adversarial",
      },
      {
        hop: 8, actor: "Reviewer", actorKind: "person",
        action: "Reviews before release",
        detail: "The reviewer answers one question: what did the automated gates miss? This stage is human because some rules cannot be automated honestly.",
        payload: "gate results", guard: "review rubric", outcome: "Approved with a record", nodeId: "exp.reviewer",
      },
      {
        hop: 9, actor: "App steward", actorKind: "person",
        action: "Monitors after release",
        detail: "Usage, rewrite rate, gate failures and prompt drift are tracked weekly. The monitor proposes an action; the steward decides and records it in the catalog.",
        payload: "health report", guard: "steward sign-off", outcome: "Catalog decision recorded", nodeId: "exp.steward",
      },
    ],
  },
  {
    id: "campaign",
    label: "Campaign brief request",
    question: "A marketer asks for a campaign brief targeting a segment. What happens, step by step?",
    steps: [
      {
        hop: 1, actor: "Marketer", actorKind: "person",
        action: "Submits the intake",
        detail: "The offer, the goal, the audience definition and the proposed copy. The intake asks for the data class before anything is built.",
        payload: "intake answers", guard: "intake questionnaire", outcome: "Intake complete", nodeId: "exp.builder",
      },
      {
        hop: 2, actor: "Consent-checked audience service", actorKind: "system",
        action: "Returns only eligible guests",
        detail: "The connector itself refuses to return a row where consent is absent or the guest is in the 13-17 band. This gate is independent of the archetype, so a bug in the archetype cannot leak a minor.",
        payload: "guest_key, age_band, tier", guard: "consent gate + minor exclusion", outcome: "Consented audience only", nodeId: "src.marketing.readonly",
      },
      {
        hop: 3, actor: "Guardrail engine", actorKind: "system",
        action: "Re-checks the output set",
        detail: "The policy check runs over the records rather than the words. A policy violation is often invisible in the output text, so it is checked over the set.",
        payload: "output set", guard: "policy check", outcome: "No minor, no unconsented guest", nodeId: "rt.guard",
      },
      {
        hop: 4, actor: "Claims check", actorKind: "system",
        action: "Marks every claim",
        detail: "Each claim in the copy is marked supported, unsupported, or needing legal review. An unsupported claim is reported rather than quietly dropped, because a marketer needs to see the gap.",
        payload: "claim, status, source", guard: "output schema", outcome: "Claims surfaced", nodeId: "rt.guard",
      },
      {
        hop: 5, actor: "Legal", actorKind: "person",
        action: "Reviews superlatives",
        detail: "Any superlative or unsupported discount claim routes to legal regardless of whether it might be true. The archetype cannot approve its own copy.",
        payload: "claims check", guard: "escalation rule", outcome: "Legal decision recorded", nodeId: "exp.dataowner",
      },
      {
        hop: 6, actor: "Marketer", actorKind: "person",
        action: "Sends the campaign",
        detail: "The archetype produces a brief and a checklist. It never sends. A human sends it, which is why the human approval step is not optional.",
        payload: "brief + checklist", guard: "scope rule", outcome: "Campaign sent by a person", nodeId: "exp.guest",
      },
    ],
  },
  {
    id: "incident",
    label: "Safety incident handling",
    question: "A high severity incident appears in the log. What happens, step by step?",
    steps: [
      {
        hop: 1, actor: "Archetype", actorKind: "system",
        action: "Produces the handover line",
        detail: "The severity comes from the log's own field. The archetype does not re-rank items, because re-ranking is how a safety issue gets quietly deprioritised.",
        payload: "severity, category", guard: "no priority invention", outcome: "Handover produced", nodeId: "rt.agent",
      },
      {
        hop: 2, actor: "Guardrail engine", actorKind: "system",
        action: "Refuses the automated decision",
        detail: "A request to mark an incident closed, or to resolve it without a human, is refused. Automated safety triage is not a capability that exists in this platform.",
        payload: "refusal", guard: "rule refusal", outcome: "Request refused", nodeId: "rt.guard",
      },
      {
        hop: 3, actor: "Escalation triage", actorKind: "system",
        action: "Routes the finding",
        detail: "A guest safety finding is S1 and routes to Security immediately, regardless of whether the output was ever sent. The capability exists and will be used.",
        payload: "S1 finding", guard: "severity rules", outcome: "Routed to Security", nodeId: "rt.triage",
      },
      {
        hop: 4, actor: "Security", actorKind: "person",
        action: "Decides",
        detail: "Security owns the decision and the policy change that follows. The platform's own policy registry can be changed by a finding, which changes what the gates enforce next time.",
        payload: "finding + impact", guard: "response window", outcome: "Decision and policy change", nodeId: "exp.security",
      },
      {
        hop: 5, actor: "Catalog", actorKind: "system",
        action: "Records the new rule",
        detail: "If the incident reveals a gap, the archetype's rules are tightened. The guardrail is tightened rather than the archetype, so every archetype benefits.",
        payload: "new rule", guard: "recurring-finding policy", outcome: "Rule tightened", nodeId: "cat.archetypes",
      },
    ],
  },
];

export default function TraceExplorer({
  nodes, edges,
}: {
  nodes: TopoNode[];
  edges: TopoEdge[];
}) {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];

  const nodeMap = useMemo(() => {
    const map = new Map<string, TopoNode>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  return (
    <div className="trace">
      <div className="trace-tabs">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            className={`btn ${scenarioId === s.id ? "active" : ""}`}
            onClick={() => setScenarioId(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <p className="trace-question">
        <Sparkles size={15} /> {scenario.question}
      </p>

      <ol className="trace-steps">
        {scenario.steps.map((step) => {
          const node = step.nodeId ? nodeMap.get(step.nodeId) : undefined;
          return (
            <li className="trace-step" key={step.hop}>
              <div className="trace-step-rail">
                <span className="trace-hop">{String(step.hop).padStart(2, "0")}</span>
                <span className={`trace-avatar ${step.actorKind}`}>
                  {step.actorKind === "person" ? <User size={14} /> : <ShieldCheck size={14} />}
                </span>
              </div>

              <div className="trace-step-body">
                <div className="trace-step-head">
                  <b>{step.actor}</b>
                  <span className="muted">{step.action}</span>
                  {node && <span className="pill">{node.kind}</span>}
                </div>
                <p>{step.detail}</p>
                <div className="trace-step-meta">
                  <span className="mono">payload: {step.payload}</span>
                  {step.guard !== "none" && (
                    <span className="mono trace-guard">
                      <LockKeyhole size={11} /> {step.guard}
                    </span>
                  )}
                </div>
              </div>

              <div className="trace-step-outcome">
                <CheckCircle2 size={13} /> {step.outcome}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
