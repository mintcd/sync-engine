import { createQueryBuilder, QueryAST, SelectAST, InsertAST, UpdateAST, DeleteAST, ConditionNode } from '../utils/QueryBuilder';
import type { RemoteSchema } from './RemoteSchema';
import { getConfig, setConfig } from '../db/indexedDB';

// Persist a single client_id in IndexedDB (date-based, created once per device)
let _clientId: string | null = null;
async function getClientId(): Promise<string> {
  if (_clientId) return _clientId;
  try {
    const stored = await getConfig('client_id');
    if (stored) {
      _clientId = stored;
      return _clientId;
    }
    const newId = Date.now().toString();
    await setConfig('client_id', newId);
    _clientId = newId;
    return _clientId;
  } catch {
    // fallback for SSR / environments without IndexedDB
    if (!_clientId) _clientId = Date.now().toString();
    return _clientId;
  }
}

// Fields that exist in the remote D1 schema per table.
// Anything not listed here is stripped before sending to the API.
const REMOTE_FIELDS: Record<string, string[]> = {
  files: ['id', 'name', 'parent_id', 'next_id', 'prev_id', 'created_at', 'updated_at'],
  statements: ['id', 'name', 'file_id', 'next_id', 'prev_id', 'size', 'type', 'content', 'created_at', 'updated_at'],
};

function sanitize(table: string, data: any): any {
  const allowed = REMOTE_FIELDS[table];
  if (!allowed || !data || typeof data !== 'object') return data;
  const out: any = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(data, k)) out[k] = data[k];
  }
  return out;
}

const BASE = '/api';

async function apiRequest(table: string, method: string, body?: any, params?: Record<string, string>) {
  let url = `${BASE}/${table}/`;
  if (params && Object.keys(params).length) {
    const qs = new URLSearchParams(params as any).toString();
    url += `?${qs}`;
  }
  const opts: any = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts as any);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`API ${method} ${url} failed: ${res.status} ${res.statusText} ${txt}`);
  }
  const json = await res.json().catch(() => null);
  return json;
}

export const remote = createQueryBuilder<RemoteSchema>(async (ast: QueryAST) => {
  const table = String(ast.table) as keyof RemoteSchema;

  // helper to build query params from ast.where
  const buildParams = () => {
    const params: Record<string, string> = {};
    const selectAst = ast as SelectAST;
    if (selectAst.select && selectAst.select.length) params.select = selectAst.select.join(',');

    const extractConditions = (node?: ConditionNode) => {
      if (!node) return;
      if (node.operator === 'AND' && node.where) {
        node.where.forEach(extractConditions);
      } else if (node.operator === '=' && node.field) {
        const v = node.value;
        params[node.field] = v === null ? 'null' : String(v);
      }
    };

    const whereAst = ast as (SelectAST | UpdateAST | DeleteAST);
    if (whereAst.where) {
      extractConditions(whereAst.where as ConditionNode);
    }
    return params;
  };

  if (ast.action === 'INSERT') {
    const data = (ast as InsertAST).insert as any;
    const client_id = await getClientId();
    if (Array.isArray(data)) {
      for (const row of data) {
        await apiRequest(table as string, 'POST', { data: sanitize(table as string, row), client_id, client_op_id: Date.now().toString() });
      }
      return [];
    }
    if (data) {
      await apiRequest(table as string, 'POST', { data: sanitize(table as string, data), client_id, client_op_id: Date.now().toString() });
      return [];
    }
  }

  if (ast.action === 'UPDATE') {
    const updates = (ast as UpdateAST).update || {};
    // fetch matching rows then PUT per-row (resources PUT expects { data: { id, ... } })
    const params = buildParams();
    const found = await apiRequest(table as string, 'GET', undefined, params) as any[];
    const client_id = await getClientId();
    for (const row of found || []) {
      const rowCopy: any = { ...(row as any) };
      // D1 stores object columns (like `content`) as JSON strings; when
      // merging server-side rows with updates we must restore them to
      // objects so the remote API's validation sees the proper shape.
      if (table === 'statements' && rowCopy.content && typeof rowCopy.content === 'string') {
        try {
          rowCopy.content = JSON.parse(rowCopy.content);
        } catch (e) {
          // leave as-is if parse fails; validation will catch it
        }
      }
      const merged = sanitize(table as string, { ...rowCopy, ...(updates as any) });
      await apiRequest(table as string, 'PUT', { data: merged, client_id, client_op_id: Date.now().toString() });
    }
    return [];
  }

  if (ast.action === 'DELETE') {
    const params = buildParams();
    const found = await apiRequest(table as string, 'GET', undefined, params) as any[];
    const client_id = await getClientId();
    for (const row of found || []) {
      const id = (row as any).id;
      if (id === undefined) continue;
      await apiRequest(table as string, 'DELETE', { id, client_id, client_op_id: Date.now().toString() });
    }
    return [];
  }

  // select
  const params = buildParams();
  const resp = await apiRequest(table as string, 'GET', undefined, params) as any[];
  return resp as RemoteSchema[keyof RemoteSchema][];
});
