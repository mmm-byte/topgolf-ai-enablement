"use client";

import { useState } from "react";
import { CheckCircle2, CircleHelp, Code2, Database, FileCheck2, Gauge, LockKeyhole, PackageCheck, ShieldCheck, Sparkles, TestTube2, Users } from "lucide-react";

type Stage = {
  id: string;
  n: string;
  title: string;
  owner: string;
  automated: boolean;
  purpose: string;
  inputs: string[];
  outputs: string[];
  gates: { name: string; automated: boolean; state: string }[];
  artifact: string;
  icon: "users" | "package" | "code" | "shield" | "file" | "database" | "gauge";
};

const ICONS = {
  users: Users, package: PackageCheck, code: Code2, shield: ShieldCheck,
  file: FileCheck2, database: Database, gauge: Gauge,
};

export default function PipelineFlow() {
  const [active, setActive] = useState<Stage | null>(null);

  const stages: Stage[] = [
    {
      id: "intake", n: "01", title: "Intake", owner: "Builder", automated: false,
      purpose: "The builder answers the intake questionnaire. The request is matched to an existing archetype or sent for a new one. The data class is set here, before any code exists.",
      inputs: ["An outcome the user can state", "The role and frequency", "The data the archetype would read", "The human decisions that stay human"],
      outputs: ["A filled intake record", "A proposed data class", "A named owner and data owner"],
      gates: [
        { name: "Intake questions answered", automated: false, state: "Required before the archetype leaves draft" },
        { name: "Data class assigned", automated: false, state: "Higher class wins when in doubt" },
        { name: "Connector exists in the catalog", automated: true, state: "Enforced by the scaffold and the catalog validator" },
      ],
      artifact: "archetypes/references/intake-questionnaire.md",
      icon: "users",
    },
    {
      id: "build", n: "02", title: "Build", owner: "Builder, assisted", automated: false,
      purpose: "The application is built from the archetype's scaffold. Standards, guardrails and the output contract are wired in from the start, not added afterwards.",
      inputs: ["The archetype's SKILL.md", "The guardrail manifest", "The connector binding"],
      outputs: ["A scaffolded archetype folder", "Generated tests", "A guardrails.json with declared fields"],
      gates: [
        { name: "Scaffold refuses an unapproved connector", automated: true, state: "Enforced at generation time" },
        { name: "Manifest declares allowlist and denylist", automated: true, state: "Checked by the generated test" },
        { name: "Catalog entry created with status draft", automated: true, state: "Enforced by the catalog validator" },
      ],
      artifact: "archetypes/shift-handover/scripts/scaffold.py",
      icon: "package",
    },
    {
      id: "gates", n: "03", title: "Automated gates", owner: "Pipeline", automated: true,
      purpose: "Tests, output schema, secrets scan, and a scope check that compares what the application can reach against what it declared.",
      inputs: ["The changed archetype", "Its guardrail manifest", "The repository tree"],
      outputs: ["Gate results", "Findings with a severity", "A pass or a block"],
      gates: [
        { name: "Unit tests pass", automated: true, state: "47 tests run on every pull request" },
        { name: "Output schema validation", automated: true, state: "Structure, bounds and required markers" },
        { name: "Secrets scan clean", automated: true, state: "Working tree and git history" },
        { name: "Scope check", automated: true, state: "Fields touched versus fields declared" },
      ],
      artifact: "security/guardrails/guardrails.py",
      icon: "code",
    },
    {
      id: "adversarial", n: "04", title: "Adversarial tests", owner: "Pipeline", automated: true,
      purpose: "The archetype is run against prompt injection, jailbreak, exfiltration, policy violation, scope escape and output manipulation cases. Any case that gets through blocks release.",
      inputs: ["The archetype and its manifest", "The attack case catalogue"],
      outputs: ["A pass or miss per case", "Defence-in-depth flags", "A block on any miss"],
      gates: [
        { name: "All attack cases caught", automated: true, state: "18 of 18 caught" },
        { name: "Policy layer catches the request", automated: true, state: "A rule removal breaks the build" },
        { name: "Content layer catches the output", automated: true, state: "17 of 18 caught by the real engine too" },
      ],
      artifact: "security/adversarial/run_suite.py",
      icon: "shield",
    },
    {
      id: "review", n: "05", title: "Human review", owner: "Reviewer", automated: false,
      purpose: "A reviewer applies the rubric and answers one question: what did the automated gates miss? Personal-data applications need a second reviewer.",
      inputs: ["The gate results", "The change itself", "The archetype spec"],
      outputs: ["Findings with a severity", "A disposition: ship, ship with changes, or do not ship", "A review record"],
      gates: [
        { name: "Code, spec and gate result reviewed", automated: false, state: "Human judgment" },
        { name: "Reviewer attempted to break the output", automated: false, state: "Recorded in the review record" },
        { name: "Second reviewer for personal data", automated: false, state: "Required at internal-personal and above" },
      ],
      artifact: "review/ai-output-review-rubric.md",
      icon: "file",
    },
    {
      id: "staging", n: "06", title: "Staging", owner: "Platform", automated: true,
      purpose: "The application runs against recorded or synthetic data for a full week with its output logged for review. Volume and edge cases are the point.",
      inputs: ["The gated release candidate", "Recorded or synthetic traffic"],
      outputs: ["A week of logged output", "A sample for human review", "Observed behaviour"],
      gates: [
        { name: "One full week in staging", automated: true, state: "Minimum dwell time" },
        { name: "Output logged for review", automated: true, state: "Required for personal-data archetypes" },
        { name: "Sample reviewed", automated: false, state: "Answers sampled daily" },
      ],
      artifact: "platform/connectors/catalog.yaml",
      icon: "database",
    },
    {
      id: "monitor", n: "07", title: "Release and monitor", owner: "Steward", automated: false,
      purpose: "Released with an owner and a review date. Usage, rewrite rate, gate failures, support load and prompt drift are tracked. A drop triggers review.",
      inputs: ["The staged release", "Usage and drift telemetry"],
      outputs: ["A catalog entry with a steward", "A weekly health report", "A proposed action per archetype"],
      gates: [
        { name: "Steward assigned", automated: true, state: "Checked by the catalog validator" },
        { name: "Review date set", automated: true, state: "Checked by the catalog validator" },
        { name: "Health report reviewed", automated: false, state: "The steward decides, the monitor only proposes" },
      ],
      artifact: "monitoring/health_report.py",
      icon: "gauge",
    },
  ];

  return (
    <div className="pipeline-flow">
      <div className="pipeline-track">
        {stages.map((stage, i) => {
          const Icon = ICONS[stage.icon];
          const isActive = active?.id === stage.id;
          return (
            <div className="pipeline-stage-wrap" key={stage.id}>
              <button
                className={`pipeline-stage ${isActive ? "active" : ""} ${stage.automated ? "automated" : "human"}`}
                onClick={() => setActive(isActive ? null : stage)}
              >
                <div className="pipeline-stage-top">
                  <span className="pipeline-stage-n">{stage.n}</span>
                  {stage.automated ? (
                    <span className="pill ok" title="Runs without a person">auto</span>
                  ) : (
                    <span className="pill warn" title="Requires a person">human</span>
                  )}
                </div>
                <Icon size={19} className="pipeline-stage-icon" />
                <b>{stage.title}</b>
                <span className="pipeline-stage-owner">{stage.owner}</span>
              </button>
              {i < stages.length - 1 && (
                <div className="pipeline-connector" aria-hidden="true">
                  <svg width="30" height="12" viewBox="0 0 30 12">
                    <line x1="0" y1="6" x2="22" y2="6" stroke="#4a6076" strokeWidth="1.5" />
                    <path d="M 21 2 L 29 6 L 21 10 z" fill="#4a6076" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {active ? (
        <div className="pipeline-detail">
          <div className="pipeline-detail-head">
            <div>
              <span className="eyebrow">Stage {active.n} · {active.owner}</span>
              <h3>{active.title}</h3>
            </div>
            <div className="row">
              <span className={`pill ${active.automated ? "ok" : "warn"}`}>
                {active.automated ? "Automated gate" : "Human stage"}
              </span>
              <button className="btn" onClick={() => setActive(null)}>Close</button>
            </div>
          </div>

          <p className="pipeline-detail-purpose">{active.purpose}</p>

          <div className="pipeline-detail-grid">
            <div className="panel">
              <h4>Inputs</h4>
              <ul className="detail-list" style={{ marginTop: 10 }}>
                {active.inputs.map((i) => <li key={i}>{i}</li>)}
              </ul>
            </div>
            <div className="panel">
              <h4>Outputs</h4>
              <ul className="detail-list" style={{ marginTop: 10 }}>
                {active.outputs.map((o) => <li key={o}>{o}</li>)}
              </ul>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <h4>Gates at this stage</h4>
            <ul className="checks" style={{ marginTop: 12 }}>
              {active.gates.map((g) => (
                <li className={g.automated ? "pass" : "warn"} key={g.name}>
                  <span className="mk">{g.automated ? <CheckCircle2 size={12} /> : <Users size={12} />}</span>
                  <span>
                    <b>{g.name}</b> — {g.state}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <h4>Where this stage is implemented</h4>
            <code className="mono pipeline-artifact">{active.artifact}</code>
          </div>
        </div>
      ) : (
        <div className="callout" style={{ marginTop: 20 }}>
          <CircleHelp size={17} />
          <p>
            <b>Three of the seven stages are human.</b> The automated ones catch the
            mistakes that repeat. The human ones catch the ones that do not: whether
            an output is useful to a team lead, whether a claim would pass legal, and
            whether the application should exist at all. Select any stage to see its
            inputs, outputs, gates and the file that implements it.
          </p>
        </div>
      )}
    </div>
  );
}
