"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureIndexedDB = configureIndexedDB;
exports.getDB = getDB;
exports.resetDbConnection = resetDbConnection;
exports.deleteDatabase = deleteDatabase;
exports.getRow = getRow;
exports.putRow = putRow;
exports.deleteRow = deleteRow;
exports.getAllRows = getAllRows;
exports.getConfig = getConfig;
exports.setConfig = setConfig;
exports.queryIndex = queryIndex;
let DB_NAME = 'notes-db';
let DB_VERSION = 1;
let TableSchemas = {
    files: {
        keyPath: 'id',
        indices: [
            { name: 'parent_id', keyPath: 'parent_id' },
            { name: 'is_root', keyPath: 'is_root' },
            { name: 'next_id', keyPath: 'next_id' },
            { name: 'prev_id', keyPath: 'prev_id' },
        ]
    },
    statements: {
        keyPath: 'id',
        indices: [
            { name: 'file_id', keyPath: 'file_id' },
            { name: 'next_id', keyPath: 'next_id' },
            { name: 'prev_id', keyPath: 'prev_id' },
        ]
    },
    operations: {
        keyPath: 'id',
        indices: [
            { name: 'by_processed', keyPath: 'processed' },
            { name: 'by_client', keyPath: ['client_id', 'client_op_id'] },
            { name: 'by_entity', keyPath: 'entity' },
            { name: 'by_created_at', keyPath: 'created_at' },
        ]
    },
    config: {
        keyPath: 'key',
        indices: []
    }
};
function configureIndexedDB(opts) {
    if (opts.dbName)
        DB_NAME = opts.dbName;
    if (opts.dbVersion)
        DB_VERSION = opts.dbVersion;
    if (opts.tableSchemas)
        TableSchemas = opts.tableSchemas;
    // Reset cached connection so the next getDB() call will reopen using new config
    resetDbConnection();
}
function createDatabase(db, tx) {
    Object.entries(TableSchemas).forEach(([storeName, schema]) => {
        let store;
        if (!db.objectStoreNames.contains(storeName)) {
            store = db.createObjectStore(storeName, { keyPath: schema.keyPath });
        }
        else if (tx) {
            store = tx.objectStore(storeName);
        }
        else {
            return;
        }
        schema.indices.forEach(idx => {
            if (!store.indexNames.contains(idx.name)) {
                store.createIndex(idx.name, idx.keyPath, idx.options);
            }
        });
    });
}
function openDatabase() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onerror = () => {
            dbPromise = undefined;
            console.error(req.error);
            reject(req.error);
        };
        req.onblocked = () => console.error('IndexedDB open blocked');
        req.onupgradeneeded = () => {
            createDatabase(req.result, req.transaction);
        };
        req.onsuccess = () => {
            const db = req.result;
            db.onclose = () => { dbPromise = undefined; };
            db.onversionchange = () => {
                db.close();
                dbPromise = undefined;
            };
            resolve(db);
        };
    });
}
let dbPromise;
let isResetting = false;
function getDB() {
    if (typeof window !== 'undefined' && window.localStorage && process.env.NEXT_PUBLIC_APP_VERSION) {
        const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION;
        const storedVersion = localStorage.getItem('app_version');
        if (storedVersion !== currentVersion) {
            if (!isResetting) {
                isResetting = true;
                console.warn(`[Reset] New version detected: ${currentVersion} (was ${storedVersion}). Clearing data...`);
                dbPromise = (async () => {
                    // 1. Close existing connection if any
                    try {
                        // If dbPromise was already set to a valid DB connection, close it
                        // But since we are here, we are replacing it.
                        // If there was a previous successful connection, we need to access it differently?
                        // Actually, if we are resetting, we don't care about graceful close of old connection variable,
                        // we just need to ensure the DB file is unlocked.
                    }
                    catch (e) { /* ignore */ }
                    // 2. Unregister service workers to release DB locks
                    if ('serviceWorker' in navigator) {
                        try {
                            const registrations = await navigator.serviceWorker.getRegistrations();
                            for (const registration of registrations) {
                                await registration.unregister();
                            }
                        }
                        catch (e) {
                            console.error('[Reset] Failed to unregister SW', e);
                        }
                    }
                    // 3. Delete IndexedDB
                    try {
                        await deleteDatabase();
                        console.log('[Reset] IndexedDB deleted.');
                    }
                    catch (e) {
                        console.error('[Reset] Failed to delete IndexedDB', e);
                    }
                    // 4. Clear LocalStorage and set new version
                    localStorage.clear();
                    localStorage.setItem('app_version', currentVersion);
                    // 5. Reload page
                    window.location.reload();
                    // Block indefinitely
                    return new Promise(() => { });
                })();
            }
            return dbPromise;
        }
    }
    if (!dbPromise) {
        dbPromise = openDatabase();
    }
    return dbPromise;
}
/** Reset the cached DB connection - call this in tests after deleteDatabase(). */
function resetDbConnection() {
    dbPromise = undefined;
}
function deleteDatabase() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        req.onblocked = () => console.warn('IndexedDB delete blocked');
    });
}
async function getRow(storeName, key) {
    let db = await getDB();
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    const res = await reqToPromise(req);
    return res;
}
async function putRow(storeName, value) {
    let db = await getDB();
    try {
        const schema = TableSchemas[String(storeName)];
        if (schema && typeof schema.keyPath === 'string') {
            const kp = schema.keyPath;
            const v = value;
            if (v[kp] === undefined || v[kp] === null) {
                // Use a stable string id (many callers expect string ids)
                v[kp] = Date.now().toString();
            }
        }
    }
    catch (e) {
        // ignore any unexpected schema/keyPath issues
    }
    // Ensure is_root for files store
    try {
        if (String(storeName) === 'files') {
            const v = value;
            if (v.is_root === undefined)
                v.is_root = (v.parent_id === null);
        }
    }
    catch (e) { /* ignore */ }
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        try {
            // debug trace to help determine where writes go
            try {
                console.debug('indexedDB.putRow ->', storeName, value);
            }
            catch (e) { /* ignore */ }
            const req = store.put(value);
            req.onerror = () => reject(req.error);
        }
        catch (e) {
            try {
                console.error('indexedDB.putRow error ->', storeName, e);
            }
            catch (er) { /* ignore */ }
            reject(e);
        }
    });
}
async function deleteRow(storeName, key) {
    let db = await getDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        try {
            const req = store.delete(key);
            req.onerror = () => reject(req.error);
        }
        catch (e) {
            reject(e);
        }
    });
}
async function getAllRows(storeName) {
    let db = await getDB();
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    const res = await reqToPromise(req);
    return res;
}
async function getConfig(key) {
    const db = await getDB();
    const tx = db.transaction('config', 'readonly');
    const store = tx.objectStore('config');
    const req = store.get(key);
    const res = await reqToPromise(req);
    return res ? res.value : undefined;
}
async function setConfig(key, value) {
    const db = await getDB();
    const tx = db.transaction('config', 'readwrite');
    const store = tx.objectStore('config');
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        store.put({ key, value });
    });
}
async function queryIndex(storeName, indexName, range, direction = 'next') {
    let db = await getDB();
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const idx = store.index(indexName);
    if (range === null || typeof range === 'boolean') {
        // IndexedDB does not index null or boolean values. We must scan the object store.
        const matchValue = range;
        // idx.keyPath is the actual record field name (e.g. 'processed'),
        // which may differ from the index name (e.g. 'by_processed').
        const fieldPath = idx.keyPath;
        const req = store.getAll();
        return new Promise((resolve, reject) => {
            req.onsuccess = () => {
                const all = req.result;
                const results = all.filter(val => val && val[fieldPath] === matchValue);
                if (direction === 'prev' || direction === 'prevunique')
                    results.reverse();
                resolve(results);
            };
            req.onerror = () => reject(req.error);
        });
    }
    // For supported ranges, use a cursor so IndexedDB handles ordering natively
    const cursorRange = range === undefined ? null : range;
    const req = idx.openCursor(cursorRange, direction);
    const results = [];
    return new Promise((resolve, reject) => {
        req.onsuccess = (ev) => {
            const cursor = ev.target.result;
            if (!cursor)
                return resolve(results);
            results.push(cursor.value);
            cursor.continue();
        };
        req.onerror = () => reject(req.error);
    });
}
function reqToPromise(req) {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
exports.default = {
    getDB,
    configureIndexedDB,
    getRow,
    putRow,
    deleteRow,
    getAllRows,
    queryIndex,
    getConfig,
    setConfig,
};
