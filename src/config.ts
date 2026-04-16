import type { SchemaDefinition } from './types';

export type GeneratorOptions = {
  generateSw?: boolean; // generate sw.js
  generateEndpoints?: boolean; // generate server endpoints
  outDir?: string; // output directory for generated artifacts
  swPath?: string; // path where SW will be served (e.g. '/sw.js')
  endpointsPrefix?: string; // API prefix for generated endpoints (e.g. '/api/sync')
  overwrite?: boolean; // overwrite existing generated files
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

export function isSchemaDefinition(x: any): x is SchemaDefinition {
  return !!x && typeof x === 'object' && typeof x.tables === 'object';
}

export function normalizeSyncConfig(conf: SyncConfig | SchemaDefinition, defaults?: Partial<SyncConfig>): SyncConfig {
  if (isSchemaDefinition(conf)) {
    const schema = conf as SchemaDefinition;
    return {
      schema,
      dbName: schema.dbName ?? defaults?.dbName,
      dbVersion: schema.dbVersion ?? defaults?.dbVersion ?? 1,
      autoRegisterSW: defaults?.autoRegisterSW ?? false,
      swPath: defaults?.swPath ?? '/sw.js',
      swScope: defaults?.swScope ?? '/',
      generator: {
        generateSw: false,
        generateEndpoints: false,
        outDir: 'dist',
        swPath: '/sw.js',
        endpointsPrefix: '/api/sync',
        overwrite: false,
        ...(defaults?.generator || {}),
      },
    };
  }

  const cfg = conf as SyncConfig;
  return {
    schema: cfg.schema,
    dbName: cfg.dbName ?? cfg.schema.dbName ?? defaults?.dbName,
    dbVersion: cfg.dbVersion ?? cfg.schema.dbVersion ?? defaults?.dbVersion ?? 1,
    autoRegisterSW: cfg.autoRegisterSW ?? defaults?.autoRegisterSW ?? false,
    swPath: cfg.swPath ?? defaults?.swPath ?? '/sw.js',
    swScope: cfg.swScope ?? defaults?.swScope ?? '/',
    generator: {
      generateSw: cfg.generator?.generateSw ?? defaults?.generator?.generateSw ?? false,
      generateEndpoints: cfg.generator?.generateEndpoints ?? defaults?.generator?.generateEndpoints ?? false,
      outDir: cfg.generator?.outDir ?? defaults?.generator?.outDir ?? 'dist',
      swPath: cfg.generator?.swPath ?? defaults?.generator?.swPath ?? '/sw.js',
      endpointsPrefix: cfg.generator?.endpointsPrefix ?? defaults?.generator?.endpointsPrefix ?? '/api/sync',
      overwrite: cfg.generator?.overwrite ?? defaults?.generator?.overwrite ?? false,
    },
  };
}

export default {} as unknown as SyncConfig;
