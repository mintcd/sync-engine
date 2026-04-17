import { QueryAST } from './utils/QueryBuilder';
export declare function createRepository(executor: (ast: QueryAST) => Promise<any>): import("./utils/QueryBuilder").IDatabase<any>;
export default createRepository;
