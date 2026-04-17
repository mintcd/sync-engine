#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

type FieldDef = string | { enum: string[] } | Record<string, FieldDef>;
type TableDef = { fields?: Record<string, FieldDef> } | Record<string, FieldDef>;
type Schema = { dbName?: string; db?: string; name?: string; tables: Record<string, TableDef> };

function usage(): never {
  console.error('Usage: node --loader ts-node/esm services/sync-engine/scripts/generate.ts <schema.json> [projectRoot]');
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length < 1) usage();

const schemaPath = path.resolve(args[0]);
const projectRoot = args[1] ? path.resolve(args[1]) : process.cwd();

if (!fs.existsSync(schemaPath)) {
  console.error('Schema file not found:', schemaPath);
  process.exit(1);
}

let schemaRaw: string;
try {
  schemaRaw = fs.readFileSync(schemaPath, 'utf8');
} catch (e: any) {
  console.error('Failed to read schema file:', e?.message ?? e);
  process.exit(1);
}

let schema: Schema;
try {
  schema = JSON.parse(schemaRaw) as Schema;
} catch (e: any) {
  console.error('Invalid JSON in schema file:', e?.message ?? e);
  process.exit(1);
}

const dbName = schema.dbName || schema.db || schema.name;
const tables = schema.tables;

if (!dbName || !tables || typeof tables !== 'object') {
  console.error('Schema must include `dbName` and `tables` object.');
  process.exit(1);
}

function renderCheckType(): string {
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

function serializeAllowed(fields: Record<string, FieldDef>): string {
  const entries = Object.entries(fields).map(([k, v]) => {
    if (typeof v === 'string') {
      return `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`;
    }
    if (Array.isArray(v)) {
      return `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`;
    }
    if (v && typeof v === 'object' && 'enum' in v && Array.isArray((v as any).enum)) {
      return `  ${JSON.stringify(k)}: ${JSON.stringify((v as any).enum)}`;
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

function renderFieldCustomChecks(fields: Record<string, FieldDef>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v && typeof v === 'object' && !('enum' in v)) {
      const checks = Object.entries(v as Record<string, FieldDef>).map(([subk, subv]) => {
        if (typeof subv === 'string') {
          return `if (!checkType(obj[${JSON.stringify(k)}][${JSON.stringify(subk)}], ${JSON.stringify(subv)})) return { ok: false, error: \\`${ k }.${ subk } has invalid type\\` }`;
        }
        if (subv && typeof subv === 'object' && 'enum' in subv) {
          return `if (![${(subv as any).enum.map((e: any) => JSON.stringify(e)).join(', ')}].includes(obj[${JSON.stringify(k)}][${JSON.stringify(subk)}] as string)) return { ok: false, error: \\`${ k }.${ subk } has invalid value\\` }`;
        }
        return `// unsupported nested type for ${k}.${subk}`;
      });
      parts.push(`if (typeof obj[${JSON.stringify(k)}] !== 'object' || obj[${JSON.stringify(k)}] === null) return { ok: false, error: \\`Invalid ${ k } object\\` };
${checks.join('\n')}`);
    }
    if (v && typeof v === 'object' && 'enum' in v) {
      parts.push(`if (![${(v as any).enum.map((e: any) => JSON.stringify(e)).join(', ')}].includes(obj[${JSON.stringify(k)}] as string)) return { ok: false, error: \\`Invalid value for ${ k }\\` }`);
    }
  }
  return parts.join('\n\n');
}

// Use simple template files under ../templates to generate code.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesDir = path.join(__dirname, '..', 'templates');
const routeTplPath = path.join(templatesDir, 'route.ts.tpl');
const swTplPath = path.join(templatesDir, 'sw.js.tpl');

if (!fs.existsSync(routeTplPath)) {
  console.error('Route template not found at', routeTplPath);
  process.exit(1);
}

const routeTpl = fs.readFileSync(routeTplPath, 'utf8');
const swTpl = fs.existsSync(swTplPath) ? fs.readFileSync(swTplPath, 'utf8') : null;

// Generate files from templates
for (const [tableName, tableDef] of Object.entries(tables)) {
  const tableObj = (tableDef as any).fields || tableDef;
  const allowedLiteral = serializeAllowed(tableObj as Record<string, FieldDef>);
  const customChecks = renderFieldCustomChecks(tableObj as Record<string, FieldDef>);
  const checkTypeCode = renderCheckType();

  let content = routeTpl
    .replaceAll('__TABLE__', JSON.stringify(tableName))
    .replaceAll('__ALLOWED_LITERAL__', allowedLiteral)
    .replaceAll('__CUSTOM_CHECKS__', customChecks)
    .replaceAll('__CHECK_TYPE__', checkTypeCode);

  const outDir = path.join(projectRoot, 'app', 'api', tableName);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'route.ts');
  fs.writeFileSync(outPath, content, 'utf8');
  console.log('Wrote', outPath);
}

// Generate service worker from template or fallback
const swOut = path.join(projectRoot, 'public', 'sw.js');
if (swTpl) {
  const swContent = swTpl.replaceAll('__DB_NAME__', dbName).replaceAll('__TABLES__', Object.keys(tables).join(', '));
  fs.mkdirSync(path.dirname(swOut), { recursive: true });
  fs.writeFileSync(swOut, swContent, 'utf8');
  console.log('Wrote', swOut);
} else {
  const swContent = `// AUTO-GENERATED service worker by sync-engine generator\nself.addEventListener('install', () => self.skipWaiting());\nself.addEventListener('activate', () => self.clients.claim());\n// DB: ${dbName}\n// Tables: ${Object.keys(tables).join(', ')}\n`;
  fs.mkdirSync(path.dirname(swOut), { recursive: true });
  fs.writeFileSync(swOut, swContent, 'utf8');
  console.log('Wrote', swOut);
}

console.log('Generation complete.');
