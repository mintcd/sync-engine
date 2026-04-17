import type { SchemaDefinition } from './types';
export type GeneratorOptions = {
    generateSw?: boolean;
    generateEndpoints?: boolean;
    outDir?: string;
    swPath?: string;
    endpointsPrefix?: string;
    overwrite?: boolean;
};
export type SyncConfig = {
    dbName?: string;
    dbVersion?: number;
    schema: SchemaDefinition;
    autoRegisterSW?: boolean;
    swPath?: string;
    swScope?: string;
    generator?: GeneratorOptions;
};
export declare function isSchemaDefinition(x: any): x is SchemaDefinition;
export declare function normalizeSyncConfig(conf: SyncConfig | SchemaDefinition, defaults?: Partial<SyncConfig>): SyncConfig;
declare const _default: SyncConfig;
export default _default;
