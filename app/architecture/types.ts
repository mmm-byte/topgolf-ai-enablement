export type NodeKind = "person" | "registry" | "process" | "table" | "system";

export type TopoNode = {
  id: string;
  layer: string;
  label: string;
  kind: NodeKind;
  detail: string;
  source: string;
  persona?: string;
  constraint?: string;
  protocol?: string;
  tools?: number;
  checks?: number;
  cases?: number;
  taxonomies?: number;
  corpus?: number;
  count?: number;
  declined?: number;
  version?: string;
  registry_unit?: string;
  tables?: number;
  data_class?: string;
  steward?: string;
  connector_id?: string;
};

export type TopoEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  kind: "flow" | "blocked";
  detail: string;
  payload: string;
  guarded_by: string;
};

export type TopoLayer = {
  id: string;
  label: string;
  order: number;
  description: string;
};

export type TableSpec = {
  name: string;
  layer: string;
  grain: string;
  purpose: string;
  key: string;
  rows?: number;
  joins: string[];
};

export type McpTool = {
  name: string;
  connector: string;
  data_class: string;
  description: string;
  arguments: Record<string, string>;
  returns: string;
  guards: string[];
};

export type Topology = {
  layers: TopoLayer[];
  nodes: TopoNode[];
  edges: TopoEdge[];
  tables: TableSpec[];
  mcp_tools: McpTool[];
  mcp_protocol: {
    protocol_version: string;
    transport: string;
    methods: string[];
    server: string;
  };
  stats: { nodes: number; edges: number; gold_tables: number; mcp_tools: number };
};

export const NODE_STYLE: Record<NodeKind, { fill: string; stroke: string; label: string }> = {
  person: { fill: "#1c2a3a", stroke: "#5bc0eb", label: "Person" },
  registry: { fill: "#241f10", stroke: "#f5c518", label: "Registry" },
  process: { fill: "#16232c", stroke: "#3ddc97", label: "Process" },
  table: { fill: "#231a2b", stroke: "#b18ce8", label: "Data" },
  system: { fill: "#2b1a1a", stroke: "#ff8f6b", label: "System" },
};

export const EDGE_STYLE: Record<"flow" | "blocked", { stroke: string; dash: string; label: string }> = {
  flow: { stroke: "#4a6076", dash: "", label: "Data flow" },
  blocked: { stroke: "#ff6b6b", dash: "5 4", label: "Blocked path" },
};
