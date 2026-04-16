Sync Engine
============

Shared sync utilities extracted from the Notes app.

Usage
-----
Add the repo as a git submodule in your app repository:

```bash
git submodule add https://github.com/mintcd/sync-engine.git sync-engine
```

Then install the package (from the sibling folder) in your app:

```bash
# from the app folder
npm install ../sync-engine
# or: npm install file:../sync-engine
```

Or reference the published git repo in `package.json`.

Imports
-------

```ts
import { syncWithServer, localDb, actions, remote } from 'sync-engine'
```

Note: after adding as a submodule, run `npm install` in your app so Node resolves the local package. You can also use TypeScript path mapping to point `sync-engine` at the local `src` folder during development.
