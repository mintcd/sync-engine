"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.remote = void 0;
const QueryBuilder_1 = require("../utils/QueryBuilder");
const indexedDB_1 = require("../db/indexedDB");
// Persist a single client_id in IndexedDB (date-based, created once per device)
let _clientId = null;
async function getClientId() {
    if (_clientId)
        return _clientId;
    try {
        const stored = await (0, indexedDB_1.getConfig)('client_id');
        if (stored) {
            _clientId = stored;
            return _clientId;
        }
        const newId = Date.now().toString();
        await (0, indexedDB_1.setConfig)('client_id', newId);
        _clientId = newId;
        return _clientId;
    }
    catch {
        // fallback for SSR / environments without IndexedDB
        if (!_clientId)
            _clientId = Date.now().toString();
        return _clientId;
    }
}
// Fields that exist in the remote D1 schema per table.
// Anything not listed here is stripped before sending to the API.
const REMOTE_FIELDS = {
    files: ['id', 'name', 'parent_id', 'next_id', 'prev_id', 'created_at', 'updated_at'],
    statements: ['id', 'name', 'file_id', 'next_id', 'prev_id', 'size', 'type', 'content', 'created_at', 'updated_at'],
};
function sanitize(table, data) {
    const allowed = REMOTE_FIELDS[table];
    if (!allowed || !data || typeof data !== 'object')
        return data;
    const out = {};
    for (const k of allowed) {
        if (Object.prototype.hasOwnProperty.call(data, k))
            out[k] = data[k];
    }
    return out;
}
const BASE = '/api';
async function apiRequest(table, method, body, params) {
    let url = `${BASE}/${table}/`;
    if (params && Object.keys(params).length) {
        const qs = new URLSearchParams(params).toString();
        url += `?${qs}`;
    }
    const opts = { method, headers: {} };
    if (body !== undefined) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`API ${method} ${url} failed: ${res.status} ${res.statusText} ${txt}`);
    }
    const json = await res.json().catch(() => null);
    return json;
}
exports.remote = (0, QueryBuilder_1.createQueryBuilder)(async (ast) => {
    const table = String(ast.table);
    // helper to build query params from ast.where
    const buildParams = () => {
        const params = {};
        const selectAst = ast;
        if (selectAst.select && selectAst.select.length)
            params.select = selectAst.select.join(',');
        const extractConditions = (node) => {
            if (!node)
                return;
            if (node.operator === 'AND' && node.where) {
                node.where.forEach(extractConditions);
            }
            else if (node.operator === '=' && node.field) {
                const v = node.value;
                params[node.field] = v === null ? 'null' : String(v);
            }
        };
        const whereAst = ast;
        if (whereAst.where) {
            extractConditions(whereAst.where);
        }
        return params;
    };
    if (ast.action === 'INSERT') {
        const data = ast.insert;
        const client_id = await getClientId();
        if (Array.isArray(data)) {
            for (const row of data) {
                await apiRequest(table, 'POST', { data: sanitize(table, row), client_id, client_op_id: Date.now().toString() });
            }
            return [];
        }
        if (data) {
            await apiRequest(table, 'POST', { data: sanitize(table, data), client_id, client_op_id: Date.now().toString() });
            return [];
        }
    }
    if (ast.action === 'UPDATE') {
        const updates = ast.update || {};
        // fetch matching rows then PUT per-row (resources PUT expects { data: { id, ... } })
        const params = buildParams();
        const found = await apiRequest(table, 'GET', undefined, params);
        const client_id = await getClientId();
        for (const row of found || []) {
            const rowCopy = { ...row };
            // D1 stores object columns (like `content`) as JSON strings; when
            // merging server-side rows with updates we must restore them to
            // objects so the remote API's validation sees the proper shape.
            if (table === 'statements' && rowCopy.content && typeof rowCopy.content === 'string') {
                try {
                    rowCopy.content = JSON.parse(rowCopy.content);
                }
                catch (e) {
                    // leave as-is if parse fails; validation will catch it
                }
            }
            const merged = sanitize(table, { ...rowCopy, ...updates });
            await apiRequest(table, 'PUT', { data: merged, client_id, client_op_id: Date.now().toString() });
        }
        return [];
    }
    if (ast.action === 'DELETE') {
        const params = buildParams();
        const found = await apiRequest(table, 'GET', undefined, params);
        const client_id = await getClientId();
        for (const row of found || []) {
            const id = row.id;
            if (id === undefined)
                continue;
            await apiRequest(table, 'DELETE', { id, client_id, client_op_id: Date.now().toString() });
        }
        return [];
    }
    // select
    const params = buildParams();
    const resp = await apiRequest(table, 'GET', undefined, params);
    return resp;
});
