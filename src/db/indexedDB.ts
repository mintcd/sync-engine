import type { LocalSchema, Store } from './LocalSchema';

let DB_NAME = 'notes-db';
let DB_VERSION = 1;

export type TableSchema = { keyPath: string | string[]; indices: Array<{ name: string; keyPath: string | string[]; options?: any }> };

let TableSchemas: Record<string, TableSchema> = {
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

export function configureIndexedDB(opts: { dbName?: string; dbVersion?: number; tableSchemas?: Record<string, TableSchema> }) {
  if (opts.dbName) DB_NAME = opts.dbName;
  if (opts.dbVersion) DB_VERSION = opts.dbVersion;
  if (opts.tableSchemas) TableSchemas = opts.tableSchemas;
  // Reset cached connection so the next getDB() call will reopen using new config
  resetDbConnection();
}

function createDatabase(db: IDBDatabase, tx: IDBTransaction | null): void {
  Object.entries(TableSchemas).forEach(([storeName, schema]) => {
    let store: IDBObjectStore;
    if (!db.objectStoreNames.contains(storeName)) {
      store = db.createObjectStore(storeName, { keyPath: schema.keyPath });
    } else if (tx) {
      store = tx.objectStore(storeName);
    } else {
      return;
    }

    schema.indices.forEach(idx => {
      if (!store.indexNames.contains(idx.name)) {
        store.createIndex(idx.name, idx.keyPath, idx.options);
      }
    });
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => {
      dbPromise = undefined as any
      console.error(req.error)
      reject(req.error)
    }
    req.onblocked = () => console.error('IndexedDB open blocked')
    req.onupgradeneeded = () => {
      createDatabase(req.result, req.transaction)
    }
    req.onsuccess = () => {
      const db = req.result
      db.onclose = () => { dbPromise = undefined as any }
      db.onversionchange = () => {
        db.close()
        dbPromise = undefined as any
      }
      resolve(db)
    }
  })
}

let dbPromise: Promise<IDBDatabase>
let isResetting = false;

export function getDB(): Promise<IDBDatabase> {
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
          } catch (e) { /* ignore */ }

          // 2. Unregister service workers to release DB locks
          if ('serviceWorker' in navigator) {
            try {
              const registrations = await navigator.serviceWorker.getRegistrations();
              for (const registration of registrations) {
                await registration.unregister();
              }
            } catch (e) { console.error('[Reset] Failed to unregister SW', e); }
          }

          // 3. Delete IndexedDB
          try {
            await deleteDatabase();
            console.log('[Reset] IndexedDB deleted.');
          } catch (e) {
            console.error('[Reset] Failed to delete IndexedDB', e);
          }

          // 4. Clear LocalStorage and set new version
          localStorage.clear();
          localStorage.setItem('app_version', currentVersion);

          // 5. Reload page
          window.location.reload();

          // Block indefinitely
          return new Promise<IDBDatabase>(() => { });
        })();
      }
      return dbPromise;
    }
  }

  if (!dbPromise) {
    dbPromise = openDatabase()
  }
  return dbPromise
}

/** Reset the cached DB connection - call this in tests after deleteDatabase(). */
export function resetDbConnection(): void {
  dbPromise = undefined as any
}

export function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => console.warn('IndexedDB delete blocked')
  })
}

export async function getRow<T extends Store>(storeName: T, key: IDBValidKey | IDBKeyRange): Promise<LocalSchema[T] | undefined> {
  let db = await getDB()
  const tx = db.transaction(storeName, 'readonly')
  const store = tx.objectStore(storeName)
  const req = store.get(key)
  const res = await reqToPromise(req)
  return res as LocalSchema[T] | undefined
}

export async function putRow<T extends Store>(storeName: T, value: LocalSchema[T]): Promise<void> {
  let db = await getDB()
  try {
    const schema = TableSchemas[String(storeName)];
    if (schema && typeof schema.keyPath === 'string') {
      const kp = schema.keyPath as string;
      const v = value as any;
      if (v[kp] === undefined || v[kp] === null) {
        // Use a stable string id (many callers expect string ids)
        v[kp] = Date.now().toString();
      }
    }
  } catch (e) {
    // ignore any unexpected schema/keyPath issues
  }
  // Ensure is_root for files store
  try {
    if (String(storeName) === 'files') {
      const v = value as any
      if (v.is_root === undefined) v.is_root = (v.parent_id === null)
    }
  } catch (e) { /* ignore */ }
  const tx = db.transaction(storeName, 'readwrite')
  const store = tx.objectStore(storeName)

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)

    try {
      // debug trace to help determine where writes go
      try { console.debug('indexedDB.putRow ->', storeName, value); } catch (e) { /* ignore */ }
      const req = store.put(value as any)
      req.onerror = () => reject(req.error)
    } catch (e) {
      try { console.error('indexedDB.putRow error ->', storeName, e); } catch (er) { /* ignore */ }
      reject(e)
    }
  })
}

export async function deleteRow<T extends Store>(storeName: T, key: IDBValidKey | IDBKeyRange): Promise<void> {
  let db = await getDB()
  const tx = db.transaction(storeName, 'readwrite')
  const store = tx.objectStore(storeName)

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)

    try {
      const req = store.delete(key as any)
      req.onerror = () => reject(req.error)
    } catch (e) {
      reject(e)
    }
  })
}

export async function getAllRows<T extends Store>(storeName: T): Promise<LocalSchema[T][]> {
  let db = await getDB()
  const tx = db.transaction(storeName, 'readonly')
  const store = tx.objectStore(storeName)
  const req = store.getAll()
  const res = await reqToPromise(req)
  return res as LocalSchema[T][]
}

export async function getConfig(key: string): Promise<string | undefined> {
  const db = await getDB();
  const tx = db.transaction('config', 'readonly');
  const store = tx.objectStore('config');
  const req = store.get(key);
  const res = await reqToPromise(req);
  return res ? (res as any).value : undefined;
}

export async function setConfig(key: string, value: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('config', 'readwrite');
  const store = tx.objectStore('config');
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    store.put({ key, value });
  });
}

export async function queryIndex<T extends Store, R = any>(
  storeName: T,
  indexName: string,
  range?: IDBKeyRange | IDBValidKey | boolean,
  direction: IDBCursorDirection = 'next'
): Promise<R[]> {
  let db = await getDB()
  const tx = db.transaction(storeName, 'readonly')
  const store = tx.objectStore(storeName)
  const idx = store.index(indexName)

  if (range === null || typeof range === 'boolean') {
    // IndexedDB does not index null or boolean values. We must scan the object store.
    const matchValue = range
    // idx.keyPath is the actual record field name (e.g. 'processed'),
    // which may differ from the index name (e.g. 'by_processed').
    const fieldPath = idx.keyPath as string
    const req = store.getAll()
    return new Promise((resolve, reject) => {
      req.onsuccess = () => {
        const all = req.result as any[]
        const results = all.filter(val => val && val[fieldPath] === matchValue) as R[]
        if (direction === 'prev' || direction === 'prevunique') results.reverse()
        resolve(results)
      }
      req.onerror = () => reject(req.error)
    })
  }

  // For supported ranges, use a cursor so IndexedDB handles ordering natively
  const cursorRange = range === undefined ? null : range as IDBValidKey | IDBKeyRange
  const req = idx.openCursor(cursorRange, direction)
  const results: R[] = []
  return new Promise((resolve, reject) => {
    req.onsuccess = (ev) => {
      const cursor = (ev.target as IDBRequest).result as IDBCursorWithValue | null
      if (!cursor) return resolve(results)
      results.push(cursor.value as R)
      cursor.continue()
    }
    req.onerror = () => reject(req.error)
  })
}


function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}


export default {
  getDB,
  configureIndexedDB,
  getRow,
  putRow,
  deleteRow,
  getAllRows,
  queryIndex,
  getConfig,
  setConfig,
}