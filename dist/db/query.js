"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.local = exports.localExecutor = void 0;
const QueryBuilder_1 = require("../utils/QueryBuilder");
const indexedDB_1 = __importDefault(require("./indexedDB"));
const localExecutor = async (ast) => {
    const table = ast.table;
    const where = ast.where;
    let candidates = [];
    switch (ast.action) {
        case 'SELECT':
            candidates = await fetchCandidates(ast);
            // apply remaining where filters (in case we fetched by a broader index)
            const filtered = candidates.filter((r) => matchWhere(r, where));
            // Apply select projection
            return ast.action === 'SELECT' && ast.select && ast.select.length
                ? filtered.map((r) => {
                    const out = {};
                    for (const f of ast.select)
                        out[String(f)] = r[String(f)];
                    return out;
                })
                : filtered;
        case 'INSERT': {
            const data = ast.insert;
            const rawItems = Array.isArray(data) ? data : [data];
            if (!rawItems.length)
                return [];
            const prepared = rawItems.map((d) => fillDefaults(table, d));
            await Promise.all(prepared.map((d) => indexedDB_1.default.putRow(table, d)));
            // enqueue operations for each inserted row
            try {
                await Promise.all(prepared.map((d) => indexedDB_1.default.putRow('operations', {
                    entity: table,
                    op_type: 'insert',
                    payload: d,
                    created_at: Date.now(),
                    processed: false,
                    attempts: 0,
                })));
            }
            catch (e) {
                // ignore op enqueue failures
            }
            return [];
        }
        case 'UPDATE': {
            const updates = ast.update || {};
            // 1. Fetch candidates (potentially using index)
            candidates = await fetchCandidates(ast);
            // 2. Filter candidates to find exactly which rows to update
            const toUpdateOriginals = candidates.filter((r) => matchWhere(r, ast.where));
            if (!toUpdateOriginals.length)
                return [];
            // 3. Apply updates to the filtered rows
            const toUpdate = toUpdateOriginals.map((r) => ({ ...r, ...updates }));
            // ensure is_root is consistent for files
            if (table === 'files') {
                for (const r of toUpdate) {
                    try {
                        if (r.parent_id === null)
                            r.is_root = true;
                        r.is_root = (r.parent_id === null);
                    }
                    catch (e) { /* ignore */ }
                }
            }
            await Promise.all(toUpdate.map((r) => indexedDB_1.default.putRow(table, r)));
            // enqueue update ops per-row
            try {
                await Promise.all(toUpdate.map((r) => indexedDB_1.default.putRow('operations', {
                    entity: table,
                    op_type: 'update',
                    payload: { id: r.id, changes: updates },
                    created_at: Date.now(),
                    processed: false,
                    attempts: 0,
                })));
            }
            catch (e) {
                // ignore
            }
            return [];
        }
        case 'DELETE': {
            candidates = await fetchCandidates(ast);
            const toDelete = candidates.filter((r) => matchWhere(r, ast.where));
            if (!toDelete.length)
                return [];
            await Promise.all(toDelete.map((r) => indexedDB_1.default.deleteRow(table, r.id)));
            // enqueue delete ops per-row
            try {
                await Promise.all(toDelete.map((r) => indexedDB_1.default.putRow('operations', {
                    entity: table,
                    op_type: 'delete',
                    payload: { id: r.id },
                    created_at: Date.now(),
                    processed: false,
                    attempts: 0,
                })));
            }
            catch (e) {
                // ignore
            }
            return [];
        }
    }
};
exports.localExecutor = localExecutor;
exports.local = (0, QueryBuilder_1.createQueryBuilder)(exports.localExecutor);
function fillDefaults(table, d) {
    if (!d)
        return d;
    // ensure id exists as string
    if (d.id === undefined || d.id === null)
        d.id = Date.now().toString();
    if (table === 'files') {
        if (d.parent_id === undefined)
            d.parent_id = null;
        if (d.prev_id === undefined)
            d.prev_id = null;
        if (d.next_id === undefined)
            d.next_id = null;
        if (d.created_at === undefined)
            d.created_at = Date.now();
        if (d.updated_at === undefined)
            d.updated_at = Date.now();
        if (d.is_root === undefined)
            d.is_root = (d.parent_id === null);
    }
    if (table === 'statements') {
        if (d.next_id === undefined)
            d.next_id = null;
        if (d.prev_id === undefined)
            d.prev_id = null;
        if (d.created_at === undefined)
            d.created_at = Date.now();
        if (d.updated_at === undefined)
            d.updated_at = Date.now();
    }
    return d;
}
function matchWhere(item, where) {
    if (!where)
        return true;
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
}
;
async function fetchCandidates(ast) {
    const table = ast.table;
    const where = ast.where;
    // If no WHERE clause or unknown table, scan all
    if (!where) {
        return await indexedDB_1.default.getAllRows(table);
    }
    // If the condition is on the primary key, we can directly get the row
    if (where && where.operator === '=' && where.field === 'id') {
        try {
            const r = await indexedDB_1.default.getRow(table, where.value);
            return r ? [r] : [];
        }
        catch (e) {
            return [];
        }
    }
    // if there's a single eq on an indexed field, try queryIndex
    if (where && where.operator === '=' && where.field) {
        const idx = where.field;
        try {
            const res = await indexedDB_1.default.queryIndex(table, idx, where.value);
            return res;
        }
        catch (e) {
            const all = await indexedDB_1.default.getAllRows(table);
            return all;
        }
    }
    const all = await indexedDB_1.default.getAllRows(table);
    return all.filter(r => matchWhere(r, where));
}
;
