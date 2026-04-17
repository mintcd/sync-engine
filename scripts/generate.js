#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
function usage() {
    console.error('Usage: node --loader ts-node/esm services/sync-engine/scripts/generate.ts <schema.json> [projectRoot]');
    process.exit(1);
}
const args = process.argv.slice(2);
if (args.length < 1)
    usage();
const schemaPath = path_1.default.resolve(args[0]);
const projectRoot = args[1] ? path_1.default.resolve(args[1]) : process.cwd();
if (!fs_1.default.existsSync(schemaPath)) {
    console.error('Schema file not found:', schemaPath);
    process.exit(1);
}
let schemaRaw;
try {
    schemaRaw = fs_1.default.readFileSync(schemaPath, 'utf8');
}
catch (e) {
    console.error('Failed to read schema file:', e?.message ?? e);
    process.exit(1);
}
let schema;
try {
    schema = JSON.parse(schemaRaw);
}
catch (e) {
    console.error('Invalid JSON in schema file:', e?.message ?? e);
    process.exit(1);
}
const dbName = schema.dbName || schema.db || schema.name;
const tables = schema.tables;
if (!dbName || !tables || typeof tables !== 'object') {
    console.error('Schema must include `dbName` and `tables` object.');
    process.exit(1);
}
function renderCheckType() {
    return `const checkType = (
  val: unknown,
  expected: string | string[] | null
): boolean => {
  if (expected === null) return val === null;
  if (Array.isArray(expected)) return expected.includes(val as string);
  switch (expected) {
    case "number":
      return typeof val === "number";
    case "string":
      return typeof val === "string";
    case "string|null":
      return typeof val === "string" || val === null;
    case "number|null":
      return typeof val === "number" || val === null;
    case "object":
      return typeof val === "object" && val !== null;
    case "object|null":
      return typeof val === "object" || val === null;
    case "boolean":
      return typeof val === "boolean";
    case "boolean|null":
      return typeof val === "boolean" || val === null;
    default:
      return false;
  }
};\n`;
}
function serializeAllowed(fields) {
    const entries = Object.entries(fields).map(([k, v]) => {
        if (typeof v === 'string') {
            return `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`;
        }
        if (Array.isArray(v)) {
            return `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`;
        }
        if (v && typeof v === 'object' && 'enum' in v && Array.isArray(v.enum)) {
            return `  ${JSON.stringify(k)}: ${JSON.stringify(v.enum)}`;
        }
        if (v && typeof v === 'object') {
            return `  ${JSON.stringify(k)}: ${JSON.stringify('object')}`;
        }
        return `  ${JSON.stringify(k)}: ${JSON.stringify('object')}`;
    });
    return `{
${entries.join(',\n')}
}`;
}
function renderFieldCustomChecks(fields) {
    const parts = [];
    for (const [k, v] of Object.entries(fields)) {
        if (v && typeof v === 'object' && !('enum' in v)) {
            const checks = Object.entries(v).map(([subk, subv]) => {
                if (typeof subv === 'string') {
                    return 'if (!checkType(obj[' + JSON.stringify(k) + '][' + JSON.stringify(subk) + '], ' + JSON.stringify(subv) + ')) return { ok: false, error: ' + JSON.stringify(k + '.' + subk + ' has invalid type') + ' }';
                }
                if (subv && typeof subv === 'object' && 'enum' in subv) {
                    return 'if (![' + subv.enum.map((e) => JSON.stringify(e)).join(', ') + '].includes(obj[' + JSON.stringify(k) + '][' + JSON.stringify(subk) + '] as string)) return { ok: false, error: ' + JSON.stringify(k + '.' + subk + ' has invalid value') + ' }';
                }
                return `// unsupported nested type for ${k}.${subk}`;
            });
            parts.push('if (typeof obj[' + JSON.stringify(k) + '] !== "object" || obj[' + JSON.stringify(k) + '] === null) return { ok: false, error: ' + JSON.stringify('Invalid ' + k + ' object') + ' };\n' + checks.join('\n'));
        }
        if (v && typeof v === 'object' && 'enum' in v) {
            parts.push('if (![' + v.enum.map((e) => JSON.stringify(e)).join(', ') + '].includes(obj[' + JSON.stringify(k) + '] as string)) return { ok: false, error: ' + JSON.stringify('Invalid value for ' + k) + ' }');
        }
    }
    return parts.join('\n\n');
}
// Use simple template files under ../templates to generate code.
const __filename = (0, url_1.fileURLToPath)(import.meta.url);
const __dirname = path_1.default.dirname(__filename);
const templatesDir = path_1.default.join(__dirname, '..', 'templates');
const routeTplPath = path_1.default.join(templatesDir, 'route.ts.tpl');
const swTplPath = path_1.default.join(templatesDir, 'sw.js.tpl');
if (!fs_1.default.existsSync(routeTplPath)) {
    console.error('Route template not found at', routeTplPath);
    process.exit(1);
}
const routeTpl = fs_1.default.readFileSync(routeTplPath, 'utf8');
const swTpl = fs_1.default.existsSync(swTplPath) ? fs_1.default.readFileSync(swTplPath, 'utf8') : null;
// Generate files from templates
for (const [tableName, tableDef] of Object.entries(tables)) {
    const tableObj = tableDef.fields || tableDef;
    const allowedLiteral = serializeAllowed(tableObj);
    const customChecks = renderFieldCustomChecks(tableObj);
    const checkTypeCode = renderCheckType();
    let content = routeTpl
        .replaceAll('__TABLE__', JSON.stringify(tableName))
        .replaceAll('__ALLOWED_LITERAL__', allowedLiteral)
        .replaceAll('__CUSTOM_CHECKS__', customChecks)
        .replaceAll('__CHECK_TYPE__', checkTypeCode);
    const outDir = path_1.default.join(projectRoot, 'app', 'api', tableName);
    fs_1.default.mkdirSync(outDir, { recursive: true });
    const outPath = path_1.default.join(outDir, 'route.ts');
    fs_1.default.writeFileSync(outPath, content, 'utf8');
    console.log('Wrote', outPath);
}
// Generate service worker from template or fallback
const swOut = path_1.default.join(projectRoot, 'public', 'sw.js');
if (swTpl) {
    const swContent = swTpl.replaceAll('__DB_NAME__', dbName).replaceAll('__TABLES__', Object.keys(tables).join(', '));
    fs_1.default.mkdirSync(path_1.default.dirname(swOut), { recursive: true });
    fs_1.default.writeFileSync(swOut, swContent, 'utf8');
    console.log('Wrote', swOut);
}
else {
    const swContent = `// AUTO-GENERATED service worker by sync-engine generator\nself.addEventListener('install', () => self.skipWaiting());\nself.addEventListener('activate', () => self.clients.claim());\n// DB: ${dbName}\n// Tables: ${Object.keys(tables).join(', ')}\n`;
    fs_1.default.mkdirSync(path_1.default.dirname(swOut), { recursive: true });
    fs_1.default.writeFileSync(swOut, swContent, 'utf8');
    console.log('Wrote', swOut);
}
console.log('Generation complete.');
