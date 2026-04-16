import { createQueryBuilder, QueryAST, ConditionNode, UpdateAST, SelectAST, DeleteAST } from '../utils/QueryBuilder';
import localDb from './indexedDB';

export const localExecutor = async (ast: QueryAST) => {
  const table = ast.table as any;
  const where = (ast as SelectAST).where as ConditionNode | undefined;
  let candidates: any[] = [];

  switch (ast.action) {
    case 'SELECT':
      candidates = await fetchCandidates(ast);

      // apply remaining where filters (in case we fetched by a broader index)
      const filtered = candidates.filter((r: any) => matchWhere(r, where));

      // Apply select projection
      return ast.action === 'SELECT' && ast.select && ast.select.length
        ? filtered.map((r: any) => {
          const out: any = {};
          for (const f of ast.select!) out[String(f)] = (r as any)[String(f)];
          return out;
        })
        : filtered;

    case 'INSERT': {
      const data = ast.insert as any;
      const rawItems = Array.isArray(data) ? data : [data];
      if (!rawItems.length) return [];

      const prepared = rawItems.map((d: any) => fillDefaults(table, d));

      await Promise.all(prepared.map((d: any) => localDb.putRow(table, d)));

      // enqueue operations for each inserted row
      try {
        await Promise.all(prepared.map((d: any) => localDb.putRow('operations' as any, {
          entity: table as string,
          op_type: 'insert',
          payload: d,
          created_at: Date.now(),
          processed: false,
          attempts: 0,
        } as any)));
      } catch (e) {
        // ignore op enqueue failures
      }
      return [];
    }

    case 'UPDATE': {
      const updates = (ast as UpdateAST).update || {};
      // 1. Fetch candidates (potentially using index)
      candidates = await fetchCandidates(ast);

      // 2. Filter candidates to find exactly which rows to update
      const toUpdateOriginals = candidates.filter((r: any) => matchWhere(r, (ast as UpdateAST).where));
      if (!toUpdateOriginals.length) return [];

      // 3. Apply updates to the filtered rows
      const toUpdate = toUpdateOriginals.map((r: any) => ({ ...r, ...updates }));

      // ensure is_root is consistent for files
      if (table === 'files') {
        for (const r of toUpdate) {
          try {
            if ((r as any).parent_id === null) (r as any).is_root = true;
            (r as any).is_root = ((r as any).parent_id === null);
          } catch (e) { /* ignore */ }
        }
      }

      await Promise.all(toUpdate.map((r: any) => localDb.putRow(table, r as any)));

      // enqueue update ops per-row
      try {
        await Promise.all(toUpdate.map((r: any) => localDb.putRow('operations' as any, {
          entity: table as string,
          op_type: 'update',
          payload: { id: (r as any).id, changes: updates },
          created_at: Date.now(),
          processed: false,
          attempts: 0,
        } as any)));
      } catch (e) {
        // ignore
      }
      return [];
    }

    case 'DELETE': {
      candidates = await fetchCandidates(ast);
      const toDelete = candidates.filter((r: any) => matchWhere(r, (ast as DeleteAST).where));
      if (!toDelete.length) return [];

      await Promise.all(toDelete.map((r: any) => localDb.deleteRow(table, (r as any).id)));

      // enqueue delete ops per-row
      try {
        await Promise.all(toDelete.map((r: any) => localDb.putRow('operations' as any, {
          entity: table as string,
          op_type: 'delete',
          payload: { id: (r as any).id },
          created_at: Date.now(),
          processed: false,
          attempts: 0,
        } as any)));
      } catch (e) {
        // ignore
      }
      return [];
    }
  }
};

export const local = createQueryBuilder<any>(localExecutor);

function fillDefaults(table: string, d: any) {
  if (!d) return d;
  // ensure id exists as string
  if (d.id === undefined || d.id === null) d.id = Date.now().toString();

  if (table === 'files') {
    if (d.parent_id === undefined) d.parent_id = null;
    if (d.prev_id === undefined) d.prev_id = null;
    if (d.next_id === undefined) d.next_id = null;
    if (d.created_at === undefined) d.created_at = Date.now();
    if (d.updated_at === undefined) d.updated_at = Date.now();
    if (d.is_root === undefined) d.is_root = (d.parent_id === null);
  }
  if (table === 'statements') {
    if (d.next_id === undefined) d.next_id = null;
    if (d.prev_id === undefined) d.prev_id = null;
    if (d.created_at === undefined) d.created_at = Date.now();
    if (d.updated_at === undefined) d.updated_at = Date.now();
  }
  return d;
}

function matchWhere(item: any, where?: ConditionNode): boolean {
  if (!where) return true;
  if (where.operator === 'AND' && where.where) {
    return where.where.every(c => matchWhere(item, c));
  }
  if (where.operator === 'OR' && where.where) {
    return where.where.some(c => matchWhere(item, c));
  }
  if (where.operator === '=' && where.field) {
    return item[where.field] === where.value;
  }
  if (where.operator === '>' && where.field) {
    return item[where.field] > where.value;
  }
  if (where.operator === '<' && where.field) {
    return item[where.field] < where.value;
  }
  // Expand as needed for other operators
  return false;
};

async function fetchCandidates(ast: QueryAST): Promise<any[]> {
  const table = ast.table as any;
  const where = (ast as SelectAST).where as ConditionNode | undefined;

  // If no WHERE clause or unknown table, scan all
  if (!where) {
    return await localDb.getAllRows(table);
  }

  // If the condition is on the primary key, we can directly get the row
  if (where && where.operator === '=' && where.field === 'id') {
    try {
      const r = await localDb.getRow(table, where.value);
      return r ? [r] : [];
    } catch (e) {
      return [];
    }
  }

  // if there's a single eq on an indexed field, try queryIndex
  if (where && where.operator === '=' && where.field) {
    const idx = where.field;
    try {
      const res = await localDb.queryIndex(table, idx, where.value);
      return res as any[];
    } catch (e) {
      const all = await localDb.getAllRows(table);
      return all;
    }
  }

  const all = await localDb.getAllRows(table);
  return all.filter(r => matchWhere(r, where));
};
