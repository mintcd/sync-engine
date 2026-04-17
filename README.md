A sync engine specialized to:

1) Remote database: Cloudflare D1
2) Local database: indexedDB and localStorage
3) Framework: file-based routing Nextjs

Quick generator usage

- Generate Next.js API routes and a service worker from a schema:

```bash
# from anywhere after publishing the package
npx @mintcd/sync-engine path/to/schema.json [projectRoot]
```

Example:

```bash
npx @mintcd/sync-engine ./schema.example.json ./my-next-app
```

Client usage

Import the runtime helpers from the package in your client code:

```ts
import { createSyncEngine } from '@mintcd/sync-engine';

const engine = createSyncEngine(schemaOrConfig, { autoRegisterSW: true });
```

The generator already writes `app/api/<table>/route.ts` files and `public/sw.js` for you.