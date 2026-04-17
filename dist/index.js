"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRepository = exports.createSyncEngine = exports.actions = exports.syncWithServer = exports.setConfig = exports.getConfig = exports.queryIndex = exports.getAllRows = exports.deleteRow = exports.putRow = exports.getRow = exports.localDb = void 0;
var indexedDB_1 = require("./db/indexedDB");
Object.defineProperty(exports, "localDb", { enumerable: true, get: function () { return __importDefault(indexedDB_1).default; } });
var indexedDB_2 = require("./db/indexedDB");
Object.defineProperty(exports, "getRow", { enumerable: true, get: function () { return indexedDB_2.getRow; } });
Object.defineProperty(exports, "putRow", { enumerable: true, get: function () { return indexedDB_2.putRow; } });
Object.defineProperty(exports, "deleteRow", { enumerable: true, get: function () { return indexedDB_2.deleteRow; } });
Object.defineProperty(exports, "getAllRows", { enumerable: true, get: function () { return indexedDB_2.getAllRows; } });
Object.defineProperty(exports, "queryIndex", { enumerable: true, get: function () { return indexedDB_2.queryIndex; } });
Object.defineProperty(exports, "getConfig", { enumerable: true, get: function () { return indexedDB_2.getConfig; } });
Object.defineProperty(exports, "setConfig", { enumerable: true, get: function () { return indexedDB_2.setConfig; } });
var sync_1 = require("./sync");
Object.defineProperty(exports, "syncWithServer", { enumerable: true, get: function () { return sync_1.syncWithServer; } });
var swActions_1 = require("./swActions");
Object.defineProperty(exports, "actions", { enumerable: true, get: function () { return swActions_1.actions; } });
__exportStar(require("./api"), exports);
__exportStar(require("./utils/QueryBuilder"), exports);
var createEngine_1 = require("./createEngine");
Object.defineProperty(exports, "createSyncEngine", { enumerable: true, get: function () { return createEngine_1.createSyncEngine; } });
var repository_1 = require("./repository");
Object.defineProperty(exports, "createRepository", { enumerable: true, get: function () { return repository_1.createRepository; } });
__exportStar(require("./types"), exports);
__exportStar(require("./config"), exports);
