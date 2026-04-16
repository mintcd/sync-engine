export type ColumnType = 'string' | 'number' | 'boolean' | 'object' | 'any';

export type FieldDef = {
  type: ColumnType;
  nullable?: boolean;
  default?: any;
};

export type IndexDef = { name: string; keyPath: string | string[]; options?: any };

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

export const types = {
  string: 'string' as ColumnType,
  number: 'number' as ColumnType,
  boolean: 'boolean' as ColumnType,
  object: 'object' as ColumnType,
  any: 'any' as ColumnType,
};

export const string = (opts?: any) => ({ type: 'string', ...opts } as FieldDef);
export const number = (opts?: any) => ({ type: 'number', ...opts } as FieldDef);
export const boolean = (opts?: any) => ({ type: 'boolean', ...opts } as FieldDef);
export const object = (opts?: any) => ({ type: 'object', ...opts } as FieldDef);
