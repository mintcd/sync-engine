import { createQueryBuilder, QueryAST } from './utils/QueryBuilder';
import { actions } from './swActions';

function genOpId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function postToServiceWorker(message: any) {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const controller = navigator.serviceWorker.controller;
    if (controller) {
      controller.postMessage(message);
      return;
    }
    navigator.serviceWorker.ready.then((reg) => {
      try {
        reg.active?.postMessage(message);
      } catch (e) {
        // swallow
      }
    }).catch(() => { });
  } catch (e) {
    // ignore
  }
}

export function createRepository(executor: (ast: QueryAST) => Promise<any>) {
  return createQueryBuilder<any>(async (ast: QueryAST) => {
    // Execute against local DB
    const result = await executor(ast);

    // If it's a mutating operation, notify the SW to sync later
    if (ast.action === 'INSERT' || ast.action === 'UPDATE' || ast.action === 'DELETE') {
      const opId = genOpId();
      postToServiceWorker({ type: actions.updateRemote, opId, ast });
    }
    return result;
  });
}

export default createRepository;
