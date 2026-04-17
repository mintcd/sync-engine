import type { LocalSchema, Store } from './LocalSchema';
export type TableSchema = {
    keyPath: string | string[];
    indices: Array<{
        name: string;
        keyPath: string | string[];
        options?: any;
    }>;
};
export declare function configureIndexedDB(opts: {
    dbName?: string;
    dbVersion?: number;
    tableSchemas?: Record<string, TableSchema>;
}): void;
export declare function getDB(): Promise<IDBDatabase>;
/** Reset the cached DB connection - call this in tests after deleteDatabase(). */
export declare function resetDbConnection(): void;
export declare function deleteDatabase(): Promise<void>;
export declare function getRow<T extends Store>(storeName: T, key: IDBValidKey | IDBKeyRange): Promise<LocalSchema[T] | undefined>;
export declare function putRow<T extends Store>(storeName: T, value: LocalSchema[T]): Promise<void>;
export declare function deleteRow<T extends Store>(storeName: T, key: IDBValidKey | IDBKeyRange): Promise<void>;
export declare function getAllRows<T extends Store>(storeName: T): Promise<LocalSchema[T][]>;
export declare function getConfig(key: string): Promise<string | undefined>;
export declare function setConfig(key: string, value: string): Promise<void>;
export declare function queryIndex<T extends Store, R = any>(storeName: T, indexName: string, range?: IDBKeyRange | IDBValidKey | boolean, direction?: IDBCursorDirection): Promise<R[]>;
declare const _default: {
    getDB: typeof getDB;
    configureIndexedDB: typeof configureIndexedDB;
    getRow: typeof getRow;
    putRow: typeof putRow;
    deleteRow: typeof deleteRow;
    getAllRows: typeof getAllRows;
    queryIndex: typeof queryIndex;
    getConfig: typeof getConfig;
    setConfig: typeof setConfig;
};
export default _default;
