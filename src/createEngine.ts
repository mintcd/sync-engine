import { configureIndexedDB } from './db/indexedDB';
import { createRepository } from './repository';
import { localExecutor } from './db/query';
import { remote } from './api';
import { syncWithServer } from './sync';
import { actions } from './swActions';
import type { SchemaDefinition } from './types';
import localDb from './db/indexedDB';
import { normalizeSyncConfig, isSchemaDefinition, type SyncConfig } from './config';

export function createSyncEngine(schemaOrConfig: SchemaDefinition | SyncConfig, options?: { autoRegisterSW?: boolean; swPath?: string; scope?: string; dbName?: string; dbVersion?: number }) {
  const cfg = normalizeSyncConfig(schemaOrConfig as any);

  // merge legacy `options` overrides for backward compatibility
  if (options) {
    cfg.dbName = options.dbName ?? cfg.dbName;
    cfg.dbVersion = options.dbVersion ?? cfg.dbVersion;
    cfg.autoRegisterSW = options.autoRegisterSW ?? cfg.autoRegisterSW;
    cfg.swPath = options.swPath ?? cfg.swPath;
    cfg.swScope = options.scope ?? cfg.swScope;
  }

  const tableSchemas: Record<string, any> = Object.fromEntries(
    Object.entries(cfg.schema.tables || {}).map(([name, def]) => [name, { keyPath: def.keyPath, indices: (def.indices || []).map((i: any) => ({ name: i.name, keyPath: i.keyPath, options: i.options })) }])
  );

  configureIndexedDB({ dbName: cfg.dbName, dbVersion: cfg.dbVersion, tableSchemas });

  const repository = createRepository(localExecutor);

  async function registerServiceWorker(swPath = cfg.swPath || '/sw.js', scope = cfg.swScope || '/') {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    try {
      await navigator.serviceWorker.register(swPath, { scope });
    } catch (e) {
      console.warn('createSyncEngine: SW registration failed', e);
    }
  }

  if (cfg.autoRegisterSW) {
    try { registerServiceWorker(cfg.swPath, cfg.swScope); } catch (e) { /* ignore */ }
  }

  return {
    repository,
    remote,
    syncWithServer,
    actions,
    localDb,
    registerServiceWorker,
  };
}

export default createSyncEngine;
