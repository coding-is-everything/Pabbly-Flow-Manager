import { useState, type ChangeEvent } from 'react';
import Papa from 'papaparse';
import { Download, FileJson, FileSpreadsheet, Upload } from 'lucide-react';
import { api, downloadFile, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useMeta } from '../lib/meta';
import { today } from '../lib/format';
import type { FlowSummary, ImportSummary, PortableFlow, PortableStep } from '../lib/types';
import { useToast } from '../components/Toast';
import { Button, Card, ErrorBanner, cx } from '../components/ui';

type Mode = 'skip' | 'update' | 'create';

const FIELDS = ['name', 'folder', 'status', 'trigger_app', 'pabbly_url', 'webhook_url', 'owner', 'tags', 'description', 'notes'] as const;
type FlowField = (typeof FIELDS)[number];

// Accepts many header spellings: "Flow Name", "Pabbly URL", "Webhook", "Trigger App"…
const HEADER_MAP: Record<string, FlowField> = {
  name: 'name', flowname: 'name', workflowname: 'name', workflow: 'name', flow: 'name',
  folder: 'folder', foldername: 'folder',
  status: 'status', state: 'status',
  pabblyurl: 'pabbly_url', pabblyworkflowurl: 'pabbly_url', workflowurl: 'pabbly_url', pabblylink: 'pabbly_url', url: 'pabbly_url', link: 'pabbly_url',
  webhookurl: 'webhook_url', webhook: 'webhook_url',
  triggerapp: 'trigger_app', trigger: 'trigger_app', triggerapplication: 'trigger_app',
  purpose: 'description', description: 'description',
  owner: 'owner', responsible: 'owner',
  tags: 'tags', tag: 'tags', labels: 'tags',
  notes: 'notes', note: 'notes', remarks: 'notes',
};

const MAX_BYTES = 4 * 1024 * 1024; // Vercel request limit is 4.5 MB

const csvWithBom = (csv: string) => `﻿${csv}`; // so Excel opens UTF-8 (₹, →, Hindi) correctly

function countPortableSteps(steps: PortableStep[] | undefined): number {
  return (steps ?? []).reduce((n, s) => n + 1 + countPortableSteps(s.children), 0);
}

function ModePicker({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const options: { value: Mode; title: string; text: string }[] = [
    { value: 'skip', title: 'Skip existing', text: 'Flows whose name already exists are left untouched. Safest.' },
    { value: 'update', title: 'Update existing', text: 'Matching flows get the values from the file. Empty cells are ignored.' },
    { value: 'create', title: 'Always create new', text: 'Every row becomes a new flow, even if the name exists.' },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {options.map((o) => (
        <label
          key={o.value}
          className={cx('cursor-pointer rounded-lg p-3 text-sm ring-1 transition', mode === o.value ? 'bg-indigo-50 ring-2 ring-indigo-600' : 'bg-white ring-slate-200 hover:ring-slate-300')}
        >
          <input type="radio" name="mode" value={o.value} checked={mode === o.value} onChange={() => setMode(o.value)} className="sr-only" />
          <div className="font-medium text-slate-900">{o.title}</div>
          <div className="mt-0.5 text-xs text-slate-500">{o.text}</div>
        </label>
      ))}
    </div>
  );
}

function ImportResult({ result }: { result: ImportSummary }) {
  return (
    <div className="space-y-3 rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-medium text-emerald-800">{result.created} created</span>
        <span className="rounded-full bg-sky-100 px-2.5 py-0.5 font-medium text-sky-800">{result.updated} updated</span>
        <span className="rounded-full bg-slate-200 px-2.5 py-0.5 font-medium text-slate-700">{result.skipped} skipped</span>
        {result.steps > 0 && <span className="rounded-full bg-violet-100 px-2.5 py-0.5 font-medium text-violet-800">{result.steps} steps</span>}
        {result.errors.length > 0 && <span className="rounded-full bg-rose-100 px-2.5 py-0.5 font-medium text-rose-800">{result.errors.length} failed</span>}
      </div>
      {result.errors.length > 0 && (
        <div className="max-h-60 overflow-auto rounded-md bg-white ring-1 ring-rose-200">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 bg-rose-50 text-left text-rose-800">
              <tr><th className="px-3 py-1.5">Row</th><th className="px-3 py-1.5">Flow</th><th className="px-3 py-1.5">Problem</th></tr>
            </thead>
            <tbody className="divide-y divide-rose-100">
              {result.errors.map((e) => (
                <tr key={e.row}><td className="px-3 py-1.5">{e.row}</td><td className="px-3 py-1.5">{e.name}</td><td className="px-3 py-1.5 text-rose-700">{e.error}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ImportExportPage() {
  const { canEdit } = useAuth();
  const { reloadMeta } = useMeta();
  const toast = useToast();

  // CSV state
  const [csvRows, setCsvRows] = useState<PortableFlow[] | null>(null);
  const [csvFile, setCsvFile] = useState('');
  const [ignored, setIgnored] = useState<string[]>([]);
  const [csvMode, setCsvMode] = useState<Mode>('skip');
  const [csvResult, setCsvResult] = useState<ImportSummary | null>(null);
  const [csvError, setCsvError] = useState('');
  const [csvBusy, setCsvBusy] = useState(false);

  // JSON state
  const [jsonFlows, setJsonFlows] = useState<PortableFlow[] | null>(null);
  const [jsonFile, setJsonFile] = useState('');
  const [jsonMode, setJsonMode] = useState<Mode>('skip');
  const [jsonResult, setJsonResult] = useState<ImportSummary | null>(null);
  const [jsonError, setJsonError] = useState('');
  const [jsonBusy, setJsonBusy] = useState(false);

  const [exporting, setExporting] = useState<'json' | 'csv' | null>(null);

  const downloadTemplate = () => {
    const csv = Papa.unparse({
      fields: [...FIELDS],
      data: [
        ['Razorpay Payment → Gallabox WhatsApp + Google Sheet', 'Payments', 'active', 'Razorpay', 'https://connect.pabbly.com/workflow/mapping/XXXX', '', 'Ankit', 'payments, whatsapp', 'Sends payment confirmation on WhatsApp and logs the order', ''],
        ['Facebook Lead → TeleCRM', 'Leads', 'active', 'Facebook Lead Ads', 'https://connect.pabbly.com/workflow/mapping/YYYY', '', '', 'leads', 'Pushes every new lead to TeleCRM', ''],
        ['Website form → Gallabox', 'Leads', 'inactive', 'Webhook', '', 'https://connect.pabbly.com/workflow/sendwebhookdata/ZZZZ', '', '', '', 'Replaced by the Elementor flow'],
      ],
    });
    downloadFile('pabbly-flows-template.csv', csvWithBom(csv), 'text/csv;charset=utf-8');
  };

  const onCsv = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCsvResult(null);
    setCsvError('');
    if (file.size > MAX_BYTES) {
      setCsvError('This file is larger than 4 MB. Split it into smaller files.');
      return;
    }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (res) => {
        const headers = res.meta.fields ?? [];
        const mapping = new Map<string, FlowField>();
        const unknown: string[] = [];
        for (const h of headers) {
          const key = HEADER_MAP[h.toLowerCase().replace(/[^a-z0-9]/g, '')];
          if (key && ![...mapping.values()].includes(key)) mapping.set(h, key);
          else unknown.push(h);
        }
        if (![...mapping.values()].includes('name')) {
          setCsvError('No "name" column found. The first row must contain column names — download the template to see the format.');
          setCsvRows(null);
          return;
        }
        const rows = res.data.map((raw) => {
          const row: PortableFlow = {};
          for (const [header, field] of mapping) {
            const value = (raw[header] ?? '').trim();
            if (value) row[field] = value; // empty cells are left out, so "update" never blanks a field
          }
          return row;
        });
        setCsvFile(file.name);
        setIgnored(unknown.filter(Boolean));
        setCsvRows(rows);
      },
      error: (err) => setCsvError(`Could not read the CSV: ${err.message}`),
    });
  };

  const importCsv = async () => {
    if (!csvRows) return;
    setCsvBusy(true);
    setCsvError('');
    try {
      const result = await api<ImportSummary>('/import', 'POST', { mode: csvMode, source: 'csv', flows: csvRows });
      setCsvResult(result);
      setCsvRows(null);
      reloadMeta();
      toast(`Import finished: ${result.created} created, ${result.updated} updated`);
    } catch (err) {
      setCsvError(errorMessage(err));
    } finally {
      setCsvBusy(false);
    }
  };

  const onJson = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setJsonResult(null);
    setJsonError('');
    if (file.size > MAX_BYTES) {
      setJsonError('This file is larger than 4 MB. Split the "flows" list into smaller files.');
      return;
    }
    try {
      const data = JSON.parse(await file.text());
      const flows: unknown = Array.isArray(data) ? data : data?.flows;
      if (!Array.isArray(flows)) throw new Error('Expected a backup file with a "flows" list.');
      setJsonFile(file.name);
      setJsonFlows(flows as PortableFlow[]);
    } catch (err) {
      setJsonFlows(null);
      setJsonError(err instanceof SyntaxError ? 'This is not a valid JSON file.' : errorMessage(err));
    }
  };

  const importJson = async () => {
    if (!jsonFlows) return;
    setJsonBusy(true);
    setJsonError('');
    try {
      const result = await api<ImportSummary>('/import', 'POST', { mode: jsonMode, source: 'json', flows: jsonFlows });
      setJsonResult(result);
      setJsonFlows(null);
      reloadMeta();
      toast(`Restore finished: ${result.created} created, ${result.updated} updated`);
    } catch (err) {
      setJsonError(errorMessage(err));
    } finally {
      setJsonBusy(false);
    }
  };

  const exportJson = async () => {
    setExporting('json');
    try {
      const data = await api<{ flows: PortableFlow[] }>('/export');
      downloadFile(`pabbly-flows-backup-${today()}.json`, JSON.stringify(data, null, 2), 'application/json');
      toast(`Exported ${data.flows.length} flows`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setExporting(null);
    }
  };

  const exportCsv = async () => {
    setExporting('csv');
    try {
      const { flows } = await api<{ flows: FlowSummary[] }>('/flows?sort=name');
      const csv = Papa.unparse({
        fields: [...FIELDS.filter((f) => f !== 'notes'), 'steps', 'routers', 'updated_at'],
        data: flows.map((f) => [f.name, f.folder, f.status, f.trigger_app, f.pabbly_url, f.webhook_url, f.owner, f.tags, f.description, f.steps_count, f.routers_count, f.updated_at]),
      });
      downloadFile(`pabbly-flows-${today()}.csv`, csvWithBom(csv), 'text/csv;charset=utf-8');
      toast(`Exported ${flows.length} flows`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setExporting(null);
    }
  };

  const missingNames = csvRows?.filter((r) => !r.name).length ?? 0;
  const jsonSteps = jsonFlows?.reduce((n, f) => n + countPortableSteps(f.steps), 0) ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Import / Export</h1>
        <p className="mt-0.5 text-sm text-slate-500">Load your flow list in bulk, or download a backup.</p>
      </div>

      {canEdit ? (
        <Card title={<span className="flex items-center gap-2"><FileSpreadsheet className="size-4 text-emerald-600" /> Import flows from CSV</span>}>
          <div className="space-y-4 p-4 sm:p-5">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>
                <button onClick={downloadTemplate} className="font-medium text-indigo-600 hover:underline">Download the CSV template</button>
                {' '}(columns: name, folder, status, trigger_app, pabbly_url, webhook_url, owner, tags, description, notes).
              </li>
              <li>Fill one row per Pabbly flow in Excel or Google Sheets, then save / download it as <b>CSV</b>. Only <b>name</b> is required.</li>
              <li>Upload it below, check the preview, then import. Add the steps for each flow afterwards from its page.</li>
            </ol>

            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600 hover:border-indigo-400 hover:bg-indigo-50/40">
              <Upload className="size-4" />
              {csvFile && csvRows ? `Selected: ${csvFile} — choose another file` : 'Choose a CSV file'}
              <input type="file" accept=".csv,text/csv" onChange={onCsv} className="sr-only" />
            </label>

            {csvError && <ErrorBanner message={csvError} />}

            {csvRows && (
              <div className="space-y-4">
                <div className="text-sm text-slate-700">
                  <b>{csvRows.length}</b> row{csvRows.length === 1 ? '' : 's'} found.
                  {missingNames > 0 && <span className="text-rose-600"> {missingNames} without a name will be rejected.</span>}
                  {ignored.length > 0 && <span className="text-slate-500"> Ignored columns: {ignored.join(', ')}.</span>}
                </div>
                <div className="max-h-80 overflow-auto rounded-lg ring-1 ring-slate-200">
                  <table className="min-w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Folder</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Trigger</th>
                        <th className="px-3 py-2">Pabbly URL</th>
                        <th className="px-3 py-2">Webhook</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {csvRows.slice(0, 100).map((r, i) => (
                        <tr key={i} className={cx(!r.name && 'bg-rose-50')}>
                          <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                          <td className="px-3 py-1.5 font-medium">{r.name || <span className="text-rose-600">missing name</span>}</td>
                          <td className="px-3 py-1.5">{r.folder}</td>
                          <td className="px-3 py-1.5">{r.status}</td>
                          <td className="px-3 py-1.5">{r.trigger_app}</td>
                          <td className="max-w-[180px] truncate px-3 py-1.5 font-mono" title={r.pabbly_url}>{r.pabbly_url}</td>
                          <td className="max-w-[180px] truncate px-3 py-1.5 font-mono" title={r.webhook_url}>{r.webhook_url}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvRows.length > 100 && <p className="px-3 py-2 text-xs text-slate-500">…and {csvRows.length - 100} more rows</p>}
                </div>
                <ModePicker mode={csvMode} setMode={setCsvMode} />
                <div className="flex gap-2">
                  <Button icon={Upload} onClick={importCsv} loading={csvBusy}>Import {csvRows.length} flows</Button>
                  <Button variant="ghost" onClick={() => setCsvRows(null)}>Cancel</Button>
                </div>
              </div>
            )}
            {csvResult && <ImportResult result={csvResult} />}
          </div>
        </Card>
      ) : (
        <Card>
          <p className="p-5 text-sm text-slate-500">You have view-only access, so importing is disabled. You can still download exports below.</p>
        </Card>
      )}

      <Card title={<span className="flex items-center gap-2"><Download className="size-4 text-indigo-600" /> Export</span>}>
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          <div className="rounded-lg p-4 ring-1 ring-slate-200">
            <div className="font-medium text-slate-900">Full backup (JSON)</div>
            <p className="mt-1 text-sm text-slate-500">Every flow with all routers, routes and steps. Use it to restore or move to another database.</p>
            <Button variant="secondary" icon={FileJson} className="mt-3" onClick={exportJson} loading={exporting === 'json'}>Download JSON</Button>
          </div>
          <div className="rounded-lg p-4 ring-1 ring-slate-200">
            <div className="font-medium text-slate-900">Flow list (CSV)</div>
            <p className="mt-1 text-sm text-slate-500">One row per flow with links and step counts. Opens in Excel / Google Sheets.</p>
            <Button variant="secondary" icon={FileSpreadsheet} className="mt-3" onClick={exportCsv} loading={exporting === 'csv'}>Download CSV</Button>
          </div>
        </div>
      </Card>

      {canEdit && (
        <Card title={<span className="flex items-center gap-2"><FileJson className="size-4 text-violet-600" /> Restore from JSON backup</span>}>
          <div className="space-y-4 p-4 sm:p-5">
            <p className="text-sm text-slate-600">
              Upload a JSON backup made with “Download JSON” above. It brings back flows <b>including their full step trees</b>.
              In “Update existing” mode, a flow’s steps are replaced by the ones in the file.
            </p>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600 hover:border-indigo-400 hover:bg-indigo-50/40">
              <Upload className="size-4" />
              {jsonFile && jsonFlows ? `Selected: ${jsonFile} — choose another file` : 'Choose a JSON backup file'}
              <input type="file" accept=".json,application/json" onChange={onJson} className="sr-only" />
            </label>
            {jsonError && <ErrorBanner message={jsonError} />}
            {jsonFlows && (
              <div className="space-y-4">
                <p className="text-sm text-slate-700">
                  <b>{jsonFlows.length}</b> flows with <b>{jsonSteps}</b> steps in total.
                </p>
                <ModePicker mode={jsonMode} setMode={setJsonMode} />
                <div className="flex gap-2">
                  <Button icon={Upload} onClick={importJson} loading={jsonBusy}>Restore {jsonFlows.length} flows</Button>
                  <Button variant="ghost" onClick={() => setJsonFlows(null)}>Cancel</Button>
                </div>
              </div>
            )}
            {jsonResult && <ImportResult result={jsonResult} />}
          </div>
        </Card>
      )}
    </div>
  );
}
