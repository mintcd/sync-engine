"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSyncEngine = createSyncEngine;
const indexedDB_1 = require("./db/indexedDB");
const repository_1 = require("./repository");
const query_1 = require("./db/query");
const api_1 = require("./api");
const sync_1 = require("./sync");
const swActions_1 = require("./swActions");
const indexedDB_2 = __importDefault(require("./db/indexedDB"));
const config_1 = require("./config");
function createSyncEngine(schemaOrConfig, options) {
    const cfg = (0, config_1.normalizeSyncConfig)(schemaOrConfig);
    // merge legacy `options` overrides for backward compatibility
    if (options) {
        cfg.dbName = options.dbName ?? cfg.dbName;
        cfg.dbVersion = options.dbVersion ?? cfg.dbVersion;
        cfg.autoRegisterSW = options.autoRegisterSW ?? cfg.autoRegisterSW;
        cfg.swPath = options.swPath ?? cfg.swPath;
        cfg.swScope = options.scope ?? cfg.swScope;
    }
    const tableSchemas = Object.fromEntries(Object.entries(cfg.schema.tables || {}).map(([name, def]) => [name, { keyPath: def.keyPath, indices: (def.indices || []).map((i) => ({ name: i.name, keyPath: i.keyPath, options: i.options })) }]));
    (0, indexedDB_1.configureIndexedDB)({ dbName: cfg.dbName, dbVersion: cfg.dbVersion, tableSchemas });
    const repository = (0, repository_1.createRepository)(query_1.localExecutor);
    async function registerServiceWorker(swPath = cfg.swPath || '/sw.js', scope = cfg.swScope || '/') {
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator))
            return;
        try {
            await navigator.serviceWorker.register(swPath, { scope });
        }
        catch (e) {
            console.warn('createSyncEngine: SW registration failed', e);
        }
    }
    if (cfg.autoRegisterSW) {
        try {
            registerServiceWorker(cfg.swPath, cfg.swScope);
        }
        catch (e) { /* ignore */ }
    }
    return {
        repository,
        remote: api_1.remote,
        syncWithServer: sync_1.syncWithServer,
        actions: swActions_1.actions,
        localDb: indexedDB_2.default,
        registerServiceWorker,
    };
}
exports.default = createSyncEngine;
