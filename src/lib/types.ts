export type Role = 'admin' | 'editor' | 'viewer';
export type FlowStatus = 'active' | 'inactive' | 'draft';
export type StepKind =
  | 'trigger' | 'action' | 'router' | 'route' | 'filter' | 'delay'
  | 'formatter' | 'iterator' | 'code' | 'api' | 'other';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface FlowSummary {
  id: number;
  name: string;
  folder: string | null;
  status: FlowStatus;
  pabbly_url: string | null;
  webhook_url: string | null;
  trigger_app: string | null;
  description: string | null;
  owner: string | null;
  tags: string | null;
  created_at: string;
  updated_at: string;
  updated_by_name: string | null;
  steps_count: number;
  routers_count: number;
}

export interface Flow extends Omit<FlowSummary, 'steps_count' | 'routers_count'> {
  notes: string | null;
  created_by_name: string | null;
}

export interface Step {
  id: number;
  flow_id: number;
  parent_id: number | null;
  position: number;
  kind: StepKind;
  title: string | null;
  app: string | null;
  event: string | null;
  condition_text: string | null;
  description: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  children: Step[];
}

export interface Meta {
  counts: { flows: number; active: number; inactive: number; draft: number; steps: number; routers: number; routes: number };
  folders: { folder: string; count: number }[];
  unfiled: number;
  apps: { app: string; flows: number }[];
  owners: string[];
  tags: { tag: string; count: number }[];
}

export interface Activity {
  id: number;
  user_id: number | null;
  user_name: string | null;
  action: 'create' | 'update' | 'delete' | 'import';
  entity: 'flow' | 'step' | 'user';
  entity_id: number | null;
  flow_id: number | null;
  flow_name: string | null;
  summary: string;
  created_at: string;
}

export interface SearchStep {
  id: number;
  flow_id: number;
  kind: StepKind;
  title: string | null;
  app: string | null;
  event: string | null;
  condition_text: string | null;
  description: string | null;
  flow_name: string;
  flow_status: FlowStatus;
  number: string;
  path: string[];
}

export interface SearchResult {
  q: string;
  flows: Pick<FlowSummary, 'id' | 'name' | 'folder' | 'status' | 'trigger_app' | 'description' | 'webhook_url' | 'tags'>[];
  steps: SearchStep[];
}

export interface ImportSummary {
  created: number;
  updated: number;
  skipped: number;
  steps: number;
  errors: { row: number; name: string; error: string }[];
}

/** Shape used for CSV/JSON import rows and the JSON backup. */
export interface PortableStep {
  kind: StepKind;
  title?: string;
  app?: string;
  event?: string;
  condition?: string;
  description?: string;
  notes?: string;
  children?: PortableStep[];
}

export interface PortableFlow {
  name?: string;
  folder?: string;
  status?: string;
  pabbly_url?: string;
  webhook_url?: string;
  trigger_app?: string;
  description?: string;
  owner?: string;
  tags?: string;
  notes?: string;
  steps?: PortableStep[];
}

export type GapKey = 'no_steps' | 'no_link' | 'no_owner' | 'no_webhook' | 'empty_branch';

export interface Dashboard {
  counts: {
    flows: number; active: number; inactive: number; draft: number;
    steps: number; routers: number; routes: number; apps: number; documented: number;
  };
  folders: { folder: string; count: number }[];
  more_folders: number;
  unfiled: number;
  apps: { app: string; flows: number }[];
  gaps: { key: GapKey; label: string; hint: string; count: number; sample: { id: number; name: string }[] }[];
  recent_flows: { id: number; name: string; status: FlowStatus; folder: string | null; updated_at: string; updated_by_name: string | null; steps_count: number }[];
  activity: Activity[];
}
