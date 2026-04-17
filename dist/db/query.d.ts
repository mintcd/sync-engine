import { QueryAST } from '../utils/QueryBuilder';
export declare const localExecutor: (ast: QueryAST) => Promise<any[]>;
export declare const local: import("../utils/QueryBuilder").IDatabase<any>;
