#!/usr/bin/env node
/* Minimal CLI wrapper to generate Next.js API routes and service worker
   Usage: sync-engine <schema.json> [projectRoot]
*/
const fs = require('fs');
const path = require('path');

function usage() {
  console.error('Usage: sync-engine <schema.json> [projectRoot]');
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

let schemaRaw;
try {
  schemaRaw = fs.readFileSync(schemaPath, 'utf8');
} catch (e) {
  console.error('Failed to read schema file:', e && e.message ? e.message : e);
  process.exit(1);
}

let schema;
try {
  schema = JSON.parse(schemaRaw);
} catch (e) {
  console.error('Invalid JSON in schema file:', e && e.message ? e.message : e);
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
  val, expected
) => {
  if (expected === null) return val === null;
  if (Array.isArray(expected)) return expected.includes(val);
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
    if (v && typeof v === 'object' && Array.isArray(v.enum)) {
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
          return `if (!checkType(obj[${JSON.stringify(k)}][${JSON.stringify(subk)}], ${JSON.stringify(subv)})) return { ok: false, error: \`${k}.${subk} has invalid type\` }`;
        }
        if (subv && typeof subv === 'object' && Array.isArray(subv.enum)) {
          return `if (![${subv.enum.map(e => JSON.stringify(e)).join(', ')}].includes(obj[${JSON.stringify(k)}][${JSON.stringify(subk)}])) return { ok: false, error: \`${k}.${subk} has invalid value\` }`;
        }
        return `// unsupported nested type for ${k}.${subk}`;
      });
      parts.push(`if (typeof obj[${JSON.stringify(k)}] !== 'object' || obj[${JSON.stringify(k)}] === null) return { ok: false, error: \`Invalid ${k} object\` };
${checks.join('\n')}`);
    }
    if (v && typeof v === 'object' && Array.isArray(v.enum)) {
      parts.push(`if (![${v.enum.map(e => JSON.stringify(e)).join(', ')}].includes(obj[${JSON.stringify(k)}] as string)) return { ok: false, error: \`Invalid value for ${k}\` }`);
    }
  }
  return parts.join('\n\n');
}

const templatesDir = path.join(__dirname, '..', 'templates');
const routeTplPath = path.join(templatesDir, 'route.ts.tpl');
const swTplPath = path.join(templatesDir, 'sw.js.tpl');

if (!fs.existsSync(routeTplPath)) {
  console.error('Route template not found at', routeTplPath);
  process.exit(1);
}

const routeTpl = fs.readFileSync(routeTplPath, 'utf8');
const swTpl = fs.existsSync(swTplPath) ? fs.readFileSync(swTplPath, 'utf8') : null;

for (const [tableName, tableDef] of Object.entries(tables)) {
  const tableObj = tableDef.fields || tableDef;
  const allowedLiteral = serializeAllowed(tableObj);
  const customChecks = renderFieldCustomChecks(tableObj);
  const checkTypeCode = renderCheckType();

  let content = routeTpl
    .split('__TABLE__').join(JSON.stringify(tableName))
    .split('__ALLOWED_LITERAL__').join(allowedLiteral)
    .split('__CUSTOM_CHECKS__').join(customChecks)
    .split('__CHECK_TYPE__').join(checkTypeCode);

  const outDir = path.join(projectRoot, 'app', 'api', tableName);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'route.ts');
  fs.writeFileSync(outPath, content, 'utf8');
  console.log('Wrote', outPath);
}

const swOut = path.join(projectRoot, 'public', 'sw.js');
if (swTpl) {
  const swContent = swTpl.split('__DB_NAME__').join(dbName).split('__TABLES__').join(Object.keys(tables).join(', '));
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
