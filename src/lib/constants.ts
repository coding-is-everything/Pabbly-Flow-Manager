import {
  Zap, Play, GitFork, Route, Filter, Clock, WandSparkles, Repeat, Code, Globe, CircleDot, type LucideIcon,
} from 'lucide-react';
import type { FlowStatus, Role, StepKind } from './types';

interface KindMeta {
  label: string;
  icon: LucideIcon;
  hint: string;
  /** small pill */
  chip: string;
  /** square icon background */
  iconBox: string;
  /** left accent border on step cards */
  accent: string;
  /** shows App + Event fields in the form */
  hasApp: boolean;
  /** shows Condition field in the form */
  hasCondition: boolean;
}

// Full class strings (not built dynamically) so Tailwind keeps them in the build.
export const KIND_META: Record<StepKind, KindMeta> = {
  trigger: { label: 'Trigger', icon: Zap, hint: 'What starts the flow — webhook, new payment, new lead…', chip: 'bg-amber-50 text-amber-800 ring-amber-200', iconBox: 'bg-amber-100 text-amber-700', accent: 'border-l-amber-400', hasApp: true, hasCondition: false },
  action: { label: 'Action', icon: Play, hint: 'Does something in an app — send WhatsApp, add sheet row…', chip: 'bg-blue-50 text-blue-800 ring-blue-200', iconBox: 'bg-blue-100 text-blue-700', accent: 'border-l-blue-400', hasApp: true, hasCondition: false },
  router: { label: 'Router', icon: GitFork, hint: 'Splits the flow into routes, each with its own condition', chip: 'bg-violet-50 text-violet-800 ring-violet-200', iconBox: 'bg-violet-100 text-violet-700', accent: 'border-l-violet-500', hasApp: false, hasCondition: false },
  route: { label: 'Route', icon: Route, hint: 'One branch of a router — runs its steps when its condition matches', chip: 'bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200', iconBox: 'bg-fuchsia-100 text-fuchsia-700', accent: 'border-l-fuchsia-400', hasApp: false, hasCondition: true },
  filter: { label: 'Filter', icon: Filter, hint: 'Continues only when the condition is true', chip: 'bg-orange-50 text-orange-800 ring-orange-200', iconBox: 'bg-orange-100 text-orange-700', accent: 'border-l-orange-400', hasApp: false, hasCondition: true },
  delay: { label: 'Delay', icon: Clock, hint: 'Waits before the next step', chip: 'bg-cyan-50 text-cyan-800 ring-cyan-200', iconBox: 'bg-cyan-100 text-cyan-700', accent: 'border-l-cyan-400', hasApp: false, hasCondition: false },
  formatter: { label: 'Formatter', icon: WandSparkles, hint: 'Text / number / date formatter or data transformer', chip: 'bg-teal-50 text-teal-800 ring-teal-200', iconBox: 'bg-teal-100 text-teal-700', accent: 'border-l-teal-400', hasApp: true, hasCondition: false },
  iterator: { label: 'Iterator', icon: Repeat, hint: 'Loops over a list of items', chip: 'bg-lime-50 text-lime-800 ring-lime-200', iconBox: 'bg-lime-100 text-lime-700', accent: 'border-l-lime-500', hasApp: true, hasCondition: false },
  code: { label: 'Code', icon: Code, hint: 'Runs JavaScript or Python code', chip: 'bg-zinc-100 text-zinc-800 ring-zinc-300', iconBox: 'bg-zinc-200 text-zinc-700', accent: 'border-l-zinc-500', hasApp: true, hasCondition: false },
  api: { label: 'API / Webhook', icon: Globe, hint: 'Calls an API or sends data to a webhook URL', chip: 'bg-sky-50 text-sky-800 ring-sky-200', iconBox: 'bg-sky-100 text-sky-700', accent: 'border-l-sky-400', hasApp: true, hasCondition: false },
  other: { label: 'Other', icon: CircleDot, hint: 'Anything else', chip: 'bg-slate-100 text-slate-700 ring-slate-300', iconBox: 'bg-slate-200 text-slate-600', accent: 'border-l-slate-400', hasApp: true, hasCondition: false },
};

export const ALL_KINDS = Object.keys(KIND_META) as StepKind[];

export const STATUS_META: Record<FlowStatus, { label: string; badge: string; dot: string }> = {
  active: { label: 'Active', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500' },
  inactive: { label: 'Inactive', badge: 'bg-rose-50 text-rose-700 ring-rose-600/20', dot: 'bg-rose-500' },
  draft: { label: 'Draft', badge: 'bg-amber-50 text-amber-800 ring-amber-600/20', dot: 'bg-amber-500' },
};

export const ROLE_META: Record<Role, { label: string; badge: string; hint: string }> = {
  admin: { label: 'Admin', badge: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20', hint: 'Everything, including users and deleting flows' },
  editor: { label: 'Editor', badge: 'bg-sky-50 text-sky-700 ring-sky-600/20', hint: 'Add and edit flows, steps and imports' },
  viewer: { label: 'Viewer', badge: 'bg-slate-100 text-slate-700 ring-slate-500/20', hint: 'Read-only access' },
};
