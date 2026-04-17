"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncWithServer = syncWithServer;
const indexedDB_1 = __importDefault(require("./db/indexedDB"));
async function syncWithServer() {
    if (typeof fetch === 'undefined')
        return { applied: 0, error: 'fetch not available' };
    try {
        const last = Number(localStorage.getItem('lastRemoteOpsAt') || 0);
        const url = `/api/operations?since=${last}`;
        console.log('syncWithServer: fetching', url);
        let res;
        try {
            res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
        }
        catch (fetchErr) {
            console.error('syncWithServer: fetch error', fetchErr);
            return { applied: 0, error: String(fetchErr && fetchErr.message ? fetchErr.message : fetchErr) };
        }
        if (!res.ok)
            return { applied: 0, error: `server returned ${res.status}` };
        const ops = await res.json();
        if (!Array.isArray(ops) || ops.length === 0)
            return { applied: 0 };
        let applied = 0;
        let maxAt = last;
        const errors = [];
        for (const op of ops) {
            try {
                const entity = op.entity;
                const opType = op.op_type;
                const payload = op.payload;
                const created = Number(op.created_at) || 0;
                if (created > maxAt)
                    maxAt = created;
                // normalize payload shapes
                if (payload && payload.action === 'insert' && payload.data) {
                    await indexedDB_1.default.putRow(entity, payload.data);
                    applied++;
                    continue;
                }
                if (payload && payload.action === 'update' && (payload.changes || payload.id)) {
                    const id = payload.id;
                    if (id !== undefined) {
                        const row = await indexedDB_1.default.getRow(entity, id);
                        const newRow = Object.assign({}, row || {}, payload.changes || {});
                        await indexedDB_1.default.putRow(entity, newRow);
                        applied++;
                        continue;
                    }
                }
                if (payload && payload.action === 'delete' && payload.id !== undefined) {
                    await indexedDB_1.default.deleteRow(entity, payload.id);
                    applied++;
                    continue;
                }
                // fallback to op_type-based payloads
                if (opType === 'insert' && payload) {
                    await indexedDB_1.default.putRow(entity, payload);
                    applied++;
                    continue;
                }
                if (opType === 'update' && payload) {
                    const id = (payload && (payload.id ?? payload.ID ?? payload.ID));
                    if (id !== undefined) {
                        const row = await indexedDB_1.default.getRow(entity, id);
                        const changes = payload.changes || payload;
                        const newRow = Object.assign({}, row || {}, changes || {});
                        await indexedDB_1.default.putRow(entity, newRow);
                        applied++;
                        continue;
                    }
                }
                if (opType === 'delete' && payload && payload.id !== undefined) {
                    await indexedDB_1.default.deleteRow(entity, payload.id);
                    applied++;
                    continue;
                }
                // unknown op shape: ignore
            }
            catch (e) {
                errors.push(String(e && e.message ? e.message : e));
            }
        }
        try {
            localStorage.setItem('lastRemoteOpsAt', String(maxAt));
        }
        catch (e) { /* ignore */ }
        return { applied, errors };
    }
    catch (e) {
        return { applied: 0, error: String(e && e.message ? e.message : e) };
    }
}
exports.default = syncWithServer;
