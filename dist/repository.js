"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRepository = createRepository;
const QueryBuilder_1 = require("./utils/QueryBuilder");
const swActions_1 = require("./swActions");
function genOpId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function postToServiceWorker(message) {
    try {
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator))
            return;
        const controller = navigator.serviceWorker.controller;
        if (controller) {
            controller.postMessage(message);
            return;
        }
        navigator.serviceWorker.ready.then((reg) => {
            try {
                reg.active?.postMessage(message);
            }
            catch (e) {
                // swallow
            }
        }).catch(() => { });
    }
    catch (e) {
        // ignore
    }
}
function createRepository(executor) {
    return (0, QueryBuilder_1.createQueryBuilder)(async (ast) => {
        // Execute against local DB
        const result = await executor(ast);
        // If it's a mutating operation, notify the SW to sync later
        if (ast.action === 'INSERT' || ast.action === 'UPDATE' || ast.action === 'DELETE') {
            const opId = genOpId();
            postToServiceWorker({ type: swActions_1.actions.updateRemote, opId, ast });
        }
        return result;
    });
}
exports.default = createRepository;
