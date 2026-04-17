"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.object = exports.boolean = exports.number = exports.string = exports.types = void 0;
exports.types = {
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    object: 'object',
    any: 'any',
};
const string = (opts) => ({ type: 'string', ...opts });
exports.string = string;
const number = (opts) => ({ type: 'number', ...opts });
exports.number = number;
const boolean = (opts) => ({ type: 'boolean', ...opts });
exports.boolean = boolean;
const object = (opts) => ({ type: 'object', ...opts });
exports.object = object;
