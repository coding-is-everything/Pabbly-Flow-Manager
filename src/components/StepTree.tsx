import { ChevronDown, ChevronRight, ChevronUp, ListPlus, Pencil, Plus, Trash2, Zap } from 'lucide-react';
import { KIND_META } from '../lib/constants';
import type { Step } from '../lib/types';
import { Button, EmptyState, IconButton, cx } from './ui';

export interface TreeHandlers {
  canEdit: boolean;
  collapsed: Set<number>;
  toggle: (id: number) => void;
  /** add a step inside `parent` (null = top level), optionally right after `after` */
  onAdd: (parent: Step | null, after?: Step) => void;
  onEdit: (step: Step) => void;
  onDelete: (step: Step) => void;
  onMove: (step: Step, direction: 'up' | 'down') => void;
}

export default function StepTree({ steps, ...h }: { steps: Step[] } & TreeHandlers) {
  if (!steps.length) {
    return (
      <EmptyState
        icon={Zap}
        title="No steps yet"
        text="Start with the trigger — the event that starts this flow in Pabbly — then add actions, filters and routers in the same order as in Pabbly."
        action={h.canEdit && <Button icon={Plus} onClick={() => h.onAdd(null)}>Add the trigger</Button>}
      />
    );
  }
  return (
    // overflow-x-auto: very deep nesting on a phone scrolls inside the card instead of breaking the page
    <div className="overflow-x-auto p-3 sm:p-5">
      <StepList nodes={steps} prefix="" parent={null} h={h} />
      {h.canEdit && <AddButton label="Add step at the end" onClick={() => h.onAdd(null)} />}
    </div>
  );
}

function StepList({ nodes, prefix, parent, h }: { nodes: Step[]; prefix: string; parent: Step | null; h: TreeHandlers }) {
  return (
    <ol>
      {nodes.map((n, i) => (
        <li key={n.id}>
          {i > 0 && <div className="ml-[27px] h-3 w-0.5 bg-slate-200" aria-hidden />}
          <StepNode step={n} number={prefix ? `${prefix}.${i + 1}` : String(i + 1)} index={i} siblings={nodes} parent={parent} h={h} />
        </li>
      ))}
    </ol>
  );
}

function AddButton({ label, onClick, tone = 'slate' }: { label: string; onClick: () => void; tone?: 'slate' | 'violet' | 'fuchsia' }) {
  const tones = {
    slate: 'border-slate-300 text-slate-500 hover:border-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-600',
    violet: 'border-violet-300 text-violet-600 hover:border-violet-500 hover:bg-violet-50',
    fuchsia: 'border-fuchsia-300 text-fuchsia-700 hover:border-fuchsia-500 hover:bg-fuchsia-50',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx('mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-xs font-medium transition-colors', tones[tone])}
    >
      <Plus className="size-3.5" />
      {label}
    </button>
  );
}

function moveState(step: Step, index: number, siblings: Step[]) {
  const up = step.kind !== 'trigger' && index > 0 && siblings[index - 1].kind !== 'trigger';
  const down = step.kind !== 'trigger' && index < siblings.length - 1;
  return { up, down };
}

function Actions({ step, index, siblings, parent, h, insertLabel }: { step: Step; index: number; siblings: Step[]; parent: Step | null; h: TreeHandlers; insertLabel: string }) {
  if (!h.canEdit) return null;
  const { up, down } = moveState(step, index, siblings);
  return (
    <div className="ml-auto flex shrink-0 items-center opacity-100 transition-opacity sm:opacity-50 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
      <IconButton icon={ChevronUp} label="Move up" disabled={!up} onClick={() => h.onMove(step, 'up')} />
      <IconButton icon={ChevronDown} label="Move down" disabled={!down} onClick={() => h.onMove(step, 'down')} />
      <IconButton icon={ListPlus} label={insertLabel} onClick={() => h.onAdd(parent, step)} />
      <IconButton icon={Pencil} label="Edit" onClick={() => h.onEdit(step)} />
      <IconButton icon={Trash2} label="Delete" tone="danger" onClick={() => h.onDelete(step)} />
    </div>
  );
}

function Condition({ text, tone }: { text: string; tone: 'orange' | 'fuchsia' }) {
  return (
    <div className={cx('mt-1.5 rounded-md px-2 py-1 font-mono text-xs whitespace-pre-wrap break-words', tone === 'orange' ? 'bg-orange-50 text-orange-900' : 'bg-white/80 text-fuchsia-900 ring-1 ring-fuchsia-100')}>
      <span className="mr-1 font-sans font-semibold">IF</span>
      {text}
    </div>
  );
}

function Extras({ step }: { step: Step }) {
  return (
    <>
      {step.description && <p className="mt-1.5 text-sm whitespace-pre-wrap text-slate-600">{step.description}</p>}
      {step.notes && (
        <div className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs whitespace-pre-wrap text-amber-900 ring-1 ring-amber-200">
          <span className="font-semibold">Note: </span>
          {step.notes}
        </div>
      )}
    </>
  );
}

function StepNode({ step, number, index, siblings, parent, h }: { step: Step; number: string; index: number; siblings: Step[]; parent: Step | null; h: TreeHandlers }) {
  if (step.kind === 'route') {
    return <RouteBlock route={step} number={number} index={index} siblings={siblings} router={parent} h={h} />;
  }

  const meta = KIND_META[step.kind];
  const Icon = meta.icon;
  const isRouter = step.kind === 'router';
  const collapsed = h.collapsed.has(step.id);
  const primary = step.title || step.app || meta.label;
  const secondary = step.title ? [step.app, step.event].filter(Boolean).join(' · ') : step.event;

  return (
    <div>
      <div className={cx('group rounded-lg border border-l-4 border-slate-200 bg-white p-3 shadow-sm', meta.accent)}>
        {/* flex-wrap + min width on the text: on narrow screens the action buttons drop below the text */}
        <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
          <div className={cx('flex size-8 shrink-0 items-center justify-center rounded-md', meta.iconBox)}>
            <Icon className="size-4" />
          </div>
          <div className="min-w-[9rem] flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono text-xs font-semibold text-slate-400">{number}</span>
              <span className={cx('rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset', meta.chip)}>{meta.label}</span>
              <span className="text-sm font-semibold break-words text-slate-900">{primary}</span>
            </div>
            {secondary && <p className="mt-0.5 text-sm break-words text-slate-600">{secondary}</p>}
            {step.condition_text && <Condition text={step.condition_text} tone="orange" />}
            <Extras step={step} />
            {isRouter && (
              <button
                type="button"
                onClick={() => h.toggle(step.id)}
                className="mt-2 inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100"
              >
                {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                {step.children.length} route{step.children.length === 1 ? '' : 's'}
                {collapsed ? ' (hidden)' : ''}
              </button>
            )}
          </div>
          <Actions step={step} index={index} siblings={siblings} parent={parent} h={h} insertLabel="Insert step below" />
        </div>
      </div>

      {isRouter && !collapsed && (
        <div className="mt-2 ml-3 space-y-3 border-l-2 border-dashed border-violet-300 pl-3 sm:ml-6 sm:pl-5">
          {step.children.map((route, ri) => (
            <StepNode key={route.id} step={route} number={`${number}.${ri + 1}`} index={ri} siblings={step.children} parent={step} h={h} />
          ))}
          {step.children.length === 0 && <p className="py-1 text-xs text-slate-500 italic">This router has no routes yet.</p>}
          {h.canEdit && <AddButton tone="violet" label="Add route" onClick={() => h.onAdd(step)} />}
        </div>
      )}
    </div>
  );
}

function RouteBlock({ route, number, index, siblings, router, h }: { route: Step; number: string; index: number; siblings: Step[]; router: Step | null; h: TreeHandlers }) {
  const collapsed = h.collapsed.has(route.id);
  const RouteIcon = KIND_META.route.icon;
  return (
    <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50/40">
      <div className="group flex flex-wrap items-start gap-x-2 gap-y-1 px-3 py-2.5">
        <button
          type="button"
          onClick={() => h.toggle(route.id)}
          className="mt-0.5 rounded p-0.5 text-fuchsia-700 hover:bg-fuchsia-100"
          aria-label={collapsed ? 'Expand route' : 'Collapse route'}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        <div className="min-w-[9rem] flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <RouteIcon className="size-4 text-fuchsia-600" />
            <span className="font-mono text-xs font-semibold text-fuchsia-400">{number}</span>
            <span className="text-sm font-semibold break-words text-slate-900">{route.title || `Route ${index + 1}`}</span>
            <span className="text-xs text-slate-500">
              {route.children.length} step{route.children.length === 1 ? '' : 's'}
            </span>
          </div>
          {route.condition_text ? (
            <Condition text={route.condition_text} tone="fuchsia" />
          ) : (
            <p className="mt-1 text-xs text-slate-500 italic">No condition — runs every time (fallback route)</p>
          )}
          <Extras step={route} />
        </div>
        <Actions step={route} index={index} siblings={siblings} parent={router} h={h} insertLabel="Insert route below" />
      </div>
      {!collapsed && (
        <div className="border-t border-fuchsia-100 p-2.5 sm:p-3">
          {route.children.length ? (
            <StepList nodes={route.children} prefix={number} parent={route} h={h} />
          ) : (
            <p className="px-1 text-xs text-slate-500 italic">No steps in this route yet.</p>
          )}
          {h.canEdit && <AddButton tone="fuchsia" label="Add step to this route" onClick={() => h.onAdd(route)} />}
        </div>
      )}
    </div>
  );
}
