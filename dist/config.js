"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSchemaDefinition = isSchemaDefinition;
exports.normalizeSyncConfig = normalizeSyncConfig;
function isSchemaDefinition(x) {
    return !!x && typeof x === 'object' && typeof x.tables === 'object';
}
function normalizeSyncConfig(conf, defaults) {
    if (isSchemaDefinition(conf)) {
        const schema = conf;
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
    const cfg = conf;
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
exports.default = {};
