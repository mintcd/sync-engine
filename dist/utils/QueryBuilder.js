"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.or = exports.and = exports.gt = exports.eq = exports.QueryBuilder = void 0;
exports.createQueryBuilder = createQueryBuilder;
class QueryBuilder {
    // Accept the executor in the constructor
    constructor(executor) {
        this.executor = executor;
        this.ast = {};
    }
    select(...props) {
        this.ast.action = 'SELECT';
        this.ast.select = props;
        return this;
    }
    insert(data) {
        this.ast.action = 'INSERT';
        this.ast.insert = data;
        return this;
    }
    update(data) {
        this.ast.action = 'UPDATE';
        this.ast.update = data;
        return this;
    }
    delete() {
        this.ast.action = 'DELETE';
        return this;
    }
    from(table) {
        this.ast.table = table;
        return this;
    }
    where(condition) {
        this.ast.where = condition;
        return this;
    }
    async execute() {
        if (this.executor)
            return this.executor(this.ast);
        console.log("Executing:", this.ast);
        return [];
    }
    async then(onfulfilled, onrejected) {
        return this.execute().then(onfulfilled, onrejected);
    }
}
exports.QueryBuilder = QueryBuilder;
// Standalone operators
const eq = (field, value) => ({ operator: '=', field, value });
exports.eq = eq;
const gt = (field, value) => ({ operator: '>', field, value });
exports.gt = gt;
const and = (...where) => ({ operator: 'AND', where });
exports.and = and;
const or = (...where) => ({ operator: 'OR', where });
exports.or = or;
function createQueryBuilder(execute) {
    return {
        select(...fields) { return new QueryBuilder(execute).select(...fields); },
        insert(data) { return new QueryBuilder(execute).insert(data); },
        update(data) { return new QueryBuilder(execute).update(data); },
        delete() { return new QueryBuilder(execute).delete(); }
    };
}
