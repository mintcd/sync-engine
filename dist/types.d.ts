export type ColumnType = 'string' | 'number' | 'boolean' | 'object' | 'any';
export type FieldDef = {
    type: ColumnType;
    nullable?: boolean;
    default?: any;
};
export type IndexDef = {
    name: string;
    keyPath: string | string[];
    options?: any;
};
export type TableDef = {
    keyPath: string | string[];
    indices?: IndexDef[];
    fields?: Record<string, FieldDef | ColumnType>;
};
export type SchemaDefinition = {
    dbName?: string;
    dbVersion?: number;
    tables: Record<string, TableDef>;
};
export declare const types: {
    string: ColumnType;
    number: ColumnType;
    boolean: ColumnType;
    object: ColumnType;
    any: ColumnType;
};
export declare const string: (opts?: any) => FieldDef;
export declare const number: (opts?: any) => FieldDef;
export declare const boolean: (opts?: any) => FieldDef;
export declare const object: (opts?: any) => FieldDef;
