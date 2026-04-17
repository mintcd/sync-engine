import { configureIndexedDB } from './db/indexedDB';
import { syncWithServer } from './sync';
import type { SchemaDefinition } from './types';
import { type SyncConfig } from './config';
export declare function createSyncEngine(schemaOrConfig: SchemaDefinition | SyncConfig, options?: {
    autoRegisterSW?: boolean;
    swPath?: string;
    scope?: string;
    dbName?: string;
    dbVersion?: number;
}): {
    repository: import(".").IDatabase<any>;
    remote: import(".").IDatabase<import("./api/RemoteSchema").RemoteSchema>;
    syncWithServer: typeof syncWithServer;
    actions: {
        updateRemote: string;
        remoteQuery: string;
        remoteQueryResult: string;
        remoteQueryError: string;
        updateRemoteResult: string;
        updateRemoteError: string;
        registerSync: string;
        queueOp: string;
        backgroundSync: string;
    };
    localDb: {
        getDB: typeof import("./db/indexedDB").getDB;
        configureIndexedDB: typeof configureIndexedDB;
        getRow: typeof import("./db/indexedDB").getRow;
        putRow: typeof import("./db/indexedDB").putRow;
        deleteRow: typeof import("./db/indexedDB").deleteRow;
        getAllRows: typeof import("./db/indexedDB").getAllRows;
        queryIndex: typeof import("./db/indexedDB").queryIndex;
        getConfig: typeof import("./db/indexedDB").getConfig;
        setConfig: typeof import("./db/indexedDB").setConfig;
    };
    registerServiceWorker: (swPath?: string, scope?: string) => Promise<void>;
};
export default createSyncEngine;
