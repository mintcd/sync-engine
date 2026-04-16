import { configureIndexedDB } from './db/indexedDB';
import { createRepository } from './repository';
import { localExecutor } from './db/query';
import { remote } from './api';
import { syncWithServer } from './sync';
import { actions } from './swActions';
import type { SchemaDefinition } from './types';
import localDb from './db/indexedDB';

export function createSyncEngine(schema: SchemaDefinition, options?: { autoRegisterSW?: boolean; swPath?: string; scope?: string; dbName?: string; dbVersion?: number }) {
  const tableSchemas: Record<string, any> = Object.fromEntries(
    Object.entries(schema.tables || {}).map(([name, def]) => [name, { keyPath: def.keyPath, indices: (def.indices || []).map((i: any) => ({ name: i.name, keyPath: i.keyPath, options: i.options })) }])
  );

  configureIndexedDB({ dbName: schema.dbName || options?.dbName, dbVersion: schema.dbVersion || options?.dbVersion, tableSchemas });

  const repository = createRepository(localExecutor);

  async function registerServiceWorker(swPath = '/sw.js', scope = '/') {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    try {
      await navigator.serviceWorker.register(swPath, { scope });
    } catch (e) {
      console.warn('createSyncEngine: SW registration failed', e);
    }
  }

  if (options?.autoRegisterSW) {
    try { registerServiceWorker(options.swPath, options.scope); } catch (e) { /* ignore */ }
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
